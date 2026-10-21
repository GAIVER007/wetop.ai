import { defineConfig } from '@playwright/test';
import base from '../../tests/ui/playwright.alt.config';
export default defineConfig({
  ...base,
  testDir: '../../tests/ui',
  webServer: (Array.isArray(base.webServer) ? base.webServer : [base.webServer]).filter(Boolean).map((server) => ({
    ...server!, cwd: process.cwd(), stdout: 'pipe' as const,
  })),
});
