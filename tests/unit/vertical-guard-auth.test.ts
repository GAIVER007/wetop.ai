import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../apps/web/src/lib/api-error';
const mocks = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), scope: vi.fn(), redirect: vi.fn() }));
vi.mock('../../apps/web/src/lib/desk-shell', () => ({ currentMe: mocks.me }));
vi.mock('../../apps/web/src/lib/session', () => ({ redirectToLoginIfRequired: mocks.login }));
vi.mock('../../apps/web/src/lib/scope-gate', () => ({ redirectIfScopeStale: mocks.scope }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
import { requireVertical } from '../../apps/web/src/lib/vertical-guard';
beforeEach(() => { vi.resetAllMocks(); });
it('routes an expired session to login before rendering a protected vertical', async () => {
  const expired = new ApiError(401, 'expired');
  const navigation = new Error('NEXT_REDIRECT');
  mocks.me.mockRejectedValue(expired);
  mocks.login.mockRejectedValue(navigation);
  await expect(requireVertical(['HOSPITALITY'])).rejects.toBe(navigation);
  expect(mocks.login).toHaveBeenCalledOnce();
  expect(mocks.scope).not.toHaveBeenCalled();
});
it.each([403, 503])('preserves API %i without redirecting to login', async (status) => {
  const error = new ApiError(status, 'rejected');
  mocks.me.mockRejectedValue(error);
  await expect(requireVertical(['HOSPITALITY'])).rejects.toBe(error);
  expect(mocks.login).not.toHaveBeenCalled();
});
it('preserves 401 when the documented open stand disables login', async () => {
  const error = new ApiError(401, 'expired');
  mocks.me.mockRejectedValue(error);
  mocks.login.mockResolvedValue(undefined);
  await expect(requireVertical(['HOSPITALITY'])).rejects.toBe(error);
});
it('keeps valid hospitality scope unchanged', async () => {
  const me = { user: { id: 'synthetic' }, context: { vertical: 'HOSPITALITY' } };
  mocks.me.mockResolvedValue(me);
  await expect(requireVertical(['HOSPITALITY'])).resolves.toBe(me);
  expect(mocks.scope).toHaveBeenCalledWith(me);
  expect(mocks.login).not.toHaveBeenCalled();
});
