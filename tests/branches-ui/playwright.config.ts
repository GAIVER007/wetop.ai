import { defineConfig } from '@playwright/test';
const webPort = process.env.BRANCHES_UI_WEB_PORT ?? '55863';
const apiPort = process.env.BRANCHES_UI_API_PORT ?? '55864';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    locale: 'ru-RU',
    baseURL: `http://127.0.0.1:${webPort}`,
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/branches-ui/fixture-api.ts',
      cwd: '../..',
      url: `http://127.0.0.1:${apiPort}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${webPort} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `http://127.0.0.1:${webPort}/register`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: `http://127.0.0.1:${apiPort}`,
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: `http://127.0.0.1:${webPort}`,
      },
    },
  ],
});
