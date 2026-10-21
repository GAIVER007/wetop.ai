import { defineConfig } from '@playwright/test';
import base from '../../tests/ui/playwright.alt.config';
export default defineConfig({ ...base, testDir: '.', testMatch: 'navigation-diagnostic.spec.ts',
 webServer: (Array.isArray(base.webServer) ? base.webServer : [base.webServer]).filter(Boolean).map((server) => ({ ...server!, cwd: process.env.AUDIT_APP_ROOT || process.cwd() })),
 timeout: 120_000 });
