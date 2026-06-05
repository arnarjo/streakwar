/**
 * Tests for applyStreakDecay freeze protection logic.
 *
 * applyStreakDecay(data: UserStreak):
 *   - Returns data unchanged if last_active_date >= yesterday (still active)
 *   - Checks streak_freeze_uses for a row matching today's date
 *     - If found (freeze already used today): resets streak to 0
 *   - If no row today: calls rpc('use_streak_freeze', { p_user_id })
 *     - If rpc returns truthy: freeze consumed, streak preserved
 *     - If rpc returns null/error: resets streak to 0
 */

// jest.mock calls are hoisted — use jest.fn() inline, not outer variables
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../lib/streakNotification', () => ({
  scheduleStreakReminder: jest.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { applyStreakDecay } from '../hooks/useStreaks';
import type { UserStreak } from '../types/database';

const mockFrom = supabase.from as jest.Mock;
const mockRpc  = supabase.rpc  as jest.Mock;

const BASE_STREAK: UserStreak = {
  user_id: 'user-123',
  current_streak: 10,
  longest_streak: 20,
  last_active_date: '2026-06-02', // 2 days before fixed "today" — decay territory
  updated_at: '2026-06-02T00:00:00Z',
};

function makeChain(maybySingleResult: object) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(maybySingleResult),
    update: jest.fn().mockReturnThis(),
  };
  return chain;
}

describe('applyStreakDecay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix "today" to 2026-06-04
    jest.useFakeTimers().setSystemTime(new Date('2026-06-04T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('returns data unchanged when user was active yesterday', async () => {
    const activeData: UserStreak = { ...BASE_STREAK, last_active_date: '2026-06-03' };
    const result = await applyStreakDecay(activeData);
    expect(result).toBe(activeData);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('consumes a streak freeze and preserves streak when freeze available', async () => {
    // No freeze used today (maybySingle returns null)
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    // user_streaks update chain for potential reset — shouldn't be called
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });
    // RPC succeeds — freeze consumed
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await applyStreakDecay(BASE_STREAK);

    expect(mockRpc).toHaveBeenCalledWith('use_streak_freeze', { p_user_id: 'user-123' });
    expect(result.current_streak).toBe(10);
  });

  it('resets streak to 0 when no freeze available', async () => {
    // No freeze used today
    const eqMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null })) // streak_freeze_uses check
      .mockReturnValueOnce({                                        // user_streaks update
        update: jest.fn().mockReturnValue({ eq: eqMock }),
      });
    // RPC returns null — no freeze credits
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await applyStreakDecay(BASE_STREAK);

    expect(result.current_streak).toBe(0);
    expect(eqMock).toHaveBeenCalled();
  });
});
