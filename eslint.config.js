const js = require('@eslint/js')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactPlugin = require('eslint-plugin-react')
const reactHooksPlugin = require('eslint-plugin-react-hooks')

const globals = {
  AbortSignal: 'readonly',
  Buffer: 'readonly',
  console: 'readonly',
  confirm: 'readonly',
  __dirname: 'readonly',
  document: 'readonly',
  Electron: 'readonly',
  exports: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  localStorage: 'readonly',
  module: 'readonly',
  navigator: 'readonly',
  NodeJS: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  URL: 'readonly',
  window: 'readonly'
}

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      'graphify-out/**',
      'extensions/vscode/dist/**',
      'extensions/vscode/out/**',
      '**/*.d.ts',
      'vitest.config.ts',
      'electron.vite.config.ts'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals
    },
    rules: {
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.node.json', './tsconfig.web.json', './extensions/vscode/tsconfig.json'],
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-control-regex': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/main/**', '**/renderer/**'],
            message: 'Layer violation: shared components must not import from main or renderer.'
          }
        ]
      }]
    }
  }
]
