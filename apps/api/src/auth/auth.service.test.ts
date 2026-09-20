import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, hashSessionToken, MAX_FAILED_ATTEMPTS, SESSION_HOURS } from '@pms/domain';

import { AuthService } from './auth.service';
import { FAKE_ORG, fakeDb, fakeUser } from './fake-db';

const PASSWORD = 'luxx-stoika-2026';
const NOW = new Date('2026-09-15T10:00:00Z');

function service(users = [fakeUser()]) {
  const world = fakeDb(users);
  return { auth: new AuthService(world.prisma), ...world };
}

describe('AuthService.login', () => {
  it('верный пароль выдаёт токен, открывает сессию на 12 часов и пишет вход в журнал', async () => {
    const { auth, sessions, audit, users } = service();
    const result = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);

    expect(result.user).toEqual({
      id: 'u-1',
      email: 'admin@example.invalid',
      name: 'Айгуль Тестова',
      organizationId: FAKE_ORG,
    });
    expect(result.token).toHaveLength(43);
    expect(new Date(result.expiresAt).getTime() - NOW.getTime()).toBe(SESSION_HOURS * 3_600_000);

    // в базе только хеш токена, не сам токен
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(hashSessionToken(result.token));
    expect(JSON.stringify(sessions)).not.toContain(result.token);

    expect(users[0]!.lastLoginAt).toEqual(NOW);
    expect(audit).toEqual([
      {
        userId: 'u-1',
        entityType: 'user',
        entityId: 'u-1',
        action: 'user.login',
        after: { via: 'password' },
      },
    ]);
  });

  it('почта с пробелами и в верхнем регистре — тот же человек', async () => {
    const { auth } = service();
    await expect(
      auth.login({ email: '  Admin@Example.INVALID ', password: PASSWORD }, NOW),
    ).resolves.toMatchObject({ user: { id: 'u-1' } });
  });

  it('неверный пароль: общий текст, попытка посчитана, сессии нет, пароль в журнал не попал', async () => {
    const { auth, sessions, audit, users } = service();
    await expect(
      auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW),
    ).rejects.toThrow('Неверная почта или пароль');
    expect(sessions).toHaveLength(0);
    expect(users[0]!.failedAttempts).toBe(1);
    expect(JSON.stringify(audit)).not.toContain('не тот');
  });

  it('неизвестная почта отвечает тем же текстом, что и неверный пароль', async () => {
    const { auth } = service();
    await expect(
      auth.login({ email: 'нет-такой@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow('Неверная почта или пароль');
  });

  it('мусор вместо почты не пускает', async () => {
    const { auth } = service();
    await expect(auth.login({ email: 'admin', password: PASSWORD }, NOW)).rejects.toThrow(
      'Неверная почта или пароль',
    );
  });

  it(`после ${MAX_FAILED_ATTEMPTS} промахов вход заперт, и верный пароль тоже не пускает`, async () => {
    const { auth, users } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await expect(
        auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW),
      ).rejects.toThrow();
    }
    expect(users[0]!.lockedUntil).not.toBeNull();
    await expect(
      auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow(/Вход заперт/);
  });

  it('заблокированного сотрудника не пускает', async () => {
    const { auth } = service([fakeUser({ status: 'BLOCKED' })]);
    await expect(
      auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow('Неверная почта или пароль');
  });
});

describe('AuthService.whoami', () => {
  it('живая сессия возвращает сотрудника и продлевает отметку активности', async () => {
    const { auth, sessions } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    const later = new Date(NOW.getTime() + 60_000);

    await expect(auth.whoami(token, later)).resolves.toMatchObject({
      user: { id: 'u-1', name: 'Айгуль Тестова', organizationId: FAKE_ORG },
    });
    expect(sessions[0]!.lastSeenAt).toEqual(later);
  });

  it('неизвестный, просроченный и отозванный токен — никто', async () => {
    const { auth, sessions } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);

    await expect(auth.whoami('чужой-токен', NOW)).resolves.toBeNull();

    const afterExpiry = new Date(NOW.getTime() + (SESSION_HOURS + 1) * 3_600_000);
    await expect(auth.whoami(token, afterExpiry)).resolves.toBeNull();

    sessions[0]!.revokedAt = NOW;
    await expect(auth.whoami(token, NOW)).resolves.toBeNull();
  });

  it('сессия заблокированного сотрудника больше не годится', async () => {
    const { auth, users } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    users[0]!.status = 'BLOCKED';
    await expect(auth.whoami(token, NOW)).resolves.toBeNull();
  });

  it('называет организацию сессии: имя, состояние и пробный период — их показывает экран входа', async () => {
    const { auth } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    await expect(auth.whoami(token, NOW)).resolves.toMatchObject({
      organization: {
        name: 'Тестовый хостел',
        status: 'TRIAL',
        trialEndsAt: '2026-09-22T00:00:00.000Z',
      },
    });
  });

  // Сессии входа по коду (второй отпечаток, HMAC с SESSION_SECRET) сняты 20.09.2026 вместе с самим
  // входом по коду (ADR-053): отпечаток остался один, SHA-256, и проверять здесь больше нечего.
});

describe('AuthService.logout', () => {
  it('отзывает сессию, пишет выход в журнал и повторный вызов не падает', async () => {
    const { auth, sessions, audit } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);

    await auth.logout(token, NOW);
    expect(sessions[0]!.revokedAt).toEqual(NOW);
    expect(audit.map((a) => a.action)).toEqual(['user.login', 'user.logout']);

    await expect(auth.logout(token, NOW)).resolves.toBeUndefined();
    await expect(auth.logout('чужой-токен', NOW)).resolves.toBeUndefined();
    expect(audit.map((a) => a.action)).toEqual(['user.login', 'user.logout']);
  });
});

