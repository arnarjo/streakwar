// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: [
      'scripts/build-hosted-test-baseline.cjs',
      'scripts/build-hosted-test-baseline.test.cjs',
      'scripts/private-health-schema.test.cjs',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', __filename: 'readonly' },
    },
  },
  {
    // Global ignores (config object containing only `ignores`)
    ignores: [
      'node_modules/**',
      'examples/**',
      'docs/**',
      'supabase/functions/**', // Deno runtime, not lintable with RN config
      '.claude/**',
      '.expo/**',
      'dist/**',
      'android/**',
      'ios/**',
    ],
  },
  {
    rules: {
      // React Compiler-era advisory rules — real cleanup targets, but the
      // pre-existing patterns are pervasive; keep them visible as warnings
      // so lint can gate CI on genuine errors today.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
