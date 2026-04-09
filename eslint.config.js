import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'backups/', 'logs/', 'dist/'] },

  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.es2021 }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-case-declarations': 'warn',
      'no-prototype-builtins': 'warn',
      'no-control-regex': 'warn'
    }
  },

  {
    files: ['src/**/*.js', 'server.js', 'scripts/**/*.js', 'ecosystem.config.cjs'],
    languageOptions: { globals: { ...globals.node } }
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } }
  },

  {
    files: ['tests/frontend/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-undef': 'off' }
  },

  {
    files: ['public/js/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'no-undef': 'off' }
  }
];
