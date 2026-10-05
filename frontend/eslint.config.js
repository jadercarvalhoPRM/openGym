import globals from 'globals'
export default [
  { ignores: ['dist/**', 'android/**', 'ios/**', 'node_modules/**'] },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-args': 'error', 'no-dupe-keys': 'error', 'no-duplicate-case': 'error', 'no-const-assign': 'error', 'valid-typeof': 'error' },
  },
]
