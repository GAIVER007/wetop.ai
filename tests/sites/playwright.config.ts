import { defineConfig } from '@playwright/test';

/**
 * Публичный рантайм сайтов (MKT4): тот же `createRuntime`, что у Cloudflare Worker, на Node в режиме `--fixture`
 * (контракт из `docs/marketing/sitespec-v0.example.json`, без API и базы). Хост `*.localhost` браузер ведёт на 127.0.0.1.
 *
 *   npm run test:record -- e2e --config tests/sites/playwright.config.ts
 *
 * Браузер: chromium Playwright или свой `CHROMIUM_PATH=/путь`.
 */
const PORT = 4330;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://stepnoy.localhost:${PORT}`,
    ...(process.env['CHROMIUM_PATH'] ? { launchOptions: { executablePath: process.env['CHROMIUM_PATH'] } } : {}),
  },
  webServer: {
    command: `SITES_PREVIEW_PORT=${PORT} npx tsx apps/sites/src/dev-server.ts --fixture`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/robots.txt`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
