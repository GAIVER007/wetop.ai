import { defineConfig } from '@playwright/test';

/** Browser → real Next.js/server actions → synthetic loopback API. Not DB integration evidence. */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // Эталонные снимки страницы компонентов (DESIGN.md, шаг 4): design/reference/kit/<имя>.png
  snapshotPathTemplate: '{testDir}/../../design/reference/kit/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    // Установленный Chrome; в окружении с Playwright Chromium — UI_BROWSER_CHANNEL=chromium;
    // готовый бинарник другой версии (удалённая среда) — UI_BROWSER_EXECUTABLE=/путь/к/chrome.
    ...(process.env.UI_BROWSER_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.UI_BROWSER_EXECUTABLE } }
      : { channel: process.env.UI_BROWSER_CHANNEL || 'chrome' }),
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx tests/ui/fixture-api.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:4311/__test/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 3100 --hostname 127.0.0.1',
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: 'http://127.0.0.1:4311',
        APP_ALLOW_TEST_DATA: '1',
      },
      url: 'http://127.0.0.1:3100/today',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
