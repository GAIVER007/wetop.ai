import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 150000,
  use: { baseURL: 'http://127.0.0.1:55823', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/onboarding-full/api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:55825/__qa/health',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        AUTH_REQUIRED: '1',
        DATABASE_SCHEMA: 'pms_test',
        CHANNEX_PULL: 'off',
        CHANNEX_OUTBOX_WORKER: 'off',
        CHANNEX_FULL_SYNC: 'off',
        CHANNEX_WEBHOOK_HEALTH: 'off',
        GUARD: 'off',
        GUARD_AUTOFIX: 'off',
      },
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 55823 --hostname 127.0.0.1',
      cwd: '../..',
      url: 'http://127.0.0.1:55823/auth/fallback',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: 'http://127.0.0.1:55825',
        APP_AUTH_REQUIRED: '1',
        APP_URL: 'http://127.0.0.1:55823',
        WETOP_SITE_URL: 'http://127.0.0.1:55823',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
