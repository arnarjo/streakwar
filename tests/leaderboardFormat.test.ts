import { medalOrRank, rankColor, initials } from '../src/lib/leaderboardFormat';

describe('medalOrRank', () => {
  it('returns medals for the top 3', () => {
    expect(medalOrRank(1)).toBe('🥇');
    expect(medalOrRank(2)).toBe('🥈');
    expect(medalOrRank(3)).toBe('🥉');
  });
  it('returns #N for rank 4 and beyond', () => {
    expect(medalOrRank(4)).toBe('#4');
    expect(medalOrRank(57)).toBe('#57');
  });
});

describe('rankColor', () => {
  it('gives distinct colours for the top 3 and a muted default', () => {
    expect(rankColor(1)).not.toBe(rankColor(4));
    expect(rankColor(2)).not.toBe(rankColor(3));
    expect(rankColor(10)).toBe(rankColor(99)); // both muted
  });
});

describe('initials', () => {
  it('prefers full name and returns up to two uppercase initials', () => {
    expect(initials({ full_name: 'Arnar Johann', username: 'arnar' })).toBe('AJ');
    expect(initials({ full_name: 'madonna', username: 'm' })).toBe('M');
  });
  it('falls back to username when full name is missing', () => {
    expect(initials({ full_name: null, username: 'sara' })).toBe('S');
    expect(initials({ username: 'kata bjorns' } as { username: string })).toBe('KB');
  });
});
