import { PostgrestClient } from '@supabase/postgrest-js';
import {
  HC_INSERT_MAX_ROWS, HC_LOOKUP_MAX_FILTER_CHARS, HC_LOOKUP_MAX_IDS,
  HealthConnectIdTooLongError, chunk, completedSessionsById, encodedFilterCost, planLookupBatches,
} from '../src/lib/healthConnectBatching';

/** Encoded filter value exactly as the installed PostgrestClient serializes it (no network). */
function actualFilterLength(values: string[]): number {
  const builder: any = new PostgrestClient('http://localhost').from('workout_posts')
    .select('external_activity_id').eq('user_id', 'u').eq('source', 'health_connect')
    .in('external_activity_id', values);
  const prefix = 'external_activity_id=';
  const part = builder.url.search.slice(1).split('&').find((p: string) => p.startsWith(prefix));
  return (part as string).length - prefix.length;
}

const ids = (n: number, prefix = 'id') => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

describe('planLookupBatches', () => {
  it('splits by count and preserves every ID exactly once', () => {
    const all = ids(HC_LOOKUP_MAX_IDS * 2 + 1);
    const batches = planLookupBatches(all);
    expect(batches).toHaveLength(3);
    expect(batches.every(b => b.length <= HC_LOOKUP_MAX_IDS)).toBe(true);
    expect(batches.flat()).toEqual(all);
  });

  it('splits by encoded filter length before the count limit is reached', () => {
    const long = ids(20).map(id => `${id}-${'x'.repeat(480)}`);
    const batches = planLookupBatches(long);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(actualFilterLength(b)).toBeLessThanOrEqual(HC_LOOKUP_MAX_FILTER_CHARS);
    expect(batches.flat()).toEqual(long);
  });

  it('rejects non-positive or non-integer limits instead of looping forever', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => planLookupBatches(['a'], bad)).toThrow(RangeError);
      expect(() => planLookupBatches(['a'], 10, bad)).toThrow(RangeError);
      expect(() => chunk([1, 2], bad)).toThrow(RangeError);
    }
  });

  it('throws on a single oversized ID instead of dropping it', () => {
    expect(() => planLookupBatches(['ok', 'x'.repeat(HC_LOOKUP_MAX_FILTER_CHARS)]))
      .toThrow(HealthConnectIdTooLongError);
  });

  it('returns no batches for no IDs', () => {
    expect(planLookupBatches([])).toEqual([]);
  });
});

describe('estimator against the installed PostgrestClient URL', () => {
  const samples: Record<string, string> = {
    punctuation: "!'()~*-._",
    bangs: '!'.repeat(200),
    reserved: 'a,b.c:d(e)f"g',
    unicode: 'é日本語🏃',
    lone: 'a\ud800b',
    space: 'a b+c%d&e=f',
    plain: 'abc-123',
    empty: '',
  };

  it.each(Object.entries(samples))('never underestimates %s (single and combined)', (_n, id) => {
    expect(encodedFilterCost(id) + 9).toBeGreaterThanOrEqual(actualFilterLength([id]));
  });

  it('never underestimates a mixed batch', () => {
    const all = Object.values(samples).filter(Boolean);
    const estimate = 9 + all.reduce((n, id) => n + encodedFilterCost(id), 0);
    expect(estimate).toBeGreaterThanOrEqual(actualFilterLength(all));
  });

  it('plans the exclamation-mark case that was previously underestimated', () => {
    const id = '!'.repeat(3990);
    expect(actualFilterLength([id])).toBeGreaterThan(HC_LOOKUP_MAX_FILTER_CHARS);
    expect(() => planLookupBatches([id])).toThrow(HealthConnectIdTooLongError);
  });

  it.each(Object.entries({ bang: '!', unicode: 'é', emoji: '🏃', plain: 'x' }))(
    'keeps every planned %s batch within the real encoded budget',
    (_n, unit) => {
      const items = Array.from({ length: 150 }, (_, i) => `${i}${unit.repeat(120)}`);
      const batches = planLookupBatches(items);
      expect(batches.flat()).toEqual(items);
      for (const b of batches) {
        expect(b.length).toBeLessThanOrEqual(HC_LOOKUP_MAX_IDS);
        expect(actualFilterLength(b)).toBeLessThanOrEqual(HC_LOOKUP_MAX_FILTER_CHARS);
      }
    },
  );

  it('accepts a single ID exactly at the budget and rejects one byte more', () => {
    const fit = 'x'.repeat(1000);
    const budget = encodedFilterCost(fit) + 9;
    expect(budget).toBe(3018);
    expect(planLookupBatches([fit], 100, budget)).toEqual([[fit]]);
    expect(actualFilterLength([fit])).toBeLessThanOrEqual(budget);
    expect(() => planLookupBatches([fit], 100, budget - 1)).toThrow(HealthConnectIdTooLongError);
    expect(() => planLookupBatches([fit + 'x'], 100, budget)).toThrow(HealthConnectIdTooLongError);
  });

  it('splits exactly at the count and char boundaries', () => {
    expect(planLookupBatches(ids(HC_LOOKUP_MAX_IDS)).map(b => b.length)).toEqual([HC_LOOKUP_MAX_IDS]);
    expect(planLookupBatches(ids(HC_LOOKUP_MAX_IDS + 1)).map(b => b.length)).toEqual([HC_LOOKUP_MAX_IDS, 1]);
    const two = ['a'.repeat(100), 'b'.repeat(100)];
    const budget = 9 + two.reduce((n, id) => n + encodedFilterCost(id), 0);
    expect(planLookupBatches(two, 100, budget)).toEqual([two]);
    expect(actualFilterLength(two)).toBeLessThanOrEqual(budget);
    expect(planLookupBatches(two, 100, budget - 1)).toEqual([[two[0]], [two[1]]]);
  });
});

describe('chunk', () => {
  it('bounds rows per batch', () => {
    const out = chunk(ids(HC_INSERT_MAX_ROWS * 2 + 3));
    expect(out.map(b => b.length)).toEqual([HC_INSERT_MAX_ROWS, HC_INSERT_MAX_ROWS, 3]);
  });
});

describe('completedSessionsById', () => {
  const s = (id: unknown, endTime?: string, tag = '') => ({ metadata: { id }, endTime, tag });

  it('ignores missing IDs, non-string IDs and unfinished sessions', () => {
    const out = completedSessionsById([
      s(undefined, 'e'), s(null, 'e'), s('', 'e'), s(42, 'e'), s('open'), { endTime: 'e' } as any, s('ok', 'e'),
    ]);
    expect([...out.keys()]).toEqual(['ok']);
  });

  it('keeps a completed record that follows an unfinished duplicate', () => {
    const out = completedSessionsById([s('dup', undefined, 'open'), s('dup', 'e', 'done')]);
    expect(out.get('dup')?.tag).toBe('done');
  });

  it('deduplicates repeated completed IDs, first seen wins', () => {
    const out = completedSessionsById([s('dup', 'e', 'first'), s('dup', 'e', 'second')]);
    expect([...out.keys()]).toEqual(['dup']);
    expect(out.get('dup')?.tag).toBe('first');
  });
});
