import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { TEST_API_PORT, TEST_SCHEMA, TEST_WEB_PORT, hardcodedLiveAddress } from './tests/tools/test-schema-plan';
import { AUTH_STATE, SERVICE_KEY, authRun } from './tests/tools/e2e-auth';

/**
 * E2E (ADR-042). По умолчанию — изолированный стенд: свой API на 3101 и стойка на 3100 (production-сборка apps/web)
 * работают в схеме pms_test проекта «hotel»; рабочие данные (public), launchd-службы 3000/3001, Channex и Telegram не
 * задеваются. Первым идёт проект schema-guard: если API тестов не в pms_test — прогон останавливается до первого спека.
 * Схему готовит tests/e2e-setup.ts (миграции, копия данных при пустой схеме; освежить — npm run test:schema -- --refresh).
 *
 * Живой режим только для сертификации Channex (шлёт изменения в Channex staging и пишет номера задач):
 *   E2E_CHANNEX_LIVE=1 npx playwright test — рабочий стенд 3000/3001, только channex-certification.spec.ts.
 * Спек с жёстким адресом рабочего стенда в изолированный прогон не идёт (иначе писал бы в рабочие данные) — список
 * печатается в начале; переведите адрес на process.env.APP_API_URL, и спек вернётся сам.
 */
const LIVE = process.env['E2E_CHANNEX_LIVE'] === '1';
/**
 * Замок API в прогоне (`E2E_AUTH=1`): стенд поднимается с `AUTH_REQUIRED=1`, спеки ходят под сотрудником
 * автотестов (`tests/e2e/_auth.setup.ts`), служебные запросы — с ключом. Порядок включения замка на
 * машине стойки — `plans/slice-13-accounts-saas.md` §7а. По умолчанию выключен: прогон идёт как раньше.
 */
const AUTH = !LIVE && authRun();
const LIVE_ONLY = ['channex-certification.spec.ts'];
/** Свой Chromium вместо браузеров Playwright: `CHROMIUM_PATH` (как у UI-набора и главной) или `E2E_BROWSER_EXECUTABLE` */
const BROWSER_EXECUTABLE = process.env['E2E_BROWSER_EXECUTABLE'] || process.env['CHROMIUM_PATH'];
const TEST_API = `http://127.0.0.1:${TEST_API_PORT}`;
const TEST_WEB = `http://127.0.0.1:${TEST_WEB_PORT}`;
const SPECS = resolve(import.meta.dirname, 'tests/e2e');
const hardcoded = readdirSync(SPECS).filter(
  (f) =>
    f.endsWith('.spec.ts') &&
    !LIVE_ONLY.includes(f) &&
    readFileSync(resolve(SPECS, f), 'utf-8').split('\n').some(hardcodedLiveAddress),
);

if (!LIVE) {
  // Конфиг читают и главный процесс, и воркеры: спеки, уборка (globalTeardown) и прямые запросы к базе идут в тестовый стенд
  process.env['DATABASE_SCHEMA'] = TEST_SCHEMA;
  process.env['APP_API_URL'] = TEST_API;
  process.env['E2E_API_URL'] = TEST_API;
  if (AUTH) process.env['SERVICE_API_KEY'] = SERVICE_KEY;
  if (hardcoded.length && process.env['TEST_WORKER_INDEX'] === undefined)
    console.log(`[e2e] не в прогоне — жёсткий адрес рабочего стенда: ${hardcoded.join(', ')}`);
}

const PII_ENCRYPTION_KEY = process.env['PII_ENCRYPTION_KEY'] || 'e2e-only-key-not-for-production';

