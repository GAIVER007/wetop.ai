import { afterEach, expect, it, vi } from 'vitest';
import { INVITE_ROLE_MESSAGE } from '@pms/domain';
import { authApi } from '../../lib/api';
import { inviteAction, signOut, signIn } from './actions';
import { redirect } from 'next/navigation';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/session', () => ({
  sessionToken: async () => 'ui-session',
  clientInfo: async () => ({ userAgent: 'test', ip: null }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it('резервная форма возвращает на исходную страницу после входа', async () => {
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  const form = new FormData();
  form.set('email', 'synthetic@example.invalid');
  form.set('password', 'synthetic-password');
  form.set('next', '/journal?page=2');
  await signIn({ error: null }, form);
  expect(redirect).toHaveBeenLastCalledWith('/journal?page=2');
});

/** Без явного next решает роль вошедшего (ADR-147): владельца на Главную, остальных на Календарь */
it.each([
  ['OWNER', '/today'],
  ['MANAGER', '/chessboard'],
  ['STAFF', '/chessboard'],
] as const)('без next и ролью %s уходит на %s', async (role, expected) => {
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic',
    expiresAt: '2030-01-01T00:00:00Z',
    user: { id: 'u-1', email: 'synthetic@example.invalid', role },
  } as never);
  const form = new FormData();
  form.set('email', 'synthetic@example.invalid');
  form.set('password', 'synthetic-password');
  await signIn({ error: null }, form);
  expect(redirect).toHaveBeenLastCalledWith(expected);
});

it('выход возвращает к единой форме на главной', async () => {
  vi.spyOn(authApi, 'logout').mockResolvedValue(undefined as never);
  await signOut();
  expect(redirect).toHaveBeenCalledWith('https://wetop.ai/?next=%2Ftoday#login');
});

/** Роль в форме приглашения (ADR-107): непонятная — отказ словами API, а не молчаливое приглашение администратора */
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
