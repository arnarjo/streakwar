import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialize, getGrantedPermissions, readRecords, aggregateRecord, requestPermission } from 'react-native-health-connect';
import { pollHealthConnect, initHealthConnect, checkHealthConnectGranted } from '../src/lib/healthConnect';
import { getActiveChallengeId } from '../src/lib/db';
import { supabase } from '../src/lib/supabase';

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: {} }));
jest.mock('expo-constants', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(), getGrantedPermissions: jest.fn(),
  readRecords: jest.fn(), aggregateRecord: jest.fn(),
  requestPermission: jest.fn(),
}));
jest.mock('../src/lib/db', () => ({ getActiveChallengeId: jest.fn(async () => null) }));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(() => { throw new Error('Unexpected database access'); }) },
}));

const EMPTY_OK = {
  exercise: { status: 'ok', written: 0, cursorAdvanced: true },
  steps: { status: 'ok', written: 0, updated: false },
};
const SKIPPED_OUTCOMES = {
  exercise: { status: 'skipped', written: 0, cursorAdvanced: false },
  steps: { status: 'skipped', written: 0, updated: false },
};
const storage = jest.mocked(AsyncStorage);
const init = jest.mocked(initialize);

beforeEach(() => {
  jest.resetAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'synthetic-user' } } }, error: null });
  init.mockResolvedValue(true);
  jest.mocked(getGrantedPermissions).mockResolvedValue([
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Steps' },
  ]);
  jest.mocked(readRecords).mockResolvedValue({ records: [] });
  jest.mocked(aggregateRecord<'Steps'>).mockResolvedValue({ COUNT_TOTAL: 0, dataOrigins: [] });
  jest.mocked(getActiveChallengeId).mockResolvedValue(null);
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

it('does not confirm a write-only Health Connect grant', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'write', recordType: 'ExerciseSession' }]);
  await expect(checkHealthConnectGranted()).resolves.toBe(false);
});

it('requests read access instead of accepting an existing write-only grant', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'write', recordType: 'ExerciseSession' }]);
  jest.mocked(requestPermission).mockResolvedValue([{ accessType: 'read', recordType: 'ExerciseSession' }]);
  await expect(initHealthConnect()).resolves.toBe(true);
  expect(requestPermission).toHaveBeenCalledWith([
    { accessType: 'read', recordType: 'ExerciseSession' }, { accessType: 'read', recordType: 'Steps' },
  ]);
});

it('rejects a poll belonging to another signed-in account before native reads', async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'other' } } }, error: null });
  await expect(pollHealthConnect('synthetic-user')).rejects.toThrow('account changed');
  expect(initialize).not.toHaveBeenCalled();
  expect(readRecords).not.toHaveBeenCalled();
});

it('does not write exercises or cursor after an account changes during native read', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(readRecords<'ExerciseSession'>).mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    return { records: [{ exerciseType: 0, metadata: { id: 'late-exercise' },
      startTime: '2026-09-29T10:00:00Z', endTime: '2026-09-29T10:30:00Z' }] };
  });
  const insert = jest.fn();
  const query = { eq: jest.fn(), in: jest.fn().mockResolvedValue({ data: [], error: null }) };
  query.eq.mockReturnValue(query);
  (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(query), insert });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(insert).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('does not mistake write permission for exercise read permission', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'write', recordType: 'ExerciseSession' }]);
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, ranWithPermissions: false });
  expect(readRecords).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('skips unauthorized steps reads while retaining successful exercise progress', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'read', recordType: 'ExerciseSession' }]);
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(aggregateRecord).not.toHaveBeenCalled();
  expect(readRecords).toHaveBeenCalledTimes(1);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});

it('never sums raw steps as a fallback when aggregation fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(aggregateRecord).mockRejectedValue(new Error('Aggregation unavailable'));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(readRecords).toHaveBeenCalledTimes(1);
  expect(supabase.from).not.toHaveBeenCalled();
});

