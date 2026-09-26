import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/wizard-ui/server.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:4321/__test/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 3100 --hostname 127.0.0.1',
      cwd: '../..',
      url: 'http://127.0.0.1:3100/create',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: 'http://127.0.0.1:4321',
        APP_UI_TEST: '1',
        APP_AUTH_REQUIRED: '1',
        APP_DEMO_MODE: '',
        APP_ALLOW_TEST_DATA: '',
      },
    },
  ],
});