describe('AuthService.changePassword', () => {
  it('верный текущий пароль меняет пароль и гасит остальные сессии', async () => {
    const { auth, users, sessions, audit } = service();
    const first = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    const second = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);

    await auth.changePassword(
      { token: second.token, currentPassword: PASSWORD, newPassword: 'ekinshi-parol-2026' },
      NOW,
    );

    expect(users[0]!.passwordHash).not.toBe(hashPassword(PASSWORD));
    await expect(auth.whoami(first.token, NOW)).resolves.toBeNull();
    await expect(auth.whoami(second.token, NOW)).resolves.not.toBeNull();
    expect(audit.at(-1)!).toMatchObject({ action: 'user.password.changed', userId: 'u-1' });
    expect(JSON.stringify(audit)).not.toContain('ekinshi-parol-2026');
    expect(sessions.filter((s) => s.revokedAt !== null)).toHaveLength(1);
  });

  it('неверный текущий пароль ничего не меняет', async () => {
    const { auth, users } = service();
    const before = users[0]!.passwordHash;
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    await expect(
      auth.changePassword(
        { token, currentPassword: 'не тот', newPassword: 'ekinshi-parol-2026' },
        NOW,
      ),
    ).rejects.toThrow('Неверный текущий пароль');
    expect(users[0]!.passwordHash).toBe(before);
  });

  it('слабый новый пароль отклоняется с объяснением', async () => {
    const { auth } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    await expect(
      auth.changePassword({ token, currentPassword: PASSWORD, newPassword: '123456' }, NOW),
    ).rejects.toThrow(/короче/);
  });

  it('без годной сессии пароль не сменить', async () => {
    const { auth } = service();
    await expect(
      auth.changePassword(
        { token: 'чужой-токен', currentPassword: PASSWORD, newPassword: 'ekinshi-parol-2026' },
        NOW,
      ),
    ).rejects.toThrow(/Войдите/);
  });
});

/**
 * Регистрация: почта, имя, пароль (решение владельца 20.09.2026, ADR-053). Раньше регистрация слала
 * код на почту и потому не работала без настроенных MAIL_*; теперь человек входит сразу.
 */
describe('AuthService.register', () => {
  beforeEach(() => vi.stubEnv('SELF_REGISTRATION_ENABLED', '1'));
  afterEach(() => vi.unstubAllEnvs());
  const NEW = { email: 'novyi@example.invalid', name: '  Вячеслав  Петров ', password: PASSWORD };

  it('заводит организацию, человека и членство и сразу открывает сессию — как после входа', async () => {
    const { auth, users, sessions, memberships, organizations, audit } = service();
    const result = await auth.register(NEW, NOW);

    expect(result.user).toMatchObject({ email: 'novyi@example.invalid', name: 'Вячеслав Петров' });
    expect(result.token).toHaveLength(43);
    expect(new Date(result.expiresAt).getTime() - NOW.getTime()).toBe(SESSION_HOURS * 3_600_000);

    const created = users.find((u) => u.email === 'novyi@example.invalid');
    expect(created, 'человек заведён').toBeDefined();
    expect(created!.name).toBe('Вячеслав Петров');
    expect(created!.lastLoginAt).toEqual(NOW);
    // пароль в базе только хешем, и сам он нигде не всплывает
    expect(created!.passwordHash).not.toContain(PASSWORD);

    // рабочее пространство названо именем человека: отдельного поля в форме нет
    const org = organizations.find((o) => o.name === 'Вячеслав Петров');
    expect(org, 'организация заведена').toBeDefined();
    expect(org!.status).toBe('TRIAL');
    expect(org!.trialEndsAt!.getTime()).toBeGreaterThan(NOW.getTime());
    expect(memberships.some((m) => m.userId === created!.id && m.organizationId === org!.id)).toBe(
      true,
    );

    // сессия того же вида, что у входа по паролю: в базе только хеш токена
    const session = sessions.find((x) => x.userId === created!.id);
    expect(session!.tokenHash).toBe(hashSessionToken(result.token));
    expect(JSON.stringify(sessions)).not.toContain(result.token);
    expect(audit.at(-1)).toMatchObject({ action: 'user.register', after: { via: 'password' } });
  });

  it('этой же парой почта-пароль сразу входят: регистрация не «наполовину»', async () => {
    const { auth } = service();
    await auth.register(NEW, NOW);
    await expect(
      auth.login({ email: 'novyi@example.invalid', password: PASSWORD }, NOW),
    ).resolves.toMatchObject({ user: { email: 'novyi@example.invalid' } });
  });

  it('занятый адрес назван прямо — иначе человеку нечего ответить на вторую попытку', async () => {
    const { auth, organizations } = service();
    const before = organizations.length;
    await expect(auth.register({ ...NEW, email: 'admin@example.invalid' }, NOW)).rejects.toThrow(
      /уже зарегистрирован/,
    );
    expect(organizations, 'организация не заведена').toHaveLength(before);
  });

  it('короткий пароль не принимается, и организация от такой попытки не остаётся', async () => {
    const { auth, organizations, users } = service();
    const before = { orgs: organizations.length, users: users.length };
    await expect(auth.register({ ...NEW, password: '123' }, NOW)).rejects.toThrow(
      /Пароль не годится/,
    );
    expect(organizations).toHaveLength(before.orgs);
    expect(users).toHaveLength(before.users);
  });

  it('пустое имя и строка, не похожая на почту, — отказ с понятным текстом', async () => {
    const { auth } = service();
    await expect(auth.register({ ...NEW, name: '   ' }, NOW)).rejects.toThrow(/Укажите имя/);
    await expect(auth.register({ ...NEW, email: 'не-почта' }, NOW)).rejects.toThrow(
      /Укажите почту/,
    );
  });
});
