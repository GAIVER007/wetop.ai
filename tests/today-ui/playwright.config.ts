import { defineConfig } from '@playwright/test';
const clock = `--require ${process.cwd()}/tests/today-ui/clock.cjs`;
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    locale: 'ru-RU',
    baseURL: 'http://127.0.0.1:55853',
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/today-ui/fixture-api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:55854/__test/health',
      env: { NODE_OPTIONS: clock },
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 55853 --hostname 127.0.0.1',
      cwd: '../..',
      url: 'http://127.0.0.1:55853/register',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NODE_OPTIONS: clock,
        APP_API_URL: 'http://127.0.0.1:55854',
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: 'http://127.0.0.1:55853',
      },
    },
  ],
});
