import { defineConfig } from '@playwright/test';

/**
 * E2E: поднимает API (3001) и web (3000) сами. Требует DATABASE_URL в .env — данные реальные
 * (номерной фонд без ПД). Запуск: `npm run e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run start -w apps/api',
      url: 'http://127.0.0.1:3001/inventory/summary',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w apps/web',
      url: 'http://127.0.0.1:3000/inventory',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
