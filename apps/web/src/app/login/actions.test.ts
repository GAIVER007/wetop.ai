import { afterEach, expect, it, vi } from 'vitest';
import { INVITE_ROLE_MESSAGE } from '@pms/domain';
import { authApi } from '../../lib/api';
import { inviteAction } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/session', () => ({
  sessionToken: async () => 'ui-session',
  clientInfo: async () => ({ userAgent: 'test', ip: null }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

/** Роль в форме приглашения (ADR-100): непонятная — отказ словами API, а не молчаливое приглашение администратора */
it('непонятная роль — отказ, приглашение не уходит', async () => {
  const invite = vi.spyOn(authApi, 'invite');
  for (const role of ['OWNER', 'admin', '']) {
    expect(await inviteAction('novyj@example.invalid', role)).toEqual({
      error: INVITE_ROLE_MESSAGE,
      email: null,
    });
  }
  expect(invite).not.toHaveBeenCalled();
});

it('роль из формы уходит в API как есть', async () => {
  const invite = vi.spyOn(authApi, 'invite').mockResolvedValue({
    id: 'i-1',
    email: 'novyj@example.invalid',
    expiresAt: '',
    acceptedAt: null,
    createdAt: '',
  });
  expect(await inviteAction('novyj@example.invalid', 'MANAGER')).toEqual({
    error: null,
    email: 'novyj@example.invalid',
  });
  expect(invite).toHaveBeenCalledWith(
    'ui-session',
    'novyj@example.invalid',
    'MANAGER',
    expect.anything(),
  );
});
