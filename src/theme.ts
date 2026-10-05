/**
 * Shared color palette for the entire app.
 *
 * Every screen/component previously declared its own `const C = {...}` with
 * slight drift between files. This is the single source of truth — import `C`
 * instead of redeclaring it.
 *
 * Direction: charcoal surfaces, off-white text, orange used sparingly for the
 * one primary action or active state on a screen. Every text token (text,
 * muted, primary, secondary, error, green, success, gold, silver, bronze,
 * purple) keeps at least 4.5:1 contrast on bg, card and dimmed; this is
 * asserted in tests/uiRefresh.test.tsx.
 */
export const C = {
  /** App background */
  bg: '#0E1013',
  /** Card / surface background */
  card: '#16191E',
  /** Hairline borders on cards and inputs */
  border: 'rgba(255,255,255,0.10)',
  /** Focused input border */
  borderFocus: '#F97316',
  /** Dimmed fill (placeholders, disabled chips, inset values) */
  dimmed: '#21252C',
  /** Primary text (off-white) */
  text: '#F3F0EA',
  /** Secondary / muted text */
  muted: '#A3ABB5',
  /** Brand orange: primary action and active state only */
  primary: '#F97316',
  /** Text/icon color on top of a primary (orange) fill */
  onPrimary: '#14110F',
  /** Brand amber accent */
  secondary: '#FBBF24',
  /** Rank colors */
  gold: '#F59E0B',
  silver: '#A8B0BA',
  bronze: '#D08A4C',
  /** Status colors */
  green: '#22C55E',
  success: '#22C55E',
  error: '#F87171',
  purple: '#A78BFA',
} as const;

/** Shared layout scale. */
export const R = {
  /** Controls and small tiles */
  sm: 8,
  /** Cards */
  md: 12,
} as const;

/** Minimum touch target (dp) for every pressable control. */
export const HIT = 44;
