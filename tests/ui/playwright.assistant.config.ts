import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Стойка с чатом ИИ-помощника (ТЗ ред. 1, П2): `ASSISTANT_URL` указывает на подставного помощника
 * (`tests/ui/fake-assistant.ts`), подпись выдаёт синтетический API. В обычном наборе `ASSISTANT_URL` нет —
 * там проверяется, что без него стойка такая же, как была.
 *
 * Свои порты (3103, 4314, 4316), главная на 3002: набор идёт отдельно от других UI-прогонов.
 * Запуск: npm run test:record -- e2e --config tests/ui/playwright.assistant.config.ts
 */
const API = 'http://127.0.0.1:4314';
const WEB = 'http://127.0.0.1:3103';
export const FAKE_ASSISTANT = 'http://127.0.0.1:4316';

export default defineConfig({
  ...base,
  testMatch: 'assistant-widget.spec.ts',
  testIgnore: undefined as unknown as string,
  snapshotPathTemplate: undefined as unknown as string,
  use: { ...base.use, baseURL: WEB },
  webServer: [
    {
      command: 'npx tsx tests/ui/fixture-api.ts',
      cwd: '../..',
      env: { FIXTURE_PORT: '4314' },
      url: `${API}/__test/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npx tsx tests/ui/fake-assistant.ts',
      cwd: '../..',
      env: { FAKE_ASSISTANT_PORT: '4316' },
      url: `${FAKE_ASSISTANT}/health`,
      reuseExistingServer: false,
    },
    {
      command: 'npm exec -w apps/web -- next dev --port 3103 --hostname 127.0.0.1',
      cwd: '../..',
      env: {
        APP_UI_TEST: '1',
        APP_DEMO_MODE: '',
        APP_API_URL: API,
        APP_ALLOW_TEST_DATA: '1',
        ASSISTANT_URL: FAKE_ASSISTANT,
        APP_URL: WEB,
        WETOP_SITE_URL: 'http://127.0.0.1:3002',
      },
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
