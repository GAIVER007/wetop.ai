import { afterEach, expect, it, vi } from 'vitest';
const login = vi.hoisted(() => vi.fn());
vi.mock('./session', () => ({ sessionToken: async () => 'synthetic-session', redirectToLoginIfRequired: login }));
vi.mock('./scope-pointer', () => ({ requestScopeHeader: async () => ({ 'x-wetop-scope': 'business=synthetic;location=synthetic' }) }));
import { sharedOnboardingApi } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('keeps default onboarding 401 redirect behavior', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 401 })));
  await expect(sharedOnboardingApi.status()).rejects.toMatchObject({ status: 401 });
  expect(login).toHaveBeenCalledOnce();
});
it('explicit progress transport preserves 401 and canonical session and scope headers', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(sharedOnboardingApi.status({ preserveUnauthorized: true })).rejects.toMatchObject({ status: 401 });
  expect(login).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', headers: { 'x-wetop-session': 'synthetic-session', 'x-wetop-scope': 'business=synthetic;location=synthetic' } });
});