it.each([NaN, Infinity, -1])('rejects an invalid step total (%s)', async count => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(aggregateRecord<'Steps'>).mockResolvedValue({ COUNT_TOTAL: count, dataOrigins: [] });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(supabase.from).not.toHaveBeenCalled();
});

describe('exercise batch conflict recovery', () => {
  const insert = jest.fn();
  const confirm = jest.fn();
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    insert.mockReset();
    confirm.mockReset();
    const record = (id: string) => ({
      exerciseType: 0, metadata: { id },
      startTime: '2026-09-29T10:00:00Z', endTime: '2026-09-29T10:30:00Z',
    });
    jest.mocked(readRecords<'ExerciseSession'>).mockResolvedValue({ records: [record('existing'), record('new')] });
    const query = {
      eq: jest.fn(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: confirm,
    };
    query.eq.mockReturnValue(query);
    (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(query), insert });
    insert.mockResolvedValueOnce({ error: { code: '23505' } })
      .mockResolvedValueOnce({ error: { code: '23505' } })
      .mockResolvedValueOnce({ error: null });
    confirm.mockResolvedValue({ data: { external_activity_id: 'existing' }, error: null });
  });

  it('imports the new row after a batch conflict and counts only the new insert', async () => {
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 1 });
    expect(insert).toHaveBeenCalledTimes(3);
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ external_activity_id: 'new' }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: 'Lookup failed' } },
  ])('does not treat an unverified conflict as success: %j', async result => {
    confirm.mockResolvedValue(result);
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps the cursor when an individual retry has a non-duplicate failure', async () => {
    insert.mockReset().mockResolvedValueOnce({ error: { code: '23505' } })
      .mockResolvedValueOnce({ error: { code: 'NETWORK' } })
      .mockResolvedValueOnce({ error: null });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(confirm).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not retry a batch rejected for a different reason', async () => {
    insert.mockReset().mockResolvedValue({ error: { code: '42501', message: 'Denied' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('binds duplicate confirmation to the account and exact exercise ID', async () => {
    await pollHealthConnect('synthetic-user');
    const query = (supabase.from as jest.Mock).mock.results[0].value.select();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'synthetic-user');
    expect(query.eq).toHaveBeenCalledWith('external_activity_id', 'existing');
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

it('reads subsequent exercise pages with the same time window before saving the cursor', async () => {
  jest.mocked(readRecords).mockResolvedValueOnce({ records: [], pageToken: 'next-page' })
    .mockResolvedValueOnce({ records: [], pageToken: '' });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true });
  expect(readRecords).toHaveBeenCalledTimes(2);
  const first = jest.mocked(readRecords).mock.calls[0][1];
  expect(readRecords).toHaveBeenNthCalledWith(2, 'ExerciseSession', {
    ...first, pageToken: 'next-page',
  });
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});

it('does not advance the cursor when a later exercise page fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(readRecords).mockResolvedValueOnce({ records: [], pageToken: 'next-page' })
    .mockRejectedValueOnce(new Error('Later page unavailable'));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('imports an exercise found only on the second page', async () => {
  jest.mocked(readRecords<'ExerciseSession'>)
    .mockResolvedValueOnce({ records: [], pageToken: 'second' })
    .mockResolvedValueOnce({ records: [{
      exerciseType: 0, metadata: { id: 'synthetic-exercise' },
      startTime: '2026-09-29T10:00:00Z', endTime: '2026-09-29T10:30:00Z',
    }] });
  const insert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }),
    }) }), insert,
  });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 1 });
  expect(insert).toHaveBeenCalledWith([expect.objectContaining({ external_activity_id: 'synthetic-exercise' })]);
});

