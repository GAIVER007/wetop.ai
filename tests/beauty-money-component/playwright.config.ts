import { defineConfig } from '@playwright/test';

// Real React component/handlers in Chromium, explicit HTTP/action/UI adapters.
// No Next server, production service, database or visual-acceptance claim.
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, timeout: 30_000,
  use: { headless: true, trace: 'retain-on-failure', launchOptions: {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  } },
});
