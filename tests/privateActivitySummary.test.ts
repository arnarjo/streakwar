import { act, createElement, useEffect, type ReactElement } from 'react';
import { supabase } from '../src/lib/supabase';
import {
  usePrivateActivitySummary,
  parsePrivateActivitySummary,
  type PrivateActivitySummaryState,
} from '../src/hooks/usePrivateActivitySummary';
import PrivateActivitySummaryCard, {
  PRIVATE_ACTIVITY_NOTICE, PRIVATE_ACTIVITY_REFRESH_LABEL, PRIVATE_ACTIVITY_RETRY_LABEL, PRIVATE_ACTIVITY_TITLE,
} from '../src/components/PrivateActivitySummaryCard';

// Real hook and real card; only the Supabase client and RN primitives are faked.
jest.mock('react-native', () => {
  const { createElement: h } = jest.requireActual('react');
  const host = (name: string) => ({ children, ...props }: { children?: unknown }) => h(name, props, children);
  return {
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    View: host('View'), Text: host('Text'), TouchableOpacity: host('TouchableOpacity'),
    ActivityIndicator: host('ActivityIndicator'),
  };
});
jest.mock('../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

type Node = { type: unknown; props: Record<string, unknown>; findAll(predicate: (node: Node) => boolean): Node[] };
type Tree = { root: Node; toJSON(): unknown; unmount(): void; update(element: ReactElement): void };
const renderer = jest.requireActual<{ create(element: ReactElement): Tree }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
const rpc = supabase.rpc as unknown as jest.Mock;

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const row = (owner: string, count: unknown, points: unknown, steps: unknown = 0) =>
  ({ data: [{ owner_id: owner, activity_count: count, personal_points: points, total_steps: steps }], error: null });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
type RpcResult = ReturnType<typeof row> | { data: unknown; error: unknown };

let spies: jest.SpyInstance[];
beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(() => {
  rpc.mockReset();
  spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => jest.spyOn(console, m).mockImplementation(() => undefined));
});
afterEach(() => {
  // Neither warnings (e.g. state updates after unmount) nor any logging of data/errors is acceptable.
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  spies.forEach(spy => spy.mockRestore());
});

// ── hook harness ─────────────────────────────────────────────────────────────
type Props = { userId: string; token?: string | number | boolean };
let renders: { userId: string; state: PrivateActivitySummaryState }[];
let latest: PrivateActivitySummaryState;
function Harness({ userId, token }: Props) {
  const state = usePrivateActivitySummary(userId, token);
  renders.push({ userId, state });
  useEffect(() => { latest = state; });
  return null;
}
let tree: Tree;
async function mountHook(props: Props) {
  renders = [];
  await act(async () => { tree = renderer.create(createElement(Harness, props)); });
}
const rerender = (props: Props) => act(async () => { tree.update(createElement(Harness, props)); });
const settle = (d: { resolve(v: RpcResult): void }, value: RpcResult) => act(async () => { d.resolve(value); });
afterEach(() => { act(() => { try { tree?.unmount(); } catch { /* already unmounted */ } }); });

