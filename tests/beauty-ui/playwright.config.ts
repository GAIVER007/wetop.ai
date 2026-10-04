import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:55813',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/beauty-ui/fixture-api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:55814/__test/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 55813 --hostname 127.0.0.1',
      cwd: '../..',
      url: 'http://127.0.0.1:55813/register',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: 'http://127.0.0.1:55814',
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: 'http://127.0.0.1:55813',
      },
    },
  ],
});
