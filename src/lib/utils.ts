export function getInitials(name?: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0] ?? '').filter(Boolean).join('').slice(0, 2).toUpperCase();
}

/**
 * Calculates challenge points for a single workout.
 * Single source of truth — used in WeeklyRecapScreen and anywhere points are displayed.
 */
export function calculatePoints(workout: {
  steps?: number | null;
  distance_km?: number | null;
  duration_minutes?: number | null;
}): number {
  return (
    1 // base point per workout
    + Math.floor((workout.steps ?? 0) / 1000)
    + Math.floor(workout.distance_km ?? 0)
    + Math.floor((workout.duration_minutes ?? 0) / 30)
  );
}
