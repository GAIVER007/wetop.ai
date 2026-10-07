import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:55993', viewport: { width: 1440, height: 1000 }, locale: 'ru-RU', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/bar-operational-ui/fixture-api.ts', cwd: '../..', url: 'http://127.0.0.1:55994/__test/health', reuseExistingServer: false },
    { command: 'npm exec -w apps/web -- next dev --port 55993 --hostname 127.0.0.1', cwd: '../..', url: 'http://127.0.0.1:55993/register', reuseExistingServer: false, timeout: 120000,
      env: { APP_API_URL: 'http://127.0.0.1:55994', APP_ALLOW_TEST_DATA: '1', APP_URL: 'http://127.0.0.1:55993' } },
  ],
});