it('stops a repeated page token without reporting success', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(readRecords).mockResolvedValue({ records: [], pageToken: 'loop' });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(readRecords).toHaveBeenCalledTimes(2);
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('bounds a never-ending sequence of different page tokens', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  let page = 0;
  jest.mocked(readRecords).mockImplementation(async () => ({ records: [], pageToken: `page-${++page}` }));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(readRecords).toHaveBeenCalledTimes(100);
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('does not report completion or advance the cursor after a records read failure', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(readRecords).mockRejectedValueOnce(new Error('Read failed'));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('keeps a different cursor per user and ignores the unowned legacy cursor', async () => {
  const saved = new Map([['health_connect_last_sync', '2099-01-01T00:00:00Z']]);
  storage.getItem.mockImplementation(async key => saved.get(key) ?? null);
  storage.setItem.mockImplementation(async (key, value) => { saved.set(key, value); });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: null });
  await pollHealthConnect('user-a');
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'user-b' } } }, error: null });
  await pollHealthConnect('user-b');
  expect(storage.getItem.mock.calls).toEqual([
    ['health_connect_last_sync:user-a'], ['health_connect_last_sync:user-b'],
  ]);
  expect(saved.has('health_connect_last_sync:user-a')).toBe(true);
  expect(saved.has('health_connect_last_sync:user-b')).toBe(true);
  const secondWindow = jest.mocked(readRecords).mock.calls[1][1].timeRangeFilter;
  if (secondWindow.operator !== 'between') throw new Error('Expected a bounded polling window');
  expect(new Date(secondWindow.startTime).getTime()).toBeLessThan(Date.now());
});

it('does not report full completion when steps fail, but saves the exercise cursor', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(aggregateRecord).mockRejectedValueOnce(new Error('Steps denied'));
  jest.mocked(readRecords).mockResolvedValueOnce({ records: [] }).mockRejectedValueOnce(new Error('Steps denied'));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
  expect(storage.setItem).toHaveBeenCalledWith('health_connect_last_sync:synthetic-user', expect.any(String));
});

it('does not report completion if persisting the cursor fails', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false });
});

it('reports completion for a successful empty poll', async () => {
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 0 });
  expect(supabase.from).not.toHaveBeenCalled();
});

it.each(['insert', 'update'])('reports incomplete sync when a steps %s fails', async failure => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(aggregateRecord<'Steps'>).mockResolvedValue({ COUNT_TOTAL: 500, dataOrigins: [] });
  const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: { message: 'Offline' } }),
  }) });
  (supabase.from as jest.Mock).mockReturnValue({
    insert: jest.fn().mockResolvedValue({ error: { code: failure === 'update' ? '23505' : 'NETWORK', message: 'Failed' } }),
    update,
  });
  await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
  expect(update).toHaveBeenCalledTimes(failure === 'update' ? 1 : 0);
});

it('releases the poll lock after a cursor read rejects, without advancing the cursor', async () => {
  storage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(pollHealthConnect('synthetic-user')).rejects.toThrow('Storage unavailable');
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(readRecords).not.toHaveBeenCalled();

  await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
    synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK,
  });
  expect(readRecords).toHaveBeenCalledTimes(1);
});

it('releases the poll lock after an invalid stored cursor', async () => {
  storage.getItem.mockResolvedValueOnce('not-a-date');
  await expect(pollHealthConnect('synthetic-user')).rejects.toThrow(RangeError);
  expect(storage.setItem).not.toHaveBeenCalled();
  await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
    synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK,
  });
});

it('releases the poll lock when native initialization throws synchronously', async () => {
  init.mockImplementationOnce(() => { throw new Error('Native failure'); });
  await expect(pollHealthConnect('synthetic-user')).rejects.toThrow('Native failure');
  await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
    synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK,
  });
});

it('still skips an overlapping call until the active poll finishes', async () => {
  let release!: (value: string | null) => void;
  storage.getItem.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const active = pollHealthConnect('synthetic-user');
  await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
    synced: 0, ranWithPermissions: false, completed: false, ...SKIPPED_OUTCOMES,
  });
  release(null);
  await expect(active).resolves.toEqual({ synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK });
  expect(storage.getItem).toHaveBeenCalledTimes(1);
});

