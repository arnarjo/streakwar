import { supabase } from '../src/lib/supabase';
import { hasActiveHealthConnectConnection } from '../src/lib/healthConnectionConsent';

jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
const read = jest.fn();
const eq = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: null });
  const query = { eq, maybeSingle: read };
  eq.mockReturnValue(query);
  (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(query) });
});

it.each([null, { is_active: false }, { is_active: null }])('requires an explicitly active row: %j', async data => {
  read.mockResolvedValue({ data, error: null });
  await expect(hasActiveHealthConnectConnection('user-a')).resolves.toBe(false);
});

it('accepts only the current account health_connect row', async () => {
  read.mockResolvedValue({ data: { is_active: true }, error: null });
  await expect(hasActiveHealthConnectConnection('user-a')).resolves.toBe(true);
  expect(eq.mock.calls).toEqual([['user_id', 'user-a'], ['provider', 'health_connect']]);
});

it('does not use an active row if its lookup failed', async () => {
  read.mockResolvedValue({ data: { is_active: true }, error: new Error('Offline') });
  await expect(hasActiveHealthConnectConnection('user-a')).rejects.toThrow('Offline');
});

it('rejects an account switch during the lookup', async () => {
  read.mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'user-b' } } }, error: null });
    return { data: { is_active: true }, error: null };
  });
  await expect(hasActiveHealthConnectConnection('user-a')).rejects.toThrow('account changed');
});
