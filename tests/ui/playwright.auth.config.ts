import { defineConfig } from '@playwright/test';

/**
 * Стойка с включённым замком (шаг 5 порядка включения — `plans/slice-13-accounts-saas.md` §7а).
 *
 * Обычный UI-набор ходит по экранам без входа: так система работает сегодня. Здесь стенд поднимается так,
 * как он будет работать после включения замка на машине стойки: `APP_AUTH_REQUIRED=1` у стойки и замок у
 * синтетического API (`FIXTURE_AUTH_LOCK=1`) — без сессии он отвечает 401 на всё, кроме входа и публичных
 * путей. Проверка ручного шага «без входа любой экран уводит на /login» становится тестом.
 *
 * Свои порты по умолчанию (3002, 3102 и 4313): набор запускается отдельно и не спорит с обычным
 * прогоном за 3000, 3100 и 4311. Для параллельного изолированного запуска порты задаются через
 * AUTH_SITE_PORT, AUTH_WEB_PORT и AUTH_API_PORT.
 * Запуск: npx playwright test --config tests/ui/playwright.auth.config.ts --workers=2
 */
const apiPort = process.env.AUTH_API_PORT || '4313';
const proxyPort = process.env.AUTH_PROXY_PORT || '4323';
const webPort = process.env.AUTH_WEB_PORT || '3102';
const sitePort = process.env.AUTH_SITE_PORT || '3002';
const WEB = `http://127.0.0.1:${webPort}`;
const uiExecutable = process.env.UI_BROWSER_EXECUTABLE || process.env.CHROMIUM_PATH;
const fontResponses = process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
const runtimeRoot = process.env.AUTH_RUNTIME_ROOT || 'test-results/auth-runtime';

function authRuntime(worker: number) {
  const workerApiPort = String(Number(apiPort) + worker);
  const workerWebPort = String(Number(webPort) + worker);
  const workerSitePort = String(Number(sitePort) + worker);
  const workerProxyPort = String(Number(proxyPort) + worker);
  const workerApi = `http://127.0.0.1:${workerApiPort}`;
  const workerProxy = `http://127.0.0.1:${workerProxyPort}`;
  const workerWeb = `http://127.0.0.1:${workerWebPort}`;
  const workerSite = `http://127.0.0.1:${workerSitePort}`;

  return [
    {
      command: 'npx tsx tests/ui/fixture-api.ts',
      cwd: '../..',
      env: { FIXTURE_PORT: workerApiPort, FIXTURE_AUTH_LOCK: '1' },
      url: `${workerApi}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npx tsx tests/ui/auth-fixture-proxy.ts',
      cwd: '../..',
      env: { AUTH_PROXY_PORT: workerProxyPort, AUTH_PROXY_UPSTREAM: workerApi },
      url: `${workerProxy}/__a27/health`,
      reuseExistingServer: false,
    },
    {
      command: `node tests/ui/prepare-auth-runtime.mjs web ${worker} && node_modules/.bin/next dev ${runtimeRoot}-${worker}/apps/web --port ${workerWebPort} --hostname 127.0.0.1`,
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: workerProxy,
        APP_ALLOW_TEST_DATA: '1',
        APP_AUTH_REQUIRED: '1',
        APP_URL: workerWeb,
        NEXT_TEST_TURBOPACK_ROOT: process.env.AUTH_TURBOPACK_ROOT || process.cwd(),
        WETOP_SITE_URL: workerSite,
        SITE_ORIGINS: workerSite,
      },
      url: `${workerWeb}/auth/fallback`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node tests/ui/prepare-auth-runtime.mjs site ${worker} && node_modules/.bin/next dev ${runtimeRoot}-${worker}/apps/site --webpack --port ${workerSitePort} --hostname 127.0.0.1`,
      cwd: '../..',
      env: {
        WETOP_SITE_URL: workerSite,
        WETOP_APP_URL: workerWeb,
        ...(fontResponses ? { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontResponses } : {}),
      },
      url: workerSite,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ];
}

export default defineConfig({
  testDir: '.',
  testMatch: ['a27-auth-boundary.spec.ts', 'login-lock.spec.ts', 'unified-auth.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.AUTH_OUTPUT_DIR || 'test-results/auth',
  use: {
    baseURL: WEB,
    ...(uiExecutable
      ? { launchOptions: { executablePath: uiExecutable } }
      : { channel: process.env.UI_BROWSER_CHANNEL || 'chrome' }),
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
  },
  webServer: [...authRuntime(0), ...authRuntime(1)],
});
