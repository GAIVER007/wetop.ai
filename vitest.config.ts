import { defineConfig } from 'vitest/config';

/**
 * Два проекта: модульные тесты идут параллельно, интеграционные (живая dev-БД через пулер Supabase) — по одному
 * файлу. 11.09.2026 в общем прогоне три интеграционных файла отвалились по обрыву соединения и просидели 2,5 часа
 * на таймаутах, по отдельности прошли за 77 с: у пулера мало сессий, и параллельные PrismaClient их вычерпывают.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'apps/**/*.test.ts',
            'packages/**/*.test.ts',
            'scripts/**/*.test.ts',
            'tests/unit/**/*.test.ts',
          ],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/e2e/**'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
          fileParallelism: false,
          hookTimeout: 60_000,
          // ADR-040: интеграционные тесты пишут в схему pms_test проекта «hotel», рабочие данные (public) не трогают
          env: { DATABASE_SCHEMA: 'pms_test' },
          globalSetup: ['tests/integration-setup.ts'],
        },
      },
    ],
  },
});
