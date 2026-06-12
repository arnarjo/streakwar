/** Jest config — pure-logic tests only (no native modules, no supabase client). */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  clearMocks: true,
};
