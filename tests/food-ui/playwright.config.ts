import { defineConfig } from '@playwright/test';
// Порты стенда из окружения (как WIZARD_*_PORT у tests/wizard-ui): две сессии на одной машине не делят 55823/55824
const web = process.env.FOOD_UI_WEB_PORT ?? '55823';
const api = process.env.FOOD_UI_API_PORT ?? '55824';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    locale: 'ru-RU',
    baseURL: `http://127.0.0.1:${web}`,
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/food-ui/fixture-api.ts',
      cwd: '../..',
      url: `http://127.0.0.1:${api}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${web} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `http://127.0.0.1:${web}/register`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: `http://127.0.0.1:${api}`,
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: `http://127.0.0.1:${web}`,
      },
    },
  ],
});
