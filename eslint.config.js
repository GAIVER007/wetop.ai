// ESLint flat config. Правила проекта: AGENTS.md, ADR-004 (Channex только в packages/integrations).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-ui/**',
      'coverage/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Скрипт счётчика (срез 8): браузерный ES5 для старых WebView, отдаётся как есть с /a/pms.js.
    // Правила Node/TS к нему не относятся: браузерные глобалы и пустые catch — намеренно.
    files: ['apps/api/src/analytics/tracker.js', 'apps/api/src/web-booking/widget.js'],
    languageOptions: {
      globals: Object.fromEntries(
        [
          'window',
          'document',
          'navigator',
          'location',
          'history',
          'fetch',
          'crypto',
          'sessionStorage',
          'localStorage',
          'screen',
          'setInterval',
        ].map((g) => [g, 'readonly']),
      ),
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // Обёртки launchd (ADR-034): чистый Node без сборки и tsx — launchd запускает их node напрямую.
    files: ['scripts/ops/launchd/*.mjs', 'scripts/ops/launchd/*.cjs'],
    languageOptions: {
      globals: Object.fromEntries(
        ['process', 'console', 'setInterval', 'setTimeout'].map((g) => [g, 'readonly']),
      ),
    },
  },
  {
    // ADR-004: домен и приложения не знают про Channex. Vendor SDK — только в packages/integrations.
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['packages/integrations/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['channex', 'channex/*', '@channex/*', '*channex*'],
              message: 'Channex SDK разрешён только внутри packages/integrations (ADR-004).',
            },
          ],
        },
      ],
    },
  },
);
