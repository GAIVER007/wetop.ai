import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
const configPath = 'tests/employee-portal-ui/playwright.config.ts';
const config = () => existsSync(new URL(configPath, root)) ? read(configPath) : '';

describe('portable employee portal acceptance', () => {
  it('gives the common writer its restricted role on the same isolated CI database', () => {
    const workflow = read('.github/workflows/release-checks.yml');
    const integration = workflow.slice(workflow.indexOf('      - name: Интеграционные тесты\n'), workflow.indexOf('      - name: Интеграционные тесты портала'));
    const urls = Object.fromEntries(Array.from(integration.matchAll(/^\s+(DATABASE_URL|DATABASE_APP_URL): (.+)$/gm), (m) => [m[1], new URL(m[2]!)]));
    expect(urls.DATABASE_APP_URL, 'restricted writer connection is required').toBeDefined();
    expect(urls.DATABASE_APP_URL!.username).toBe('wetop_app');
    for (const field of ['host', 'pathname', 'password'] as const)
      expect(urls.DATABASE_APP_URL![field]).toBe(urls.DATABASE_URL![field]);
  });
  it('has no machine-specific fixture or evidence paths', () => {
    for (const file of ['tests/employee-portal-ui/portal.spec.mjs', 'tests/employee-portal-ui/sections.spec.ts', 'tests/employee-portal-ui/disk-storage.ts', 'tests/integration/employee-portal.test.ts']) {
      expect(read(file), file).not.toContain('/srv/hermes');
    }
  });
  it('allows endpoint and repo-relative evidence overrides', () => {
    const portal = read('tests/employee-portal-ui/portal.spec.mjs');
    expect(portal).toContain('process.env.PORTAL_API_URL');
    expect(portal).toContain('process.env.PORTAL_WEB_URL');
    expect(portal).not.toContain("domain:'127.0.0.1'");
    for (const file of ['portal.spec.mjs', 'sections.spec.ts']) {
      const source = read(`tests/employee-portal-ui/${file}`);
      expect(source).toContain('process.env.PORTAL_EVIDENCE_DIR');
      expect(source).toContain('new URL(');
      expect(source).toContain('import.meta.url');
    }
  });
  it('creates a private unique storage root in the OS temporary directory', () => {
    const source = read('tests/employee-portal-ui/disk-storage.ts');
    expect(source).toMatch(/mkdtempSync\(.*tmpdir\(/);
    expect(source).toContain('0o700');
    expect(source).toContain('0o600');
  });
  it('uses the shared strict database guard in integration', () => {
    const source = read('tests/integration/employee-portal.test.ts');
    expect(source).toMatch(/createPrismaClient\(assertPortalDatabase\(\)/);
    expect(source).not.toContain("url.startsWith(");
  });
  it('provides a portable serial config selecting both unskipped portal and site-booking suites', () => {
    expect(existsSync(new URL(configPath, root)), fileURLToPath(new URL(configPath, root))).toBe(true);
    const selected = config().match(/testMatch:\s*\[([^\]]*)\]/)?.[1];
    expect(selected).toBeDefined();
    expect(Array.from(selected!.matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]))
      .toEqual(['portal.spec.mjs', 'site-booking.spec.ts']);
    expect(config()).toMatch(/workers:\s*1/);
    expect(config()).not.toMatch(/fullyParallel:\s*true/);
    const portal = read('tests/employee-portal-ui/portal.spec.mjs');
    expect(portal.match(/^test\('/gm)!.length).toBeGreaterThanOrEqual(10);
    expect(portal).toContain("test('both original profile versions reject stale writes without rereading tokens'");
    expect(portal).not.toMatch(/test\.(skip|fixme|only)\(/);
    for (const suite of ['portal.spec.mjs', 'site-booking.spec.ts']) {
      expect(read(`tests/employee-portal-ui/${suite}`)).not.toMatch(/\b(?:test|it|describe)\.(skip|fixme|only)\(/);
    }
    expect(config()).not.toMatch(/testIgnore|grepInvert|\bgrep\s*:/);
  });
  it('starts real fixture and web test servers with fixture-only test NODE_ENV', () => {
    expect(config()).toContain('tests/employee-portal-ui/fixture-api.ts');
    expect(config()).toContain('next dev');
    expect(config()).toContain("APP_ALLOW_TEST_DATA: '1'");
    expect(config().match(/NODE_ENV:\s*'test'/g)).toHaveLength(1);
    expect(config().match(/reuseExistingServer:\s*false/g)).toHaveLength(2);
    expect(config()).toContain('EMPLOYEE_PORTAL_API_PORT');
    expect(config()).toContain('process.env.PORTAL_API_URL');
    expect(config()).toContain('process.env.PORTAL_WEB_URL');
  });
  it('takes optional browser and Turbopack paths only from the environment', () => {
    expect(config()).toContain('process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
    expect(config()).toContain('process.env.NEXT_TEST_TURBOPACK_ROOT');
    expect(config()).not.toContain('/srv/hermes');
    expect(config()).not.toMatch(/channel:\s*['"]chrome/);
  });
  it('dispatches the portal config through the existing full-gate UI matrix', () => {
    const workflow = read('.github/workflows/release-checks.yml');
    const vertical = workflow.slice(workflow.indexOf('\n  ui-vertical:'), workflow.indexOf('\n  ui-auth:'));
    expect(vertical).toMatch(/suite:\s*\[[^\]]*employee-portal-ui[^\]]*\]/);
    expect(vertical).toContain('npx playwright test --config tests/${{ matrix.suite }}/playwright.config.ts');
    expect(vertical).not.toContain('continue-on-error');
    expect(workflow).toContain('needs: [ui-shard, ui-vertical, ui-auth]');
  });
});
