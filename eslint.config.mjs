// @ts-check
import eslint from '@eslint/js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  {
    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2022,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
