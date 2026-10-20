import { afterEach, expect, it, vi } from 'vitest';
import { INVITE_ROLE_MESSAGE } from '@pms/domain';
import { authApi } from '../../lib/api';
import { inviteAction, inviteNewStaffAction, setMemberScopesAction, signOut, signIn } from './actions';
import { redirect } from 'next/navigation';
import { clearScopeCookie } from '../../lib/session';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/session', () => ({
  sessionToken: async () => 'ui-session',
  clientInfo: async () => ({ userAgent: 'test', ip: null }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  clearScopeCookie: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it('резервная форма ведёт на исходную страницу через выбор филиала и снимает прежний указатель', async () => {
  vi.spyOn(authApi, 'login').mockResolvedValue({
    token: 'synthetic',
    expiresAt: '2030-01-01T00:00:00Z',
  } as never);
  const form = new FormData();
  form.set('email', 'synthetic@example.invalid');
  form.set('password', 'synthetic-password');
  form.set('next', '/journal?page=2');
  await signIn({ error: null }, form);
  expect(redirect).toHaveBeenLastCalledWith('/scope/resolve?next=%2Fjournal%3Fpage%3D2');
  expect(clearScopeCookie).toHaveBeenCalled();
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
    // имя, телефон и область не переданы: пустой объект (DATA_MODEL §31.3)
    {},
  );
});

it('устаревшая или неизвестная организация блокирует приглашение до POST', async () => {
  const invite = vi
    .spyOn(authApi, 'invite')
    .mockResolvedValue({ email: 'novyj@example.invalid' } as never);
  const me = vi.spyOn(authApi, 'me');

  me.mockResolvedValueOnce({ user: { organizationId: 'org-new' } } as never);
  expect(await inviteAction('novyj@example.invalid', 'STAFF', {}, 'org-old')).toMatchObject({
    error: expect.any(String),
    email: null,
  });

  me.mockResolvedValueOnce({ user: null } as never);
  expect(await inviteAction('novyj@example.invalid', 'STAFF', {}, 'org-old')).toMatchObject({
    error: expect.any(String),
    email: null,
  });

  expect(invite).not.toHaveBeenCalled();
});

it('подтверждённая организация сохраняет явный доступ ко всей организации', async () => {
  vi.spyOn(authApi, 'me').mockResolvedValue({ user: { organizationId: 'org-current' } } as never);
  const invite = vi.spyOn(authApi, 'invite').mockResolvedValue({
    id: 'i-2',
    email: 'novyj@example.invalid',
    expiresAt: '',
    acceptedAt: null,
    createdAt: '',
  });

  expect(
    await inviteAction('novyj@example.invalid', 'STAFF', { scopes: [] }, 'org-current'),
  ).toEqual({ error: null, email: 'novyj@example.invalid' });
  expect(invite).toHaveBeenCalledWith(
    'ui-session',
    'novyj@example.invalid',
    'STAFF',
    expect.anything(),
    { scopes: [] },
  );
});

it('устаревшая организация блокирует изменение областей до PATCH', async () => {
  vi.spyOn(authApi, 'me').mockResolvedValue({
    user: { organizationId: 'org-new' },
  } as never);
  const setScopes = vi.spyOn(authApi, 'setMemberScopes').mockResolvedValue(undefined as never);

  expect(await setMemberScopesAction('member-1', [], 'org-old')).toMatchObject({
    error: expect.any(String),
  });
  expect(setScopes).not.toHaveBeenCalled();
});

// Доступ при добавлении сотрудника (решение владельца 20.10.2026): уровень → роль приглашения, сотрудник и филиалы
it('новый сотрудник: «Без входа» ничего не шлёт, «Личный кабинет» зовёт с ролью EMPLOYEE и сотрудником', async () => {
  const invite = vi.spyOn(authApi, 'invite').mockResolvedValue({
    id: 'i-2',
    email: 'anna@example.invalid',
    expiresAt: '',
    acceptedAt: null,
    createdAt: '',
  });
  expect(await inviteNewStaffAction({ employeeId: 'e-1', level: 'NONE', email: '', allBranches: false })).toEqual({
    error: null,
    invited: null,
  });
  expect(invite).not.toHaveBeenCalled();
  expect(
    await inviteNewStaffAction({ employeeId: 'e-1', level: 'PORTAL', email: '', allBranches: false }),
  ).toEqual({ error: 'Для входа в WETOP укажите почту: на неё придёт приглашение.', invited: null });
  expect(
    await inviteNewStaffAction({ employeeId: 'e-1', level: 'PORTAL', email: ' anna@example.invalid ', allBranches: false }),
  ).toEqual({ error: null, invited: 'anna@example.invalid' });
  expect(invite).toHaveBeenLastCalledWith('ui-session', 'anna@example.invalid', 'EMPLOYEE', expect.anything(), {
    employeeId: 'e-1',
  });
  await inviteNewStaffAction({ employeeId: 'e-1', level: 'STAFF', email: 'a@example.invalid', allBranches: true });
  expect(invite).toHaveBeenLastCalledWith('ui-session', 'a@example.invalid', 'STAFF', expect.anything(), {
    employeeId: 'e-1',
    allBranches: true,
  });
});
