import { defineConfig } from '@playwright/test';

/**
 * Виджет бронирования на чужом сайте (`apps/api/src/web-booking/widget.js`) в настоящем браузере, без сервера: страница
 * сайта, API и Cloudflare Turnstile подменены. Запуск:
 *   npx playwright test -c tests/ui/playwright.booking-widget.config.ts
 * В облачной сессии Google Chrome нет — `UI_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (TESTING.md §4).
 */
const executablePath = process.env['UI_BROWSER_EXECUTABLE'];
export default defineConfig({
  testDir: '.',
  testMatch: ['booking-widget-turnstile.spec.ts', 'booking-widget-langs.spec.ts'],
  workers: 1,
  use: {
    ...(executablePath ? { launchOptions: { executablePath } } : { channel: 'chrome' }),
    viewport: { width: 1000, height: 900 },
  },
});
