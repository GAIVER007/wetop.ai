import { defineConfig } from '@playwright/test';
const apiPort = process.env.ONBOARDING_REAL_API_PORT || '26893';
const webPort = process.env.ONBOARDING_REAL_WEB_PORT || '26894';
// Playwright workers inherit this same port, not only the spawned API process.
process.env.ONBOARDING_REAL_API_PORT = apiPort;
const api = `http://127.0.0.1:${apiPort}`;
const web = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir: '.', testMatch: 'schedule-save-real.spec.ts', workers: 1,
  timeout: 120000, expect: { timeout: 20000 },
  use: { baseURL: web, viewport: { width: 1440, height: 1000 }, trace: 'off' },
  webServer: [
    { command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/onboarding-real/api.ts', cwd: '../..', url: `${api}/__onboarding-test/health`, reuseExistingServer: false,
      env: { ONBOARDING_REAL_API_PORT: apiPort, DATABASE_SCHEMA: 'pms_test', AUTH_REQUIRED: '1', SESSION_SECRET: 'synthetic-salon-core-local-only', REGISTRATION_OPEN: '1', APP_URL: web } },
    { command: `npm exec -w apps/web -- next dev --port ${webPort} --hostname 127.0.0.1`, cwd: '../..', url: `${web}/register`, reuseExistingServer: false, timeout: 120000,
      env: { APP_UI_TEST: '1', APP_ALLOW_TEST_DATA: '1', NEXT_TEST_TURBOPACK_ROOT: '/', APP_API_URL: api, APP_AUTH_REQUIRED: '1', APP_URL: web, WETOP_SITE_URL: web, SITE_ORIGINS: web } },
  ],
});