describe('bounded exercise batches', () => {
  const rec = (id: unknown, endTime: string | null = '2026-09-29T10:30:00Z') => ({
    exerciseType: 0, metadata: { id }, startTime: '2026-09-29T10:00:00Z', endTime,
  });
  const many = (n: number, prefix = 'ex') => Array.from({ length: n }, (_, i) => rec(`${prefix}-${i}`));
  const insert = jest.fn();
  const inFn = jest.fn();
  const confirm = jest.fn();
  const eq = jest.fn();

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    insert.mockReset().mockResolvedValue({ error: null });
    inFn.mockReset().mockResolvedValue({ data: [], error: null });
    confirm.mockReset();
    eq.mockReset();
    const query = { eq, in: inFn, maybeSingle: confirm };
    eq.mockReturnValue(query);
    (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(query), insert });
  });

  const read = (records: unknown[]) => jest.mocked(readRecords<'ExerciseSession'>).mockResolvedValue({ records } as any);
  const setUser = (id: string | null) => (supabase.auth.getSession as jest.Mock)
    .mockResolvedValue({ data: { session: id ? { user: { id } } : null }, error: null });

  it('splits lookups and inserts into bounded batches and sums synced across them', async () => {
    read(many(230));
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 230 });
    expect(inFn).toHaveBeenCalledTimes(3);
    expect(inFn.mock.calls.every(c => c[1].length <= 100)).toBe(true);
    expect(insert.mock.calls.map(c => c[0].length)).toEqual([50, 50, 50, 50, 30]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps user and source filters on every lookup batch', async () => {
    read(many(150));
    await pollHealthConnect('synthetic-user');
    expect(inFn).toHaveBeenCalledTimes(2);
    expect(eq.mock.calls.filter(c => c[0] === 'user_id' && c[1] === 'synthetic-user')).toHaveLength(2);
    expect(eq.mock.calls.filter(c => c[0] === 'source' && c[1] === 'health_connect')).toHaveLength(2);
  });

  it('aggregates existing IDs from all lookup batches before inserting', async () => {
    read(many(150));
    inFn.mockResolvedValueOnce({ data: [{ external_activity_id: 'ex-3' }], error: null })
      .mockResolvedValueOnce({ data: [{ external_activity_id: 'ex-140' }], error: null });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 148 });
    const inserted = insert.mock.calls.flatMap(c => c[0].map((r: any) => r.external_activity_id));
    expect(inserted).not.toContain('ex-3');
    expect(inserted).not.toContain('ex-140');
  });

  it('deduplicates IDs repeated across native pages and ignores missing IDs', async () => {
    jest.mocked(readRecords<'ExerciseSession'>)
      .mockResolvedValueOnce({ records: [rec('a'), rec(undefined), rec(null)] as any, pageToken: 'p2' })
      .mockResolvedValueOnce({ records: [rec('a'), rec('b'), rec('')] as any });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 2 });
    expect(inFn).toHaveBeenCalledTimes(1);
    expect(inFn).toHaveBeenCalledWith('external_activity_id', ['a', 'b']);
    expect(insert.mock.calls[0][0].map((r: any) => r.external_activity_id)).toEqual(['a', 'b']);
  });

  it('imports a completed record that follows an unfinished duplicate of its ID', async () => {
    read([rec('dup', null), rec('dup'), rec('open-only', null)]);
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 1 });
    expect(inFn).toHaveBeenCalledWith('external_activity_id', ['dup']);
    expect(insert.mock.calls[0][0]).toEqual([expect.objectContaining({ external_activity_id: 'dup', duration_minutes: 30 })]);
  });

  it('never queries literal undefined or null IDs', async () => {
    read([rec(undefined), rec(null)]);
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('splits lookups by encoded length when counts are small', async () => {
    read(Array.from({ length: 12 }, (_, i) => rec(`${i}-${'é'.repeat(300)}`)));
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 12 });
    expect(inFn.mock.calls.length).toBeGreaterThan(1);
  });

  it('fails closed on an oversized ID: no writes, no cursor, not completed', async () => {
    read([rec('ok'), rec('x'.repeat(5000))]);
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(insert).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not write or advance the cursor when a later lookup fails', async () => {
    read(many(150));
    inFn.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(insert).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps earlier rows, stops writing and holds the cursor when a later insert fails', async () => {
    read(many(120));
    insert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: '42501', message: 'no' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 50 });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('retries a 23505 in a later batch individually without resetting the count', async () => {
    read(many(55));
    insert.mockResolvedValueOnce({ error: null })                // batch 1 (50 rows)
      .mockResolvedValueOnce({ error: { code: '23505' } })       // batch 2 (5 rows)
      .mockResolvedValueOnce({ error: { code: '23505' } })       // row ex-50 duplicate
      .mockResolvedValue({ error: null });                       // remaining rows
    confirm.mockResolvedValue({ data: { external_activity_id: 'ex-50' }, error: null });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: true, synced: 54 });
    expect(insert).toHaveBeenCalledTimes(2 + 5);
    expect(insert.mock.calls.slice(2).every(c => !Array.isArray(c[0]))).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('external_activity_id', 'ex-50');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('holds the cursor when a later-batch duplicate cannot be verified', async () => {
    read(many(51));
    insert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: '23505' } })
      .mockResolvedValueOnce({ error: { code: '23505' } });
    confirm.mockResolvedValue({ data: null, error: null });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 50 });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('stops after an account switch between insert batches and keeps the cursor', async () => {
    read(many(120));
    insert.mockImplementationOnce(async () => { setUser('someone-else'); return { error: null }; });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 50 });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('stops after an account switch between lookup batches before any insert', async () => {
    read(many(150));
    inFn.mockImplementationOnce(async () => { setUser(null); return { data: [], error: null }; });
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 0 });
    expect(inFn).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('writes batches sequentially, never in parallel', async () => {
    read(many(150));
    let active = 0; let maxActive = 0;
    insert.mockImplementation(async () => {
      maxActive = Math.max(maxActive, ++active);
      await new Promise(r => setTimeout(r, 0));
      active--;
      return { error: null };
    });
    await pollHealthConnect('synthetic-user');
    expect(maxActive).toBe(1);
  });

  it.each([
    ['non-duplicate error', { error: { code: 'NETWORK' } }, null],
    ['unverified duplicate', { error: { code: '23505' } }, { data: null, error: null }],
  ])('stops exercise writes after a per-row %s: no later row or batch, count kept, cursor held', async (_n, failure, verify) => {
    read(many(120));
    insert.mockResolvedValueOnce({ error: null })     // batch 1 (50 rows)
      .mockResolvedValueOnce({ error: { code: '23505' } }) // batch 2 conflict
      .mockResolvedValueOnce({ error: null })         // ex-50 ok
      .mockResolvedValueOnce(failure)                 // ex-51 fails
      .mockResolvedValue({ error: null });            // must never be reached
    if (verify) confirm.mockResolvedValue(verify);
    await expect(pollHealthConnect('synthetic-user')).resolves.toMatchObject({ completed: false, synced: 51 });
    expect(insert).toHaveBeenCalledTimes(4);
    const batches = insert.mock.calls.filter(c => Array.isArray(c[0]));
    const rows = insert.mock.calls.filter(c => !Array.isArray(c[0])).map(c => c[0].external_activity_id);
    expect(batches).toHaveLength(2);
    expect(rows).toEqual(['ex-50', 'ex-51']);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('per-type outcomes (additive contract)', () => {
  const insert = jest.fn();
  const update = jest.fn();
  const inFn = jest.fn();
  const confirm = jest.fn();
  const rec = (id: string) => ({
    exerciseType: 0, metadata: { id }, startTime: '2026-09-29T10:00:00Z', endTime: '2026-09-29T10:30:00Z',
  });
  const many = (n: number) => Array.from({ length: n }, (_, i) => rec(`ex-${i}`));
  const read = (records: unknown[]) => jest.mocked(readRecords<'ExerciseSession'>).mockResolvedValue({ records } as any);
  const steps = (total: number) => jest.mocked(aggregateRecord<'Steps'>).mockResolvedValue({ COUNT_TOTAL: total, dataOrigins: [] });
  const isStepsRow = (row: unknown) => !Array.isArray(row) && (row as { steps?: number }).steps !== undefined;
  const setUser = (id: string | null) => (supabase.auth.getSession as jest.Mock)
    .mockResolvedValue({ data: { session: id ? { user: { id } } : null }, error: null });
  const ok = (written: number, cursorAdvanced = true) => ({ status: 'ok', written, cursorAdvanced });
  const stepsOutcome = (status: string, written = 0, updated = false) => ({ status, written, updated });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    insert.mockReset().mockResolvedValue({ error: null });
    update.mockReset();
    inFn.mockReset().mockResolvedValue({ data: [], error: null });
    confirm.mockReset();
    const query = { eq: jest.fn(), in: inFn, maybeSingle: confirm };
    query.eq.mockReturnValue(query);
    const updateQuery = { eq: jest.fn() };
    updateQuery.eq.mockReturnValue(updateQuery);
    Object.assign(updateQuery, { then: (resolve: (v: unknown) => unknown) => resolve(update()) });
    update.mockReturnValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue(query), insert, update: jest.fn().mockReturnValue(updateQuery),
    });
  });

  it('absent Exercise permission: both types skipped, nothing read or written', async () => {
    jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }]);
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: false, completed: false, missingPermissions: ['ExerciseSession'], ...SKIPPED_OUTCOMES,
    });
    expect(readRecords).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('exercise-only grant: exercise ok, Steps skipped (never ok), completed unchanged', async () => {
    jest.mocked(getGrantedPermissions).mockResolvedValue([{ accessType: 'read', recordType: 'ExerciseSession' }]);
    read(many(2));
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 2, ranWithPermissions: true, completed: false, missingPermissions: ['Steps'],
      exercise: ok(2), steps: stepsOutcome('skipped'),
    });
    expect(aggregateRecord).not.toHaveBeenCalled();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('Steps aggregate failure after successful exercise: exercise ok, Steps failed', async () => {
    read(many(2));
    jest.mocked(aggregateRecord).mockRejectedValue(new Error('Aggregation unavailable'));
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 2, ranWithPermissions: true, completed: false, exercise: ok(2), steps: stepsOutcome('failed'),
    });
  });

  it('partial exercise batch failure with successful Steps keeps committed counts and holds the cursor', async () => {
    read(many(120));
    steps(500);
    insert.mockImplementation(async (row: unknown) => {
      if (isStepsRow(row)) return { error: null };
      return insert.mock.calls.filter(c => Array.isArray(c[0])).length === 2 ? { error: { code: '42501', message: 'no' } } : { error: null };
    });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 51, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed', written: 50, cursorAdvanced: false },
      steps: stepsOutcome('ok', 1),
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('empty successful window: exercise ok/0 and a zero aggregate is ok/0/false, not skipped', async () => {
    const result = await pollHealthConnect('synthetic-user');
    expect(result).toEqual({ synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('duplicate-only window: exercise ok/0 with no exercise write', async () => {
    read(many(2));
    inFn.mockResolvedValue({ data: [{ external_activity_id: 'ex-0' }, { external_activity_id: 'ex-1' }], error: null });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('successful Steps insert: written 1, updated false, counted in synced', async () => {
    steps(500);
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 1, ranWithPermissions: true, completed: true, exercise: ok(0), steps: stepsOutcome('ok', 1),
    });
  });

  it('Steps conflict update: written 0, updated true, not counted in synced', async () => {
    steps(500);
    insert.mockResolvedValue({ error: { code: '23505' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: true, exercise: ok(0), steps: stepsOutcome('ok', 0, true),
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('Steps update failure: failed, updated stays false, exercise unaffected', async () => {
    steps(500);
    insert.mockResolvedValue({ error: { code: '23505' } });
    update.mockReturnValue({ error: { message: 'Offline' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: false, exercise: ok(0), steps: stepsOutcome('failed'),
    });
  });

  it('Steps insert failure other than a conflict: failed with nothing written', async () => {
    steps(500);
    insert.mockResolvedValue({ error: { code: 'NETWORK', message: 'Failed' } });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: false, exercise: ok(0), steps: stepsOutcome('failed'),
    });
  });

  it('cursor save failure keeps committed counts but is not ok and not advanced', async () => {
    read(many(2));
    steps(500);
    storage.setItem.mockRejectedValueOnce(new Error('Disk full'));
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 3, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed', written: 2, cursorAdvanced: false }, steps: stepsOutcome('ok', 1),
    });
  });

  it('identity switch before Steps (during the exercise phase): Steps unattempted, no cursor', async () => {
    jest.mocked(readRecords<'ExerciseSession'>).mockImplementationOnce(async () => {
      setUser(null);
      return { records: [rec('late')] } as any;
    });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed', written: 0, cursorAdvanced: false }, steps: stepsOutcome('skipped'),
    });
    expect(aggregateRecord).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('identity switch during Steps: Steps failed with no Steps write, earlier exercise rows kept, no cursor', async () => {
    read(many(2));
    jest.mocked(aggregateRecord<'Steps'>).mockImplementationOnce(async () => {
      setUser('someone-else');
      return { COUNT_TOTAL: 500, dataOrigins: [] };
    });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 2, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed', written: 2, cursorAdvanced: false }, steps: stepsOutcome('failed'),
    });
    expect(insert.mock.calls.some(c => isStepsRow(c[0]))).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('identity switch during a zero-total Steps read: Steps ok/0 but the cursor is still not advanced', async () => {
    jest.mocked(aggregateRecord<'Steps'>).mockImplementationOnce(async () => {
      setUser(null);
      return { COUNT_TOTAL: 0, dataOrigins: [] };
    });
    await expect(pollHealthConnect('synthetic-user')).resolves.toEqual({
      synced: 0, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed', written: 0, cursorAdvanced: false }, steps: stepsOutcome('ok'),
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('a simultaneous skipped poll returns its own fresh outcome objects and cannot mutate another result', async () => {
    let release!: (value: string | null) => void;
    storage.getItem.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    const active = pollHealthConnect('synthetic-user');
    const skippedA = await pollHealthConnect('synthetic-user');
    const skippedB = await pollHealthConnect('synthetic-user');
    expect(skippedA).toEqual({ synced: 0, ranWithPermissions: false, completed: false, ...SKIPPED_OUTCOMES });
    expect(skippedA.exercise).not.toBe(skippedB.exercise);
    expect(skippedA.steps).not.toBe(skippedB.steps);
    skippedA.exercise!.written = 99;
    skippedA.steps!.updated = true;
    expect(skippedB).toEqual({ synced: 0, ranWithPermissions: false, completed: false, ...SKIPPED_OUTCOMES });
    release(null);
    const finished = await active;
    expect(finished).toEqual({ synced: 0, ranWithPermissions: true, completed: true, ...EMPTY_OK });
    expect(await pollHealthConnect('synthetic-user')).not.toBe(finished);
    const next = await pollHealthConnect('synthetic-user');
    expect(next.exercise).not.toBe(finished.exercise);
  });
});
