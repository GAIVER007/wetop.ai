import { defineConfig } from '@playwright/test';
import { fullQaPorts } from './ports';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 150000,
  use: { baseURL: `http://127.0.0.1:${fullQaPorts.web}`, viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/onboarding-full/api.ts',
      cwd: '../..',
      url: `${fullQaPorts.url}/__qa/health`,
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
      command: `npm exec -w apps/web -- next dev --port ${fullQaPorts.web} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `http://127.0.0.1:${fullQaPorts.web}/auth/fallback`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: fullQaPorts.url,
        APP_AUTH_REQUIRED: '1',
        APP_URL: `http://127.0.0.1:${fullQaPorts.web}`,
        WETOP_SITE_URL: `http://127.0.0.1:${fullQaPorts.web}`,
        NEXT_TELEMETRY_DISABLED: '1',
        ...(process.env.WETOP_QA_PROXY_TRACE === '1'
          ? {
              NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${fileURLToPath(new URL('./fetch-trace.mjs', import.meta.url))}`,
            }
          : {}),
      },
    },
  ],
});
