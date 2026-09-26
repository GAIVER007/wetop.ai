import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, hashSessionToken, MAX_FAILED_ATTEMPTS, SESSION_HOURS } from '@pms/domain';

import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { FAKE_ORG, fakeDb, fakeUser } from './fake-db';

const PASSWORD = 'luxx-stoika-2026';
const NOW = new Date('2026-09-15T10:00:00Z');

const APP = 'https://app.wetop.ai';

function service(users = [fakeUser()]) {
  const world = fakeDb(users);
  const letters: Array<{ to: string; subject: string; text: string }> = [];
  const mailer = {
    async send(letter: { to: string; subject: string; text: string }) {
      letters.push(letter);
    },
  };
  const verification = new EmailVerificationService(world.prisma, mailer, APP);
  return { auth: new AuthService(world.prisma, verification), verification, letters, ...world };
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
      // единственный участник организации — её владелец (DATA_MODEL §16.1); главным администратором не назначен
      role: 'OWNER',
      platformAdmin: false,
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

  it('два одновременных промаха дают счётчик 2: параллельные попытки не съедают локаут (С-5)', async () => {
    const { auth, users } = service();
    const miss = () =>
      auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW).catch(() => {});
    // обе попытки читают пользователя до того, как первая запишет счётчик, — как два запроса в API
    await Promise.all([miss(), miss()]);
    expect(users[0]!.failedAttempts).toBe(2);
  });

  it('пятый промах ставит запрет по счётчику из базы, а не по прочитанному до записи (С-5)', async () => {
    const { auth, users } = service([fakeUser({ failedAttempts: MAX_FAILED_ATTEMPTS - 2 })]);
    const miss = () =>
      auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW).catch(() => {});
    await Promise.all([miss(), miss()]);
    expect(users[0]!.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(users[0]!.lockedUntil).not.toBeNull();
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

  it('роль — из членства в организации сессии, отметка главного администратора — пока не отозвана (ADR-083)', async () => {
    const { auth, memberships, platformAdmins } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);

    memberships[0]!.role = 'STAFF';
    await expect(auth.whoami(token, NOW)).resolves.toMatchObject({
      user: { role: 'STAFF', platformAdmin: false },
    });

    platformAdmins.push({ userId: 'u-1', grantedAt: NOW, revokedAt: null, note: null });
    await expect(auth.whoami(token, NOW)).resolves.toMatchObject({ user: { platformAdmin: true } });

    platformAdmins[0]!.revokedAt = NOW;
    await expect(auth.whoami(token, NOW)).resolves.toMatchObject({ user: { platformAdmin: false } });
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
 * Регистрация: почта, имя, пароль, письмо, подтверждение (решение владельца 20.09.2026, ADR-053,
 * ADR-060). Вход открывается только после перехода по ссылке из письма.
 */
describe('AuthService.register', () => {
  const NEW = {
    email: 'novyi@example.invalid',
    name: '  Вячеслав  Петров ',
    hotelName: '  Хостел  на Абая ',
    password: PASSWORD,
  };

  // Решение владельца 20.09.2026: регистрация доступна без дополнительных настроек.
  beforeEach(() => vi.stubEnv('REGISTRATION_OPEN', undefined));
  afterEach(() => vi.unstubAllEnvs());

  it('явный REGISTRATION_OPEN=0 закрывает регистрацию без записи в базу', async () => {
    vi.stubEnv('REGISTRATION_OPEN', '0');
    const { auth, users, organizations } = service();
    const before = { users: users.length, orgs: organizations.length };
    await expect(auth.register(NEW, NOW)).rejects.toThrow(/Самостоятельная регистрация закрыта/);
    expect(users).toHaveLength(before.users);
    expect(organizations).toHaveLength(before.orgs);
  });

  /**
   * Название занято другим объектом — отказ (план `plans/tenant-isolation-2026-09-26.md` п. 1): служебные пути API и
   * скрипты владельца находят объект Luxx по названию, и тёзка из чужой организации мог бы перехватить её брони.
   */
  it('название объекта, который уже есть в WETOP, не занимает — без учёта регистра и пробелов', async () => {
    const { auth, users, organizations, properties } = service();
    properties.push({
      id: 'prop-luxx',
      organizationId: 'org-luxx',
      name: 'Luxx Aparts',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const before = { users: users.length, orgs: organizations.length };
    await expect(auth.register({ ...NEW, hotelName: '  luxx   APARTS ' }, NOW)).rejects.toThrow(
      /уже есть в WETOP/,
    );
    expect(users).toHaveLength(before.users);
    expect(organizations).toHaveLength(before.orgs);
  });

  it('заводит организацию, человека и членство — но сессию не открывает: почта не подтверждена', async () => {
    const { auth, users, sessions, memberships, organizations, properties, audit, letters } =
      service();
    const result = await auth.register(NEW, NOW);

    expect(result).toMatchObject({ pendingVerification: true, email: 'novyi@example.invalid' });
    expect(JSON.stringify(result), 'ключа сессии в ответе нет').not.toContain('token');

    const created = users.find((u) => u.email === 'novyi@example.invalid');
    expect(created, 'человек заведён').toBeDefined();
    expect(created!.name).toBe('Вячеслав Петров');
    expect(created!.emailVerifiedAt, 'почта ещё не подтверждена').toBeNull();
    // пароль в базе только хешем, и сам он нигде не всплывает
    expect(created!.passwordHash).not.toContain(PASSWORD);

    // рабочее пространство названо отелем из формы (SaaS-онбординг), а не именем человека
    const org = organizations.find((o) => o.name === 'Хостел на Абая');
    expect(org, 'организация заведена').toBeDefined();
    expect(org!.status).toBe('TRIAL');
    expect(org!.trialEndsAt!.getTime()).toBeGreaterThan(NOW.getTime());
    // зарегистрировавший — владелец своей организации (DATA_MODEL §16.1, ADR-083)
    expect(memberships.find((m) => m.userId === created!.id && m.organizationId === org!.id)?.role).toBe(
      'OWNER',
    );

    // объект организации создан сразу, назван отелем — иначе новый кабинет упирался бы в
    // «объект не настроен для вашей организации» на каждом экране (мультитенантность 21.09)
    const property = properties.find((pr) => pr.organizationId === org!.id);
    expect(property, 'объект заведён для организации').toBeDefined();
    expect(property!.name).toBe('Хостел на Абая');
    expect(property!.currency).toBe('KZT');

    // сессии нет ни одной: пока не подтверждена почта, входа нет
    expect(sessions.filter((x) => x.userId === created!.id)).toHaveLength(0);
    expect(audit.at(-1)).toMatchObject({
      action: 'user.register',
      after: { via: 'password', verified: false },
    });

    // письмо ушло на тот же адрес, и ссылки из него в журнале нет
    expect(letters).toHaveLength(1);
    expect(letters[0]!.to).toBe('novyi@example.invalid');
    expect(letters[0]!.text).toContain('/login/verify?token=');
  });

  it('до подтверждения почты вход закрыт — и говорит, что делать', async () => {
    const { auth } = service();
    await auth.register(NEW, NOW);
    await expect(
      auth.login({ email: 'novyi@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow(/Почта не подтверждена/);
  });

  it('по ссылке из письма человек подтверждается и входит той же парой почта-пароль', async () => {
    const { auth, verification, users, letters } = service();
    await auth.register(NEW, NOW);

    const link = /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text);
    expect(link, 'ссылка в письме').not.toBeNull();
    const token = decodeURIComponent(link![1]!.replace(/\+/g, '%20'));

    const confirmed = await verification.confirm(token, NOW);
    const session = await auth.startSession({ ...confirmed }, NOW);
    expect(session.token).toHaveLength(43);
    expect(session.user.email).toBe('novyi@example.invalid');
    expect(users.find((u) => u.email === 'novyi@example.invalid')!.emailVerifiedAt).toEqual(NOW);

    await expect(
      auth.login({ email: 'novyi@example.invalid', password: PASSWORD }, NOW),
    ).resolves.toMatchObject({ user: { email: 'novyi@example.invalid' } });
  });

  it('ссылка одноразовая: второй заход по ней уже подтверждённого человека не ломает вход', async () => {
    const { auth, verification, letters } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(token, NOW);
    // почтовый клиент ходит по ссылкам сам — повтор должен впускать, а не пугать отказом
    await expect(verification.confirm(token, NOW)).resolves.toMatchObject({
      organizationId: expect.any(String),
    });
  });

  /*
   * ТЗ аудита 25.09.2026, В-1: использованная ссылка не должна быть вечным входом без пароля.
   * Повтор впускает только короткое окно после использования (почтовые клиенты ходят по ссылкам сами),
   * и только пока ссылка не истекла и человек не заблокирован.
   */
  it('через 10 минут использованная ссылка больше не впускает — зовёт войти паролем', async () => {
    const { verification, letters, auth } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(token, NOW);
    const later = new Date(NOW.getTime() + 11 * 60_000);
    await expect(verification.confirm(token, later)).rejects.toThrow(/уже подтверждена/);
  });

  it('использованная ссылка не впускает заблокированного даже в свежем окне', async () => {
    const { verification, letters, auth, users } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(token, NOW);
    users.find((u) => u.email === 'novyi@example.invalid')!.status = 'BLOCKED';
    const shortly = new Date(NOW.getTime() + 60_000);
    await expect(verification.confirm(token, shortly)).rejects.toThrow(/Ссылка не годится/);
  });

  it('окно повтора не продлевает срок самой ссылки', async () => {
    const { verification, letters, auth } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    const nearExpiry = new Date(NOW.getTime() + 72 * 3_600_000 - 60_000);
    await verification.confirm(token, nearExpiry);
    const pastExpiry = new Date(NOW.getTime() + 72 * 3_600_000 + 60_000);
    await expect(verification.confirm(token, pastExpiry)).rejects.toThrow(/уже подтверждена/);
  });

  it('негодная ссылка отвечает отказом и никого не впускает', async () => {
    const { verification } = service();
    await expect(verification.confirm('нет-такой-ссылки', NOW)).rejects.toThrow(
      /Ссылка не годится/,
    );
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
    await expect(auth.register({ ...NEW, hotelName: '   ' }, NOW)).rejects.toThrow(
      /Укажите название организации/,
    );
    await expect(auth.register({ ...NEW, email: 'не-почта' }, NOW)).rejects.toThrow(
      /Укажите почту/,
    );
  });
});