export default defineConfig({
  testDir: 'tests/e2e',
  // в живом режиме сертификации схему pms_test не готовим (exactOptionalPropertyTypes: поля просто нет)
  ...(LIVE ? {} : { globalSetup: './tests/e2e-setup.ts' }),
  // брони автотестов занимают ячейки — после прогона они отменяются (в изолированном режиме — в pms_test)
  globalTeardown: './tests/e2e-teardown.ts',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: LIVE ? 'http://127.0.0.1:3000' : TEST_WEB,
    trace: 'retain-on-failure',
    // прямые запросы спеков к API идут как служебные: людей у них нет, а замок пропускает по ключу
    ...(AUTH ? { extraHTTPHeaders: { 'x-wetop-service-key': SERVICE_KEY } } : {}),
    // Машина без браузеров Playwright, но со своим Chromium (облачная сессия, CI-образ):
    // CHROMIUM_PATH=/путь/к/chrome (как у UI-набора и главной) или E2E_BROWSER_EXECUTABLE
    ...(BROWSER_EXECUTABLE
      ? { launchOptions: { executablePath: BROWSER_EXECUTABLE } }
      : {}),
  },
  projects: LIVE
    ? [{ name: 'channex-live', testMatch: LIVE_ONLY.map((f) => `**/${f}`) }]
    : [
        { name: 'schema-guard', testMatch: /_schema-guard\.setup\.ts$/ },
        ...(AUTH
          ? [{ name: 'auth', testMatch: /_auth\.setup\.ts$/, dependencies: ['schema-guard'] }]
          : []),
        {
          name: 'isolated',
          testIgnore: [...LIVE_ONLY, ...hardcoded].map((f) => `**/${f}`),
          dependencies: AUTH ? ['schema-guard', 'auth'] : ['schema-guard'],
          // сессию кладёт шаг входа, поэтому cookie просит только этот проект: у самого входа её ещё нет
          ...(AUTH ? { use: { storageState: AUTH_STATE } } : {}),
        },
      ],
  webServer: LIVE
    ? [
        {
          command: 'npm run start -w apps/api',
          env: { PII_ENCRYPTION_KEY },
          url: 'http://127.0.0.1:3001/inventory/summary',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev -w apps/web',
          url: 'http://127.0.0.1:3000/inventory',
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ]
    : [
        {
          command: 'npm run start -w apps/api',
          env: {
            API_PORT: String(TEST_API_PORT),
            DATABASE_SCHEMA: TEST_SCHEMA,
            PII_ENCRYPTION_KEY,
            // ADR-072: гости в прогоне вымышленные (ADR-010), а спеки вводят имя, телефон и документ — стенд хранит
            // введённое как есть, как база в Казахстане. Режим «без имён» проверяют unit и tests/ui/pii-storage.spec.ts
            PII_STORAGE: 'real',
            // Accounts middleware also reads password sessions. The isolated stand must not
            // depend on a private production secret just to accept a session cookie.
            SESSION_SECRET: process.env['E2E_SESSION_SECRET'] || 'e2e-only-session-secret-not-for-production',
            // фоновая работа — только у рабочего API на этом Mac; тестовый ничего не шлёт наружу и никого не будит
            GUARD: 'off',
            CHANNEX_PULL: 'off',
            CHANNEX_OUTBOX_WORKER: 'off',
            CHANNEX_FULL_SYNC: 'off',
            CHANNEX_WEBHOOK_HEALTH: 'off',
            CHANNEX_ARI: 'off',
            GUARD_HEARTBEAT_URL: '',
            TELEGRAM_BOT_TOKEN: '',
            TELEGRAM_CHAT_ID: '',
            // Замок выключается только явным «0» (ADR-095): без него стойка production-сборки требовала бы вход
            ...(AUTH ? { AUTH_REQUIRED: '1', SERVICE_API_KEY: SERVICE_KEY } : { AUTH_REQUIRED: '0' }),
          },
          // отвечает 200 и без готовой схемы — схему готовит globalSetup, проверяет schema-guard
          url: `${TEST_API}/system/connection`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: `npx next start --port ${TEST_WEB_PORT} --hostname 127.0.0.1`,
          cwd: 'apps/web',
          env: { APP_API_URL: TEST_API, APP_AUTH_REQUIRED: AUTH ? '1' : '0' },
          url: `${TEST_WEB}/inventory`,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      ],
});
