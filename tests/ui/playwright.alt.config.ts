import { defineConfig } from '@playwright/test';

// Chrome с машины по умолчанию; `UI_BROWSER_CHANNEL=chromium` — сборка Playwright;
// `UI_BROWSER_EXECUTABLE=/путь/к/chrome` (или `CHROMIUM_PATH`) — конкретный двоичный файл
const uiExecutable = process.env.UI_BROWSER_EXECUTABLE || process.env.CHROMIUM_PATH;

/**
 * Тот же стенд, что `playwright.config.ts`, но на своих портах: когда 4311/3100 занимает прогон
 * соседней сессии (02–03.10 общий Mac делили шесть сессий), свой набор идёт параллельно, не в очередь.
 * Порты: `UI_FIXTURE_PORT` (умолчание 4318) и `UI_WEB_PORT` (умолчание 3108); спекам адрес подставного
 * API передаёт `UI_FIXTURE_API` и `FIXTURE_PORT` — конфиг ставит оба сам. Сервера сайта (3002) здесь нет: наборы,
 * которым нужен сайт, идут основным конфигом. `next dev` обоих конфигов пишут в один `.next-ui` —
 * одновременно с основным стендом из ЭТОГО же дерева не запускать (из чужого worktree можно).
 */
const FIXTURE_PORT = process.env.UI_FIXTURE_PORT || '4318';
const WEB_PORT = process.env.UI_WEB_PORT || '3108';
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
// спеки читают адрес фикстуры двумя способами: `UI_FIXTURE_API` (отчёты, техподдержка) и
// `FIXTURE_PORT` (календарь) — конфиг ставит оба, иначе спек шлёт команды на чужой 4311
process.env.UI_FIXTURE_API = FIXTURE;
process.env.FIXTURE_PORT = FIXTURE_PORT;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  testIgnore: ['login-lock.spec.ts', 'unified-auth.spec.ts', 'assistant-widget.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  snapshotPathTemplate: '{testDir}/../../design/reference/kit/{arg}{ext}',
  use: {
    baseURL: WEB,
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
      env: { FIXTURE_PORT },
      url: `${FIXTURE}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${WEB_PORT} --hostname 127.0.0.1`,
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: FIXTURE,
        APP_ALLOW_TEST_DATA: '1',
        APP_URL: WEB,
        WETOP_SITE_URL: 'http://127.0.0.1:3002',
      },
      url: `${WEB}/today`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