describe('usePrivateActivitySummary', () => {
  it('rejects an old refresh handle after A -> B -> A', async () => {
    rpc.mockResolvedValue(row(A, 1, 2));
    await mountHook({ userId: A });
    const oldRefresh = latest.refresh;
    rpc.mockResolvedValue(row(B, 1, 2));
    await rerender({ userId: B });
    rpc.mockResolvedValue(row(A, 1, 2));
    await rerender({ userId: A });
    const calls = rpc.mock.calls.length;
    await act(async () => { oldRefresh(); });
    expect(rpc).toHaveBeenCalledTimes(calls);
  });

  it('rejects a refresh handle from an obsolete token for the same owner', async () => {
    rpc.mockResolvedValue(row(A, 1, 2));
    await mountHook({ userId: A, token: 1 });
    const oldRefresh = latest.refresh;
    await rerender({ userId: A, token: 2 });
    const calls = rpc.mock.calls.length;
    await act(async () => { oldRefresh(); });
    expect(rpc).toHaveBeenCalledTimes(calls);
    expect(latest.refreshing).toBe(false);
  });

  it('requests with no arguments and exposes a validated summary', async () => {
    const d = deferred<RpcResult>();
    rpc.mockReturnValue(d.promise);
    await mountHook({ userId: A });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(['get_my_private_activity_summary']);
    expect(latest).toMatchObject({ status: 'loading', summary: null, refreshing: false });
    await settle(d, row(A, 3, 12, 4500));
    expect(latest).toMatchObject({ status: 'ready', summary: { activityCount: 3, personalPoints: 12, totalSteps: 4500 }, refreshing: false });
  });

  it('accepts bigint decimal strings and zero without treating them as errors', async () => {
    rpc.mockResolvedValue(row(A, '42', '7', '9007199254740991'));
    await mountHook({ userId: A });
    expect(latest.summary).toEqual({ activityCount: 42, personalPoints: 7, totalSteps: 9007199254740991 });
    rpc.mockResolvedValue(row(A, '0', 0, '0'));
    await rerender({ userId: A, token: 1 });
    expect(latest).toMatchObject({ status: 'ready', summary: { activityCount: 0, personalPoints: 0, totalSteps: 0 } });
  });

  it.each<[string, RpcResult]>([
    ['rpc error', { data: null, error: { message: 'secret detail', code: '42501' } }],
    ['null data', { data: null, error: null }],
    ['not an array', { data: { owner_id: A }, error: null }],
    ['empty array', { data: [], error: null }],
    ['two rows', { data: [row(A, 1, 1).data[0], row(A, 1, 1).data[0]], error: null }],
    ['null row', { data: [null], error: null }],
    ['owner mismatch', row(B, 1, 1)],
    ['missing owner', { data: [{ activity_count: 1, personal_points: 1, total_steps: 1 }], error: null }],
    ['numeric owner', row(7 as unknown as string, 1, 1)],
    ['missing count', { data: [{ owner_id: A, personal_points: 1, total_steps: 1 }], error: null }],
    ['null points', row(A, 1, null)],
    ['negative', row(A, -1, 1)],
    ['negative string', row(A, '-1', 1)],
    ['fractional', row(A, 1.5, 1)],
    ['fractional string', row(A, '1.5', 1)],
    ['exponent string', row(A, '1e3', 1)],
    ['padded string', row(A, ' 1', 1)],
    ['leading zero string', row(A, '01', 1)],
    ['empty string', row(A, '', 1)],
    ['NaN', row(A, 1, Number.NaN)],
    ['Infinity', row(A, 1, Number.POSITIVE_INFINITY)],
    ['unsafe number', row(A, 1, 2 ** 53)],
    ['unsafe string', row(A, 1, '9007199254740992')],
    ['boolean', row(A, true, 1)],
    ['bigint-like object', row(A, { n: 1 }, 1)],
  ])('shows a retryable error, never zero success: %s', async (_name, result) => {
    rpc.mockResolvedValue(result);
    await mountHook({ userId: A });
    expect(latest).toMatchObject({ status: 'error', summary: null, refreshing: false });
    rpc.mockResolvedValue(row(A, 2, 5));
    await act(async () => { latest.refresh(); });
    expect(latest).toMatchObject({ status: 'ready', summary: { activityCount: 2, personalPoints: 5, totalSteps: 0 } });
  });

  it('treats a rejected request as a retryable error', async () => {
    const d = deferred<RpcResult>();
    rpc.mockReturnValueOnce(d.promise);
    await mountHook({ userId: A });
    await act(async () => { d.reject(new Error('network down: secret')); });
    expect(latest).toMatchObject({ status: 'error', summary: null });
    rpc.mockResolvedValue(row(A, 1, 1));
    await act(async () => { latest.refresh(); });
    expect(latest.status).toBe('ready');
  });

  it('parser requires the exact requested owner', () => {
    expect(parsePrivateActivitySummary(row(A, 1, 2, 3).data, A)).toEqual({ activityCount: 1, personalPoints: 2, totalSteps: 3 });
    expect(parsePrivateActivitySummary(row(A, 1, 2, 3).data, B)).toBeNull();
  });

  it('does not request when signed out and reports idle', async () => {
    await mountHook({ userId: '' });
    expect(rpc).not.toHaveBeenCalled();
    expect(latest).toMatchObject({ status: 'idle', summary: null });
    await act(async () => { latest.refresh(); });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('hides account A state in the same render when the user becomes B, and never shows it under B', async () => {
    rpc.mockResolvedValueOnce(row(A, 5, 50, 1000));
    await mountHook({ userId: A });
    expect(latest.summary?.personalPoints).toBe(50);
    const d = deferred<RpcResult>();
    rpc.mockReturnValueOnce(d.promise);
    await rerender({ userId: B });
    for (const r of renders.filter(x => x.userId === B)) {
      expect(r.state.summary).toBeNull();
      expect(r.state.status).toBe('loading');
    }
    await settle(d, row(B, 1, 3));
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 3 } });
  });

  it('an old response arriving after A -> B is ignored', async () => {
    const dA = deferred<RpcResult>();
    const dB = deferred<RpcResult>();
    rpc.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise);
    await mountHook({ userId: A });
    await rerender({ userId: B });
    await settle(dA, row(A, 9, 99));
    expect(latest).toMatchObject({ status: 'loading', summary: null });
    await settle(dB, row(B, 1, 3));
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 3 } });
  });

  it('A -> B -> A: both older requests are ignored; only the newest A request applies', async () => {
    const a1 = deferred<RpcResult>();
    const b = deferred<RpcResult>();
    const a2 = deferred<RpcResult>();
    rpc.mockReturnValueOnce(a1.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(a2.promise);
    await mountHook({ userId: A });
    await rerender({ userId: B });
    await rerender({ userId: A });
    await settle(a1, row(A, 1, 111));
    expect(latest).toMatchObject({ status: 'loading', summary: null });
    await settle(b, row(B, 1, 222));
    expect(latest).toMatchObject({ status: 'loading', summary: null });
    await settle(a2, row(A, 1, 333));
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 333 } });
    for (const r of renders) expect(r.state.summary?.personalPoints ?? 333).toBe(333);
  });

  it('rejects another session user\'s rows returned for the requested user', async () => {
    rpc.mockResolvedValueOnce(row(A, 5, 50));
    await mountHook({ userId: A });
    rpc.mockResolvedValueOnce(row(A, 5, 50)); // session already is B; server answers with A's owner id
    await rerender({ userId: B });
    expect(latest).toMatchObject({ status: 'error', summary: null });
    for (const r of renders.filter(x => x.userId === B)) expect(r.state.summary).toBeNull();
  });

  it('logout hides the summary immediately and ignores the pending response', async () => {
    const d = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 5, 50)).mockReturnValueOnce(d.promise);
    await mountHook({ userId: A });
    await act(async () => { latest.refresh(); });
    await rerender({ userId: '' });
    expect(renders[renders.length - 1].state).toMatchObject({ status: 'idle', summary: null });
    await settle(d, row(A, 1, 1));
    expect(latest).toMatchObject({ status: 'idle', summary: null });
  });

  it('a response ignored after logout never resurfaces when the same user signs in again', async () => {
    const old = deferred<RpcResult>();
    const fresh = deferred<RpcResult>();
    rpc.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    await mountHook({ userId: A });
    await rerender({ userId: '' });
    await settle(old, row(A, 9, 999));
    await rerender({ userId: A });
    expect(latest).toMatchObject({ status: 'loading', summary: null });
    for (const r of renders) expect(r.state.summary).toBeNull();
    await settle(fresh, row(A, 1, 5));
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 5 } });
  });

  it('a stale refresh handle from an old account cannot start a request', async () => {
    rpc.mockResolvedValue(row(A, 1, 1));
    await mountHook({ userId: A });
    const oldRefresh = latest.refresh;
    rpc.mockResolvedValue(row(B, 1, 2));
    await rerender({ userId: B });
    rpc.mockClear();
    await act(async () => { oldRefresh(); });
    expect(rpc).not.toHaveBeenCalled();
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 2 } });
  });

  it('unmount invalidates the request: no state update, no warning', async () => {
    const d = deferred<RpcResult>();
    rpc.mockReturnValueOnce(d.promise);
    await mountHook({ userId: A });
    const before = renders.length;
    act(() => { tree.unmount(); });
    await settle(d, row(A, 1, 1));
    expect(renders.length).toBe(before);
  });

  it('competing refreshes: the newest wins even when an older one finishes last', async () => {
    const first = deferred<RpcResult>();
    const second = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 1, 10)).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mountHook({ userId: A });
    await act(async () => { latest.refresh(); });
    await act(async () => { latest.refresh(); });
    expect(latest).toMatchObject({ status: 'ready', refreshing: true, summary: { personalPoints: 10 } });
    await settle(second, row(A, 3, 30));
    expect(latest).toMatchObject({ status: 'ready', refreshing: false, summary: { personalPoints: 30 } });
    await settle(first, row(A, 2, 20));
    expect(latest.summary?.personalPoints).toBe(30);
  });

  it('a failed older refresh cannot overwrite a newer success', async () => {
    const first = deferred<RpcResult>();
    const second = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 1, 10)).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mountHook({ userId: A });
    await act(async () => { latest.refresh(); });
    await act(async () => { latest.refresh(); });
    await settle(second, row(A, 3, 30));
    await act(async () => { first.reject(new Error('late failure')); });
    expect(latest).toMatchObject({ status: 'ready', summary: { personalPoints: 30 } });
  });

  it('a new refreshToken reloads the same owner and keeps its own summary while refreshing; the same token does not', async () => {
    const d = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 1, 10)).mockReturnValueOnce(d.promise);
    await mountHook({ userId: A, token: 1 });
    await rerender({ userId: A, token: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    await rerender({ userId: A, token: 2 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(latest).toMatchObject({ status: 'ready', refreshing: true, summary: { personalPoints: 10 } });
    await settle(d, row(A, 2, 20));
    expect(latest).toMatchObject({ refreshing: false, summary: { personalPoints: 20 } });
  });

  it('a failed refresh drops the previous numbers instead of presenting them as current', async () => {
    rpc.mockResolvedValueOnce(row(A, 1, 10)).mockResolvedValueOnce({ data: null, error: { code: 'x' } });
    await mountHook({ userId: A });
    await act(async () => { latest.refresh(); });
    expect(latest).toMatchObject({ status: 'error', summary: null });
  });
});

