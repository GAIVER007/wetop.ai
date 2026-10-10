import { defineConfig } from '@playwright/test';

/**
 * Проверки главной wetop.ai. Смотрят на то, что реально выложится на Cloudflare Pages: статическую сборку
 * `apps/site/out`, а не на `next dev`. Сервер поднимает `scripts/site/static-server.mjs` на 4320.
 * Секретов, базы и стойки не нужно — набор идёт на любой машине и в CI.
 *
 *   npm run test:record -- e2e --config tests/site/playwright.config.ts
 *
 * Браузер: обычный chromium Playwright; где браузеров нет, но есть свой Chrome — `CHROMIUM_PATH=/путь`.
 */
// Свой порт на параллельную сессию: две сессии на одной машине воюют за 4320 (TESTING.md, 10.10.2026)
const PORT = Number(process.env['SITE_CHECK_PORT']) || 4320;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...(process.env['CHROMIUM_PATH']
      ? { launchOptions: { executablePath: process.env['CHROMIUM_PATH'] } }
      : {}),
  },
  webServer: {
    command: `npm run site:build && node scripts/site/static-server.mjs apps/site/out ${PORT}`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
