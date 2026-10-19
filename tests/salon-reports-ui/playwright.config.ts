import { defineConfig } from '@playwright/test';
const api = 'http://127.0.0.1:26892';
const web = 'http://127.0.0.1:26891';
process.env.UI_FIXTURE_API = api;
export default defineConfig({
  testDir: '../ui',
  testMatch: 'salon-reports.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    extraHTTPHeaders: { 'x-wetop-test-client': '1' },
    baseURL: web,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    },
  },
  webServer: [
    {
      command: 'npx tsx tests/ui/fixture-api.ts',
      cwd: '../..',
      env: { FIXTURE_PORT: '26892' },
      url: `${api}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 26891 --hostname 127.0.0.1',
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: api,
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: web,
        NEXT_TEST_DIST_DIR: '.next-salon-reports',
        NEXT_TEST_TURBOPACK_ROOT: '/',
      },
      url: `${web}/auth/fallback`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
