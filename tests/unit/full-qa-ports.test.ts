import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it('isolated full QA can use its own loopback port range', async () => {
  vi.stubEnv('WETOP_QA_PORT_BASE', '56080');
  vi.resetModules();
  const config = (await import('../onboarding-full/playwright.config')).default;
  expect(config.use?.baseURL).toBe('http://127.0.0.1:56080');
  const servers = config.webServer;
  expect(Array.isArray(servers)).toBe(true);
  expect(servers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ url: 'http://127.0.0.1:56082/__qa/health' }),
    ]),
  );
});
it('rejects an invalid port range before starting any fixture', async () => {
  vi.stubEnv('WETOP_QA_PORT_BASE', '65535');
  vi.resetModules();
  await expect(import('../onboarding-full/playwright.config')).rejects.toThrow('QA port');
});
