// Single source of truth for design tokens

// Colors
export const C = {
  bg: '#0C1117',
  card: '#151C24',
  card2: '#1A2332',
  border: '#1E2A35',
  primary: '#F97316',
  secondary: '#FBBF24',
  amber: '#FBBF24',
  green: '#22C55E',
  blue: '#38BDF8',
  error: '#EF4444',
  text: '#E8EFF5',
  muted: '#637C8F',
  dimmed: '#1E2A35',
  borderFocus: '#F97316',
  gold: '#F59E0B',
  silver: '#9CA3AF',
  bronze: '#B45309',
};

// Spacing scale (base 4px)
export const S = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48,
};

// Border radius scale
export const R = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, full: 999,
};

// Font sizes
export const FS = {
  xs: 10, sm: 12, md: 14, lg: 16, xl: 18, '2xl': 22, '3xl': 28, '4xl': 38, hero: 64,
};

// Font family constants (Saira loaded via useFonts in App.tsx)
export const F = {
  ui: 'Saira_400Regular',
  uiBold: 'Saira_700Bold',
  uiHeavy: 'Saira_800ExtraBold',
  disp: 'SairaCondensed_700Bold',
  dispHeavy: 'SairaCondensed_800ExtraBold',
};
