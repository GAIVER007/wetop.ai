import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'guest-wizard-scan.spec.ts',
  workers: 1,
  projects: ['light', 'dark'].flatMap((theme) =>
    [390, 1440].map((width) => ({
      name: `${theme}-${width}`,
      use: { viewport: { width, height: 900 }, colorScheme: theme as 'light' | 'dark' },
    })),
  ),
  use: { baseURL: 'http://127.0.0.1:33211', browserName: 'chromium' },
  webServer: {
    cwd: new URL('../..', import.meta.url).pathname,
    command: 'node node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 --port 33211',
    url: 'http://127.0.0.1:33211/create',
    timeout: 120000,
    reuseExistingServer: true,
  },
});
