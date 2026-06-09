import { C } from '../theme';

export function medalOrRank(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function rankColor(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.muted;
}
