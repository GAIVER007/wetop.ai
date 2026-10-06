import { defineConfig } from '@playwright/test';
const apiPort = process.env.BEAUTY_UI_API_PORT || '55814';
const webPort = process.env.BEAUTY_UI_WEB_PORT || '55813';
const api = `http://127.0.0.1:${apiPort}`;
const web = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: web,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/beauty-ui/fixture-api.ts',
      cwd: '../..',
      url: `${api}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${webPort} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `${web}/register`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: api,
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: web,
      },
    },
  ],
});
