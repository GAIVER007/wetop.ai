import { defineConfig } from '@playwright/test';

// Порты из окружения: дерево делят несколько сессий, и умолчания 4321/3100 бывают заняты соседним
// стендом, а `reuseExistingServer: false` в чужой сервер не встроится и падает с EADDRINUSE.
// Приём тот же, что в `tests/ui/playwright.alt.config.ts`.
const API_PORT = process.env['WIZARD_API_PORT'] ?? '4321';
const WEB_PORT = process.env['WIZARD_WEB_PORT'] ?? '3100';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/wizard-ui/server.ts',
      cwd: '../..',
      env: { WIZARD_API_PORT: API_PORT },
      url: `http://127.0.0.1:${API_PORT}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${WEB_PORT} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `http://127.0.0.1:${WEB_PORT}/create`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: `http://127.0.0.1:${API_PORT}`,
        APP_UI_TEST: '1',
        APP_AUTH_REQUIRED: '1',
        APP_DEMO_MODE: '',
        APP_ALLOW_TEST_DATA: '',
      },
    },
  ],
});
