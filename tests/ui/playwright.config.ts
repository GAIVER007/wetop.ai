import { defineConfig } from '@playwright/test';

// Chrome с машины по умолчанию; `UI_BROWSER_CHANNEL=chromium` — сборка Playwright;
// `UI_BROWSER_EXECUTABLE=/путь/к/chrome` (или `CHROMIUM_PATH`, как у e2e и главной) — конкретный двоичный файл
const uiExecutable = process.env.UI_BROWSER_EXECUTABLE || process.env.CHROMIUM_PATH;

/** Browser → real Next.js/server actions → synthetic loopback API. Not DB integration evidence. */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // наборы со своим стендом идут отдельно: замок — `playwright.auth.config.ts`, подставной помощник —
  // `playwright.assistant.config.ts` (стойке нужен `ASSISTANT_URL` на время запуска)
  testIgnore: ['login-lock.spec.ts', 'unified-auth.spec.ts', 'assistant-widget.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  // эталонные снимки страницы компонентов (DESIGN.md, план шаг 4): имя даёт сам тест, включая платформу
  snapshotPathTemplate: '{testDir}/../../design/reference/kit/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    ...(uiExecutable
      ? { launchOptions: { executablePath: uiExecutable } }
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
        APP_URL: 'http://127.0.0.1:3100',
        WETOP_SITE_URL: 'http://127.0.0.1:3002',
      },
      url: 'http://127.0.0.1:3100/today',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w apps/site',
      cwd: '../..',
      env: { WETOP_SITE_URL: 'http://127.0.0.1:3002', WETOP_APP_URL: 'http://127.0.0.1:3100' },
      url: 'http://127.0.0.1:3002',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