// ── real card ────────────────────────────────────────────────────────────────
const text = (node: Node): string => node.findAll(n => n.type === 'Text')
  .map(n => [n.props.children].flat(Infinity).filter(c => typeof c === 'string').join('')).join('\n');
const buttons = (t: Tree) => t.root.findAll(n => n.type === 'TouchableOpacity' && typeof n.props.onPress === 'function');
const buttonByLabel = (t: Tree, label: string) => {
  const hit = buttons(t).find(n => n.props.accessibilityLabel === label);
  if (!hit) throw new Error(`no button ${label}`);
  return hit;
};
const press = (node: Node) => act(async () => { await (node.props.onPress as () => unknown)(); });
const card = (props: Props) => createElement(PrivateActivitySummaryCard, { userId: props.userId, refreshToken: props.token });
async function mountCard(props: Props) {
  await act(async () => { tree = renderer.create(card(props)); });
}

describe('PrivateActivitySummaryCard', () => {
  it('shows loading with the privacy notice and no numbers', async () => {
    rpc.mockReturnValue(new Promise(() => undefined));
    await mountCard({ userId: A });
    const t = text(tree.root);
    expect(t).toContain(PRIVATE_ACTIVITY_TITLE);
    expect(t).toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(t).toContain('Loading private activity');
    expect(tree.root.findAll(n => n.type === 'ActivityIndicator')).toHaveLength(1);
    expect(buttons(tree)).toHaveLength(0);
  });

  it('shows personal points and "Imported records", not workouts, with an accessible refresh button', async () => {
    rpc.mockResolvedValue(row(A, '1234', 5678, 100));
    await mountCard({ userId: A });
    const t = text(tree.root);
    expect(t).toContain(PRIVATE_ACTIVITY_TITLE);
    expect(t).toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(t).toContain('Personal points');
    expect(t).toContain('5,678');
    expect(t).toContain('Imported records');
    expect(t).toContain('1,234');
    expect(t).not.toMatch(/workout/i);
    const refresh = buttonByLabel(tree, PRIVATE_ACTIVITY_REFRESH_LABEL);
    expect(refresh.props.accessibilityRole).toBe('button');
  });

  it('says the totals cover all imported history and keeps controls at least 44dp tall', async () => {
    rpc.mockResolvedValue(row(A, 4, 9, 100));
    await mountCard({ userId: A });
    expect(text(tree.root)).toContain('Totals cover everything imported from Health Connect so far, not just today or this week.');
    expect(text(tree.root)).not.toMatch(/workout/i);
    const refresh = buttonByLabel(tree, PRIVATE_ACTIVITY_REFRESH_LABEL);
    expect((refresh.props.style as { minHeight: number }[]).flat().find(x => x && x.minHeight)?.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('shows an empty state that points to Health Connect without any navigation', async () => {
    rpc.mockResolvedValue(row(A, 0, 0, 0));
    await mountCard({ userId: A });
    const t = text(tree.root);
    expect(t).toContain('Connect Health Connect');
    expect(t).toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(t).not.toContain('Personal points');
    expect(buttons(tree).map(n => n.props.accessibilityLabel)).toEqual([PRIVATE_ACTIVITY_REFRESH_LABEL]);
  });

  it('shows a retryable error (not zeros) for malformed data and recovers on retry', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await mountCard({ userId: A });
    let t = text(tree.root);
    expect(t).toContain('Could not load your private activity.');
    expect(t).not.toContain('Personal points');
    expect(t).not.toContain('Imported records');
    rpc.mockResolvedValueOnce(row(A, 2, 8));
    await press(buttonByLabel(tree, PRIVATE_ACTIVITY_RETRY_LABEL));
    t = text(tree.root);
    expect(t).toContain('Personal points');
    expect(t).not.toContain('Could not load');
  });

  it('disables refresh while refreshing and re-enables it afterwards', async () => {
    const d = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 1, 1)).mockReturnValueOnce(d.promise);
    await mountCard({ userId: A });
    await press(buttonByLabel(tree, PRIVATE_ACTIVITY_REFRESH_LABEL));
    let refresh = buttonByLabel(tree, PRIVATE_ACTIVITY_REFRESH_LABEL);
    expect(refresh.props.disabled).toBe(true);
    expect(text(tree.root)).toContain('Refreshing');
    await settle(d, row(A, 4, 9));
    refresh = buttonByLabel(tree, PRIVATE_ACTIVITY_REFRESH_LABEL);
    expect(refresh.props.disabled).toBe(false);
    expect(text(tree.root)).toContain('9');
  });

  it('account switch hides A\'s numbers at once and never shows them under B', async () => {
    const d = deferred<RpcResult>();
    rpc.mockResolvedValueOnce(row(A, 7, 777)).mockReturnValueOnce(d.promise);
    await mountCard({ userId: A });
    expect(text(tree.root)).toContain('777');
    await act(async () => { tree.update(card({ userId: B })); });
    expect(text(tree.root)).not.toContain('777');
    expect(text(tree.root)).toContain('Loading private activity');
    await settle(d, row(B, 1, 5));
    expect(text(tree.root)).not.toContain('777');
    expect(text(tree.root)).toContain('Personal points');
  });

  it('renders nothing after logout and stays empty when the old response arrives', async () => {
    const d = deferred<RpcResult>();
    rpc.mockReturnValueOnce(d.promise);
    await mountCard({ userId: A });
    await act(async () => { tree.update(card({ userId: '' })); });
    expect(tree.toJSON()).toBeNull();
    await settle(d, row(A, 3, 30));
    expect(tree.toJSON()).toBeNull();
  });

  it('refreshToken drives a reload of the same card', async () => {
    rpc.mockResolvedValueOnce(row(A, 1, 10)).mockResolvedValueOnce(row(A, 2, 20));
    await mountCard({ userId: A, token: 'a' });
    expect(text(tree.root)).toContain('10');
    await act(async () => { tree.update(card({ userId: A, token: 'b' })); });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(text(tree.root)).toContain('20');
  });
});
