import { defineConfig } from '@playwright/test';

const providerEnvironment =
  /^(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|AZURE|COHERE|MISTRAL|TOGETHER|HUGGINGFACE|HF|AWS|S3|CLOUDFLARE|VERCEL|RESEND|SENDGRID|SMTP|MAIL|TELEGRAM|WHATSAPP|CHANNEX|ASSISTANT|SELLER|GUARD|MARKET_COLLECT|SITES_RUNTIME|SERVICE_API|SITE_GENERATION|OTEL|SENTRY|TRACE|WIDGET_IDENTITY)_/;
const credentialEnvironment = /(?:_API_KEY|_ACCESS_KEY|_ACCESS_TOKEN|_SECRET|_PASSWORD|_TOKEN)$/;
const safeEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      key !== 'PII_STORAGE' && !providerEnvironment.test(key) && !credentialEnvironment.test(key),
  ),
);

const apiPort = Number(process.env.UI_FIX_01_API_PORT ?? 4324);
const webPort = Number(process.env.UI_FIX_01_WEB_PORT ?? 3124);
const kbPort = Number(process.env.UI_FIX_01_KB_PORT ?? 8324);
const python = process.env.UI_FIX_01_PYTHON ?? 'python3';
if (!/^(?:python3|\/[A-Za-z0-9._/-]+)$/.test(python))
  throw new Error('UI_FIX_01_PYTHON must be python3 or an absolute executable path');
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const appDb =
  process.env.DATABASE_APP_URL ??
  `postgresql://wetop_app@127.0.0.1:55482/pmslocal?schema=${process.env.DATABASE_SCHEMA ?? 'pms_test'}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'runtime.spec.ts',
  outputDir: '/tmp/ui-fix-01-playwright-output',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: webUrl,
    channel: process.env.UI_BROWSER_CHANNEL ?? 'chrome',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `${python} tests/ui-fix-01-runtime/kb-panel-server.py`,
      cwd: '../..',
      url: `http://127.0.0.1:${kbPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...safeEnvironment,
        UI_FIX_01_KB_PORT: String(kbPort),
      },
    },
    {
      command:
        'npx tsx --tsconfig tests/ui-fix-01-runtime/tsconfig.json tests/ui-fix-01-runtime/api-server.ts',
      cwd: '../..',
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...safeEnvironment,
        DATABASE_APP_URL: appDb,
        AUTH_REQUIRED: '1',
        APP_URL: webUrl,
        PUBLIC_APP_URL: webUrl,
        API_PORT: String(apiPort),
        CHANNEX_PULL: 'off',
        CHANNEX_OUTBOX_WORKER: 'off',
        CHANNEX_FULL_SYNC: 'off',
        CHANNEX_WEBHOOK_HEALTH: 'off',
        GUARD: 'off',
        GUARD_AUTOFIX: 'off',
        SELLER_SYNC: 'off',
        SITE_GENERATION_WORKER: 'off',
        SELLER_URL: `http://127.0.0.1:${kbPort}/ui-fix-01-panel`,
        SELLER_SERVICE_KEY: 'ui-fix-01-local-service-key',
        ASSISTANT_PANEL_URL: `http://127.0.0.1:${kbPort}/ui-fix-01-panel`,
        ASSISTANT_SERVICE_KEY: 'ui-fix-01-local-service-key',
        MAIL_PROVIDER: '',
        MAIL_API_KEY: '',
        MAIL_FROM: '',
      },
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${webPort} --hostname 127.0.0.1`,
      cwd: '../..',
      url: `${webUrl}/auth/fallback`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...safeEnvironment,
        NODE_ENV: 'development',
        APP_API_URL: apiUrl,
        APP_URL: webUrl,
        APP_AUTH_REQUIRED: '1',
        APP_DEMO_MODE: '',
        APP_ALLOW_TEST_DATA: '',
        APP_UI_TEST: '',
      },
    },
  ],
});
