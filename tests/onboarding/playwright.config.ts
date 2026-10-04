import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:55803',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/onboarding/fixture-api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:55804/__test/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 55803 --hostname 127.0.0.1',
      cwd: '../..',
      url: 'http://127.0.0.1:55803/register',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: 'http://127.0.0.1:55804',
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: 'http://127.0.0.1:55803',
      },
    },
  ],
});
