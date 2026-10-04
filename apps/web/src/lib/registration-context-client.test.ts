import { afterEach, expect, it, vi } from 'vitest';
import { authApi } from './api';
vi.mock('./session', () => ({ sessionToken: async () => 'synthetic-old-session' }));
afterEach(() => vi.unstubAllGlobals());
it('uses the newly verified session instead of a previous browser session', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('null'));
  vi.stubGlobal('fetch', fetch);
  await authApi.registrationContext('synthetic-new-session');
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer synthetic-new-session' }),
    }),
  );
});
