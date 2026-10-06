import { afterEach, expect, it, vi } from 'vitest';
import { authApi } from '../../lib/api';
import { verifyEmailAction } from './actions';
import { redirect } from 'next/navigation';
const { set } = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
// Указатель ставит общий помощник `setScopeCookie` (SCOPE-HARDENING): он настоящий и пишет в подменённый `cookies()`
vi.mock('../../lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/session')>()),
  clientInfo: async () => ({}),
  setSessionCookie: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  set.mockReset();
  vi.clearAllMocks();
});
it.each(['BEAUTY', 'FOOD_SERVICE'] as const)(
  'verification establishes explicit %s context from server data',
  async (vertical) => {
    vi.spyOn(authApi, 'verifyEmail').mockResolvedValue({
      token: 'synthetic-new',
      expiresAt: '2030-01-01T00:00:00Z',
    } as never);
    const context = vi
      .spyOn(authApi, 'registrationContext')
      .mockResolvedValue({
        businessId: 'verified-business',
        locationId: 'verified-location',
        vertical,
        businessName: 'Пилот',
        locationName: 'Филиал',
      });
    await verifyEmailAction('synthetic-verification');
    expect(context).toHaveBeenCalledWith('synthetic-new');
    expect(set).toHaveBeenCalledWith(
      'wetop_scope',
      'business=verified-business;location=verified-location',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(redirect).toHaveBeenLastCalledWith('/register/complete');
  },
);
it('Hospitality verification retains its current destination', async () => {
  vi.spyOn(authApi, 'verifyEmail').mockResolvedValue({
    token: 'synthetic-new',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  vi.spyOn(authApi, 'registrationContext').mockResolvedValue({
    businessId: 'b',
    locationId: 'l',
    vertical: 'HOSPITALITY',
    businessName: 'Отель',
    locationName: 'Филиал',
  });
  await verifyEmailAction('synthetic-verification');
  expect(redirect).toHaveBeenLastCalledWith('/today');
});
