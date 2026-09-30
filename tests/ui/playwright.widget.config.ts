import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'widget-design.spec.ts',
  workers: 1,
  use: { channel: 'chrome', viewport: { width: 1440, height: 1000 } },
});
