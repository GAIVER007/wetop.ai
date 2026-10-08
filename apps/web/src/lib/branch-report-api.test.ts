import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({
  sessionToken: async () => 'synthetic-session',
  redirectToLoginIfRequired: async () => {},
}));
vi.mock('./scope-pointer', () => ({
  requestScopeHeader: async () => ({ 'x-wetop-scope': 'business=old;location=old' }),
}));
import { branchReportDay } from './api';
afterEach(() => vi.unstubAllGlobals());
it('MV9 report GET keeps signed-in identity and explicit server-listed branch scope with no cache', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  await branchReportDay(
    { vertical: 'BEAUTY', locationId: 'location', location: { businessId: 'business' } },
    '2026-10-07',
  );
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/beauty/appointments?date=2026-10-07'),
    expect.objectContaining({
      cache: 'no-store',
      headers: expect.objectContaining({
        'x-wetop-session': 'synthetic-session',
        'x-wetop-scope': 'business=business;location=location',
      }),
    }),
  );
});
it('MV9 read helper cannot choose arbitrary API routes or Hospitality data', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(
    branchReportDay(
      { vertical: 'HOSPITALITY', locationId: 'location', location: { businessId: 'business' } },
      '2026-10-07',
    ),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
