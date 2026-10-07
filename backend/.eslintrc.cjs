module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.js'],
  rules: {
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [{
    files: ['*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  }],
};
