// ESLint flat config. Правила проекта: AGENTS.md, ADR-004 (Channex только в packages/integrations).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'coverage/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
