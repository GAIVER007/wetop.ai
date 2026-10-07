import { defineConfig } from '@playwright/test';
import full from '../onboarding-full/playwright.config';

export default defineConfig({
  ...full,
  testDir: '.',
  testMatch: '*.spec.ts',
});
