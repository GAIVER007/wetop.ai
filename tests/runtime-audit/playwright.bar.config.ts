import { defineConfig } from '@playwright/test';

/**
 * Браузер Бар-2 на настоящем стеке runtime-аудита (scripts/ci/runtime-audit.sh): стойка `next dev` на 3127 ходит в
 * настоящий API на 4417 (AUTH_REQUIRED=1, штатные роли), спек сверяет ожидание, API, SQL и DOM.
 * API и база подняты скриптом заранее; здесь только стойка. Внешней сети в прогоне нет.
 */
const WEB = 'http://127.0.0.1:3127';
const API = 'http://127.0.0.1:4417';

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'a25-bar-money.spec.ts',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
  },
  webServer: {
    command: 'npm exec -w apps/web -- next dev --port 3127 --hostname 127.0.0.1',
    cwd: '../..',
    url: `${WEB}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      APP_API_URL: API,
      APP_AUTH_REQUIRED: '1',
      APP_URL: WEB,
      APP_DEMO_MODE: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
