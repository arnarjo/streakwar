// src/theme.ts — centralized design tokens for StreakWar

export const C = {
  bg:          '#0C1117',
  card:        '#151C24',
  cardAlt:     '#1A2332',
  surface:     '#1E2A35',
  border:      'rgba(255,255,255,0.07)',
  borderAlt:   'rgba(255,255,255,0.08)',
  text:        '#EEF4F8',
  text2:       'rgba(255,255,255,0.55)',
  muted:       '#637C8F',
  muted2:      '#4A6070',
  dimmed:      '#1E2A35',
  primary:     '#F97316',
  primaryDark: '#EA580C',
  success:     '#22C55E',
  error:       '#EF4444',
  warning:     '#F59E0B',
  info:        '#3B82F6',
  gold:        '#F59E0B',
  silver:      '#9CA3AF',
  bronze:      '#B45309',
  purple:      '#8B5CF6',
} as const;

/** Convert hex color to rgba with given alpha (0–1) */
export const a = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const F = {
  disp:   'Inter_800ExtraBold',
  bold:   'Inter_700Bold',
  medium: 'Inter_500Medium',
  ui:     'Inter_400Regular',
} as const;

export const RADIUS = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   24,
  pill: 999,
} as const;
