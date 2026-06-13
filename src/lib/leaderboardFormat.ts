/**
 * Pure formatting helpers for leaderboard rows. Kept free of component/native
 * imports so they are unit-testable and reusable across leaderboard views.
 */

import { C } from '../theme';

/** Medal emoji for the top 3, otherwise "#N". */
export function medalOrRank(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

/** Accent colour for a rank (gold/silver/bronze, else muted). */
export function rankColor(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.muted;
}

/** Up to two uppercase initials from a display name (full name preferred). */
export function initials(entry: { full_name?: string | null; username: string }): string {
  const name = entry.full_name ?? entry.username;
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
