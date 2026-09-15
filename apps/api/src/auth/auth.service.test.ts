import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { hashPassword, hashSessionToken, MAX_FAILED_ATTEMPTS, SESSION_HOURS } from '@pms/domain';
import { AuthService } from './auth.service';
import { fakeDb, fakeUser } from './fake-db';

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
      fullName: 'Айгуль Тестова',
      role: 'DESK',
    });
    expect(result.token).toHaveLength(43);
    expect(new Date(result.expiresAt).getTime() - NOW.getTime()).toBe(SESSION_HOURS * 3_600_000);

    // в базе только хеш токена, не сам токен
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toBe(hashSessionToken(result.token));
    expect(JSON.stringify(sessions)).not.toContain(result.token);

    expect(users[0]!.lastLoginAt).toEqual(NOW);
    expect(audit).toEqual([
      { userId: 'u-1', entityType: 'user', entityId: 'u-1', action: 'user.login', after: { via: 'password' } },
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
    await expect(auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW)).rejects.toThrow(
      'Неверная почта или пароль',
    );
    expect(sessions).toHaveLength(0);
    expect(users[0]!.failedAttempts).toBe(1);
    expect(JSON.stringify(audit)).not.toContain('не тот');
  });

  it('неизвестная почта отвечает тем же текстом, что и неверный пароль', async () => {
    const { auth } = service();
    await expect(auth.login({ email: 'нет-такой@example.invalid', password: PASSWORD }, NOW)).rejects.toThrow(
      'Неверная почта или пароль',
    );
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
      await expect(auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW)).rejects.toThrow();
    }
    expect(users[0]!.lockedUntil).not.toBeNull();
    await expect(auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW)).rejects.toThrow(
      /Вход заперт/,
    );
  });

  it('заблокированного сотрудника не пускает', async () => {
    const { auth } = service([fakeUser({ status: 'BLOCKED' })]);
    await expect(auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW)).rejects.toThrow(
      'Неверная почта или пароль',
    );
  });
});

describe('AuthService.whoami', () => {
  it('живая сессия возвращает сотрудника и продлевает отметку активности', async () => {
    const { auth, sessions } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    const later = new Date(NOW.getTime() + 60_000);

    await expect(auth.whoami(token, later)).resolves.toMatchObject({
      user: { id: 'u-1', fullName: 'Айгуль Тестова', role: 'DESK' },
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
      auth.changePassword({ token, currentPassword: 'не тот', newPassword: 'ekinshi-parol-2026' }, NOW),
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
