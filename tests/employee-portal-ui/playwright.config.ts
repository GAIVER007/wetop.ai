import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const api = process.env.PORTAL_API_URL || 'http://127.0.0.1:26831';
const web = process.env.PORTAL_WEB_URL || 'http://127.0.0.1:27036';
// Servers and synthetic authentication cookies are deliberately loopback-only.
for (const endpoint of [api, web]) {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Portal acceptance requires loopback HTTP origins');
  }
}
const apiPort = new URL(api).port || '80';
const webPort = new URL(web).port || '80';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const turbopackRoot = process.env.NEXT_TEST_TURBOPACK_ROOT;
const cwd = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  testDir: '.',
  // sections.spec.ts uses the older Beauty fixture contract, not the portal fixture.
  testMatch: ['portal.spec.mjs', 'site-booking.spec.ts'],
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: web,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: [
    {
      command: 'npx tsx --tsconfig apps/api/tsconfig.json tests/employee-portal-ui/fixture-api.ts',
      cwd,
      url: `${api}/__test/health`,
      reuseExistingServer: false,
      env: { EMPLOYEE_PORTAL_API_PORT: apiPort, NODE_ENV: 'test', APP_ALLOW_TEST_DATA: '1' },
    },
    {
      command: `npm exec -w apps/web -- next dev --port ${webPort} --hostname 127.0.0.1`,
      cwd,
      url: `${web}/register`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_API_URL: api,
        APP_ALLOW_TEST_DATA: '1',
        APP_UI_TEST: '1',
        APP_URL: web,
        ...(turbopackRoot ? { NEXT_TEST_TURBOPACK_ROOT: turbopackRoot } : {}),
      },
    },
  ],
});
