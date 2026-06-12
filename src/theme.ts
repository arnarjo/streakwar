/**
 * Shared color palette for the entire app.
 *
 * Every screen/component previously declared its own `const C = {...}` with
 * slight drift between files (e.g. muted '#637C8F' vs '#4A6070'). This is the
 * single source of truth — import `C` instead of redeclaring it.
 */
export const C = {
  /** App background */
  bg: '#0C1117',
  /** Card / surface background */
  card: '#151C24',
  /** Hairline borders on cards and inputs */
  border: 'rgba(255,255,255,0.07)',
  /** Focused input border */
  borderFocus: '#F97316',
  /** Dimmed fill (placeholders, disabled chips) */
  dimmed: '#1E2A35',
  /** Primary text */
  text: '#EEF4F8',
  /** Secondary / muted text */
  muted: '#4A6070',
  /** Brand orange */
  primary: '#F97316',
  /** Brand amber accent */
  secondary: '#FBBF24',
  /** Rank colors */
  gold: '#F59E0B',
  silver: '#9CA3AF',
  bronze: '#B45309',
  /** Status colors */
  green: '#22C55E',
  success: '#22C55E',
  error: '#EF4444',
  purple: '#8B5CF6',
} as const;
