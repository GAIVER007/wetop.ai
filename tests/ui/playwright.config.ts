import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareIsolatedUiWorkers } from './isolated-workers';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const isolated = prepareIsolatedUiWorkers(repoRoot);
const uiExecutable = process.env.UI_BROWSER_EXECUTABLE || process.env.CHROMIUM_PATH;
const fontResponses = process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
type WebServer = {
  command: string;
  cwd: string;
  env: Record<string, string>;
  url: string;
  reuseExistingServer: boolean;
  timeout?: number;
};

const browserUse = {
  ...(uiExecutable
    ? { launchOptions: { executablePath: uiExecutable } }
    : { channel: process.env.UI_BROWSER_CHANNEL || 'chrome' }),
  viewport: { width: 1440, height: 1000 },
  trace: 'retain-on-failure' as const,
};

const webServers = isolated.workers.flatMap((worker): WebServer[] => [
  {
    command: 'npx tsx tests/ui/fixture-api.ts',
    cwd: worker.root,
    env: { FIXTURE_PORT: String(worker.fixturePort) },
    url: `${worker.fixtureOrigin}/__test/health`,
    reuseExistingServer: false,
  },
  {
    command: `npm exec -w apps/web -- next dev --port ${worker.webPort} --hostname 127.0.0.1`,
    cwd: worker.root,
    env: {
      APP_UI_TEST: '1',
      APP_DEMO_MODE: '',
      APP_API_URL: worker.fixtureOrigin,
      APP_ALLOW_TEST_DATA: '1',
      APP_URL: worker.webOrigin,
      WETOP_SITE_URL: worker.siteOrigin,
      SITE_ORIGINS: worker.siteOrigin,
      NEXT_TEST_DIST_DIR: `.next-mainui-${worker.index}`,
      NEXT_TEST_TURBOPACK_ROOT: isolated.runtimeParent,
      ...(fontResponses ? { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontResponses } : {}),
    },
    url: `${worker.webOrigin}/today`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  {
    command: `npm exec -w apps/site -- next dev --webpack --port ${worker.sitePort} --hostname 127.0.0.1`,
    cwd: worker.root,
    env: {
      WETOP_SITE_URL: worker.siteOrigin,
      WETOP_APP_URL: worker.webOrigin,
      NEXT_TEST_DIST_DIR: `.next-mainui-${worker.index}`,
      ...(fontResponses ? { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontResponses } : {}),
    },
    url: worker.siteOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
]);

/** Browser to independent Next.js and synthetic API pairs. This is not DB integration evidence. */
export default defineConfig({
  // Auth config owns login lock, unified auth and A27 boundary. Assistant keeps its own fake service.
  testIgnore: [
    'login-lock.spec.ts',
    'unified-auth.spec.ts',
    'assistant-widget.spec.ts',
    'a27-auth-boundary.spec.ts',
  ],
  fullyParallel: false,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  snapshotPathTemplate: resolve(repoRoot, 'design/reference/kit/{arg}{ext}'),
  projects: isolated.workers.map((worker) => ({
    name: `main-ui-${worker.index}`,
    testDir: worker.uiDir,
    testMatch: worker.testMatch,
    workers: 1,
    use: { ...browserUse, baseURL: worker.webOrigin },
  })),
  webServer: webServers,
});
