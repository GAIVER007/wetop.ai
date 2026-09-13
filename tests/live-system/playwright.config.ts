import { defineConfig } from '@playwright/test';

if (process.env.WETOP_LIVE_AUDIT !== '1')
  throw new Error('Set WETOP_LIVE_AUDIT=1 to audit Supabase');

/** Separate from default e2e: no global cleanup, provider calls, traces or guest screenshots. */
export default defineConfig({
  testDir: '.',
  testMatch: 'persistence.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: 'http://127.0.0.1:3200',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/live-system/api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:4320/system/connection',
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 3200 --hostname 127.0.0.1',
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_ALLOW_TEST_DATA: '',
        APP_API_URL: 'http://127.0.0.1:4320',
      },
      url: 'http://127.0.0.1:3200/reservations/new',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
