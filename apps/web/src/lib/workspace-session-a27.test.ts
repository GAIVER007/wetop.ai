import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';

const { me, redirectLogin, lock } = vi.hoisted(() => ({
  me: vi.fn(),
  redirectLogin: vi.fn(),
  lock: { required: true },
}));
vi.mock('./api', () => ({ authApi: { me } }));
vi.mock('./session', () => ({
  authRequired: () => lock.required,
  redirectToLoginIfRequired: redirectLogin,
}));

describe('workspace session boundary', () => {
  const redirect = new Error('synthetic navigation control flow');
  beforeEach(() => {
    me.mockReset();
    redirectLogin.mockReset();
    lock.required = true;
    redirectLogin.mockImplementation(async () => {
      if (lock.required) throw redirect;
    });
  });

  it('redirects an API 401 using the existing login contract', async () => {
    me.mockRejectedValue(new ApiError(401, 'Synthetic expired session'));
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).rejects.toBe(redirect);
    expect(redirectLogin).toHaveBeenCalledOnce();
  });
  it('rejects a successful anonymous identity when the lock is enabled', async () => {
    me.mockResolvedValue({ user: null });
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).rejects.toBe(redirect);
    expect(redirectLogin).toHaveBeenCalledOnce();
  });
  it.each([403, 500, 503])('preserves API %i without redirecting or clearing cookies', async (status) => {
    const error = new ApiError(status, 'Synthetic rejection');
    me.mockRejectedValue(error);
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).rejects.toBe(error);
    expect(redirectLogin).not.toHaveBeenCalled();
  });
  it('preserves non-API framework control flow', async () => {
    me.mockRejectedValue(redirect);
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).rejects.toBe(redirect);
    expect(redirectLogin).not.toHaveBeenCalled();
  });
  it('retains the explicit open development stand', async () => {
    lock.required = false;
    me.mockResolvedValue({ user: null });
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).resolves.toEqual({ user: null });
  });
  it('returns the verified user and scope unchanged', async () => {
    const result = { user: { id: 'synthetic-user' }, context: { locationId: 'synthetic-location' } };
    me.mockResolvedValue(result);
    const { currentMe } = await import('./desk-shell');
    await expect(currentMe()).resolves.toBe(result);
    expect(redirectLogin).not.toHaveBeenCalled();
  });
});
