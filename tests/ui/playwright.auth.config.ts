import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Стойка с включённым замком (шаг 5 порядка включения — `plans/slice-13-accounts-saas.md` §7а).
 *
 * Обычный UI-набор ходит по экранам без входа: так система работает сегодня. Здесь стенд поднимается так,
 * как он будет работать после включения замка на машине стойки: `APP_AUTH_REQUIRED=1` у стойки и замок у
 * синтетического API (`FIXTURE_AUTH_LOCK=1`) — без сессии он отвечает 401 на всё, кроме входа и публичных
 * путей. Проверка ручного шага «без входа любой экран уводит на /login» становится тестом.
 *
 * Свои порты (3102 и 4313): набор запускается отдельно и не спорит с обычным прогоном за 3100 и 4311.
 * Запуск: npx playwright test --config tests/ui/playwright.auth.config.ts
 */
const API = 'http://127.0.0.1:4313';
const WEB = 'http://127.0.0.1:3102';

export default defineConfig({
  ...base,
  testMatch: ['unified-auth.spec.ts', 'login-landing.spec.ts'],
  testIgnore: undefined as unknown as string,
  snapshotPathTemplate: undefined as unknown as string,
  use: { ...base.use, baseURL: WEB },
  webServer: [
    {
      command: 'npx tsx tests/ui/fixture-api.ts',
      cwd: '../..',
      env: { FIXTURE_PORT: '4313', FIXTURE_AUTH_LOCK: '1' },
      url: `${API}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 3102 --hostname 127.0.0.1',
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: API,
        APP_ALLOW_TEST_DATA: '1',
        // то, что владелец впишет в .env стойки на шаге 4
        APP_AUTH_REQUIRED: '1',
        APP_URL: WEB,
        WETOP_SITE_URL: 'http://127.0.0.1:3002',
      },
      // экран входа отвечает и без сессии — по нему и ждём готовности стойки
      url: `${WEB}/auth/fallback`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w apps/site',
      cwd: '../..',
      env: { WETOP_SITE_URL: 'http://127.0.0.1:3002', WETOP_APP_URL: WEB },
      url: 'http://127.0.0.1:3002',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
