import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hashPassword,
  hashSessionToken,
  MAX_FAILED_ATTEMPTS,
  PRIVACY_POLICY_VERSION,
  SESSION_HOURS,
} from '@pms/domain';

import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { FAKE_ORG, fakeDb, fakeUser } from './fake-db';
import { databaseTenant, withSignedInUser } from './request-context';

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
    // Ответ запертой учётки тот же, что у неверной почты: иначе форма входа подтверждает, что почта у нас есть
    // (аудит 26.09, С-6). Текст сам говорит про замок — человеку есть что делать.
    await expect(
      auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow('Неверная почта или пароль');
    await expect(
      auth.login({ email: 'nikogo-net@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow(/запирается на 15 минут/);
  });

  it('когда замок истёк, одна ошибка снова не запирает: счёт неудач начинается заново (аудит 26.09, С-6)', async () => {
    const { auth, users } = service();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await expect(
        auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW),
      ).rejects.toThrow();
    }
    const afterLock = new Date(NOW.getTime() + 16 * 60_000);
    await expect(
      auth.login({ email: 'admin@example.invalid', password: 'опять не тот' }, afterLock),
    ).rejects.toThrow();
    expect(users[0]!.failedAttempts).toBe(1);
    await expect(
      auth.login({ email: 'admin@example.invalid', password: PASSWORD }, afterLock),
    ).resolves.toMatchObject({ user: { email: 'admin@example.invalid' } });
  });

  it('одновременные неверные попытки считаются все, а не как одна (аудит 26.09, С-6)', async () => {
    const { auth, users } = service();
    await Promise.all(
      Array.from({ length: MAX_FAILED_ATTEMPTS }, () =>
        auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW).catch(() => null),
      ),
    );
    expect(users[0]!.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(users[0]!.lockedUntil).not.toBeNull();
  });

  // Проверка исправлений 26.09 (к С-6): состояние замка читалось ДО очереди проверок пароля. Попытки, уже стоявшие в
  // очереди, когда пятая ошибка ставила замок, проверяли настоящий пароль, и верная догадка входила; а пачка попыток на
  // истёкшем замке каждая сбрасывала счёт в 1 — замок не возвращался никогда.
  it('попытка, ждавшая в очереди, пока учётку заперли, уже не входит — даже с верным паролем', async () => {
    const { auth } = service();
    const wrong = Array.from({ length: MAX_FAILED_ATTEMPTS + 1 }, () =>
      auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW).catch(() => null),
    );
    const right = auth
      .login({ email: 'admin@example.invalid', password: PASSWORD }, NOW)
      .then(
        () => 'вошла',
        (e: Error) => e.message,
      );
    await Promise.all(wrong);
    expect(await right).toMatch(/^Неверная почта или пароль/);
  });

  it('пачка ошибок на истёкшем замке запирает снова, а не сбрасывает счёт каждой попыткой', async () => {
    const { auth, users } = service();
    users[0]!.failedAttempts = MAX_FAILED_ATTEMPTS;
    users[0]!.lockedUntil = new Date(NOW.getTime() - 60_000);
    await Promise.all(
      Array.from({ length: MAX_FAILED_ATTEMPTS + 3 }, () =>
        auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW).catch(() => null),
      ),
    );
    expect(users[0]!.lockedUntil!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('опоздавшая ошибка не снимает свежий замок', async () => {
    const { auth, users } = service();
    const late = auth.login({ email: 'admin@example.invalid', password: 'не тот' }, NOW);
    // пока попытка в очереди, учётку заперли другие
    users[0]!.failedAttempts = MAX_FAILED_ATTEMPTS;
    const fresh = new Date(NOW.getTime() + 10 * 60_000);
    users[0]!.lockedUntil = fresh;
    await expect(late).rejects.toThrow();
    expect(users[0]!.lockedUntil).toEqual(fresh);
    expect(users[0]!.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
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

  it('сессия человека, которого исключили из организации, больше не годится (аудит 26.09, С-10)', async () => {
    const { auth, memberships } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    memberships.splice(0, memberships.length);
    await expect(auth.whoami(token, NOW)).resolves.toBeNull();
  });

  it('сессия приостановленной организации не годится (ADR-046, аудит 26.09, С-4)', async () => {
    const { auth, organizations } = service();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    organizations[0]!.status = 'SUSPENDED';
    await expect(auth.whoami(token, NOW)).resolves.toBeNull();
    await expect(
      auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW),
    ).rejects.toThrow();
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
    phoneCountry: 'KZ',
    phone: '8 701 555 44 33',
    privacyAccepted: true,
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

  // Проверка исправлений 26.09 (к С-5): вход ушёл в пул потоков, а регистрация считала scrypt синхронно — поток
  // регистраций с разных адресов снова замораживал главный поток, как вход до исправления.
  it('регистрация не останавливает главный поток на время scrypt', async () => {
    const { auth } = service();
    let last = performance.now();
    let longest = 0;
    const tick = setInterval(() => {
      const t = performance.now();
      longest = Math.max(longest, t - last);
      last = t;
    }, 1);
    try {
      await auth.register(NEW, NOW);
      await new Promise((ok) => setTimeout(ok, 5));
    } finally {
      clearInterval(tick);
    }
    expect(longest).toBeLessThan(25);
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
    const { auth, users, sessions, memberships, organizations, properties, businesses, locations, audit, letters } =
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
    // Platform P1 (DATA_MODEL v2.6): объект сразу в цепочке Organization → Business → Location — иначе
    // резолвер без фолбэка его не найдёт, а база не примет объект без филиала
    const location = locations.find((l) => l.id === property!.locationId);
    expect(location, 'филиал объекта заведён').toMatchObject({ name: 'Хостел на Абая', timezone: 'Asia/Almaty', currency: 'KZT' });
    // телефон из формы (29.09.2026) — контакт объекта и его филиала, одним видом E.164
    expect(property!.phone).toBe('+77015554433');
    expect(location!.phone).toBe('+77015554433');
    expect(businesses.find((b) => b.id === location!.businessId)).toMatchObject({
      organizationId: org!.id,
      name: 'Хостел на Абая',
      vertical: 'HOSPITALITY',
    });

    // сессии нет ни одной: пока не подтверждена почта, входа нет
    expect(sessions.filter((x) => x.userId === created!.id)).toHaveLength(0);
    expect(audit.at(-1)).toMatchObject({
      action: 'user.register',
      after: { via: 'password', verified: false, privacy: { version: PRIVACY_POLICY_VERSION } },
    });
    // телефон — персональные данные, в журнал он не попадает
    expect(JSON.stringify(audit.at(-1))).not.toContain('7015554433');

    // письмо ушло на тот же адрес, и ссылки из него в журнале нет
    expect(letters).toHaveLength(1);
    expect(letters[0]!.to).toBe('novyi@example.invalid');
    expect(letters[0]!.text).toContain('/login/verify?token=');
  });

  it('без согласия с политикой организация не заводится', async () => {
    const { auth, users, organizations } = service();
    const before = { users: users.length, orgs: organizations.length };
    await expect(auth.register({ ...NEW, privacyAccepted: false }, NOW)).rejects.toThrow(
      /политикой конфиденциальности/,
    );
    expect(users).toHaveLength(before.users);
    expect(organizations).toHaveLength(before.orgs);
  });

  it('телефон, не похожий на номер, — отказ словами, без записи в базу', async () => {
    const { auth, users, organizations } = service();
    const before = { users: users.length, orgs: organizations.length };
    await expect(auth.register({ ...NEW, phone: '701 55' }, NOW)).rejects.toThrow(/Проверьте телефон/);
    await expect(auth.register({ ...NEW, phoneCountry: 'XX' }, NOW)).rejects.toThrow(/Проверьте телефон/);
    expect(users).toHaveLength(before.users);
    expect(organizations).toHaveLength(before.orgs);
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
    const soon = new Date(NOW.getTime() + 5 * 60_000);
    await expect(verification.confirm(token, soon)).resolves.toMatchObject({
      organizationId: expect.any(String),
    });
  });

  // Аудит 25.09 В-1 и 26.09 С-7: использованная ссылка открывала сессию без пароля бессрочно — переживала смену
  // пароля и «выйти везде». Повтор остаётся ради двойного открытия письма, но только своей ссылкой и 10 минут.
  it('повтор по ссылке позже 10 минут не впускает, а просит войти паролем', async () => {
    const { auth, verification, letters } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(token, NOW);
    const later = new Date(NOW.getTime() + 11 * 60_000);
    await expect(verification.confirm(token, later)).rejects.toThrow(/войдите/i);
    const year = new Date(NOW.getTime() + 365 * 24 * 3_600_000);
    await expect(verification.confirm(token, year)).rejects.toThrow(/войдите/i);
  });

  it('погашенная повторной отправкой ссылка не впускает и после подтверждения почты новой', async () => {
    const { auth, verification, letters } = service();
    await auth.register(NEW, NOW);
    const first = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    const later = new Date(NOW.getTime() + 2 * 60_000);
    await verification.resend('novyi@example.invalid', later);
    const second = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[1]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(second, later);
    await expect(verification.confirm(first, later)).rejects.toThrow();
  });

  it('повтор по ссылке заблокированного человека не впускает', async () => {
    const { auth, verification, letters, users } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    await verification.confirm(token, NOW);
    users.find((u) => u.email === 'novyi@example.invalid')!.status = 'BLOCKED';
    await expect(verification.confirm(token, NOW)).rejects.toThrow();
  });

  it('вход по ссылке пишется в журнал, а заблокированному сессию не открыть', async () => {
    const { auth, verification, letters, users, audit } = service();
    await auth.register(NEW, NOW);
    const token = decodeURIComponent(
      /\/login\/verify\?token=([^\s]+)/.exec(letters[0]!.text)![1]!.replace(/\+/g, '%20'),
    );
    const confirmed = await verification.confirm(token, NOW);
    await auth.startSession({ ...confirmed }, NOW);
    expect(audit.at(-1)).toMatchObject({ action: 'user.login', after: { via: 'email-link' } });

    users.find((u) => u.email === 'novyi@example.invalid')!.status = 'BLOCKED';
    await expect(auth.startSession({ ...confirmed }, NOW)).rejects.toThrow();
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

  it('письмо просит не переходить по ссылке, если учётную запись заводили не вы (аудит 26.09, С-8)', async () => {
    const { auth, letters } = service();
    await auth.register(NEW, NOW);
    expect(letters[0]!.text).toMatch(/не переходите по ссылке/);
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

/**
 * SEC-1b, стадия A (аудит 29.09.2026): роль запросов организации `wetop_app` больше не читает хеш пароля и отметки
 * главного администратора. Поэтому в запросе вошедшего (`/auth/me`, смена пароля) эти чтения идут служебной ролью базы:
 * `databaseTenant()` там `null`. Подделка базы запоминает, какой ролью её спросили.
 */
describe('AuthService: учётные данные читаются служебной ролью базы (SEC-1b)', () => {
  function watched() {
    const world = service();
    const seen: Array<{ call: string; tenant: string | null }> = [];
    const spy = (table: 'session' | 'user' | 'platformAdmin', method: string) => {
      const target = world.db as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>;
      const original = target[table]![method]!.bind(target[table]);
      target[table]![method] = (...args: unknown[]) => {
        seen.push({ call: `${table}.${method}`, tenant: databaseTenant() });
        return original(...args);
      };
    };
    spy('session', 'findUnique');
    spy('user', 'findUnique');
    spy('user', 'update');
    spy('platformAdmin', 'findUnique');
    return { ...world, seen };
  }
  const asOrganization = <T>(fn: () => Promise<T>) =>
    withSignedInUser({ userId: 'u-1', organizationId: FAKE_ORG }, fn);

  it('whoami внутри запроса организации: сессия с пользователем и отметка администратора — служебной ролью', async () => {
    const { auth, seen } = watched();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    seen.length = 0;
    await expect(asOrganization(() => auth.whoami(token, NOW))).resolves.not.toBeNull();
    expect(seen.map((s) => s.call)).toEqual(
      expect.arrayContaining(['session.findUnique', 'platformAdmin.findUnique']),
    );
    expect(seen.filter((s) => s.tenant !== null)).toEqual([]);
  });

  it('смена пароля внутри запроса организации: чтение и запись пользователя — служебной ролью', async () => {
    const { auth, seen } = watched();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    seen.length = 0;
    await asOrganization(() =>
      auth.changePassword(
        { token, currentPassword: PASSWORD, newPassword: 'ekinshi-parol-2026' },
        NOW,
      ),
    );
    expect(seen.map((s) => s.call)).toEqual(
      expect.arrayContaining(['user.findUnique', 'user.update']),
    );
    expect(seen.filter((s) => s.tenant !== null)).toEqual([]);
  });

  it('служебный путь не теряет автора: журнал по-прежнему знает пользователя и организацию запроса', async () => {
    const { auth, audit } = watched();
    const { token } = await auth.login({ email: 'admin@example.invalid', password: PASSWORD }, NOW);
    await asOrganization(() =>
      auth.changePassword(
        { token, currentPassword: PASSWORD, newPassword: 'ekinshi-parol-2026' },
        NOW,
      ),
    );
    expect(audit.at(-1)!).toMatchObject({ action: 'user.password.changed', userId: 'u-1' });
  });
});

describe('MV2 registration vertical validation', () => {
  const input = {
    email: 'mv2@example.invalid',
    name: 'Мария Тестова',
    hotelName: 'Тестовый бизнес',
    password: PASSWORD,
    phoneCountry: 'KZ',
    phone: '8 701 555 44 33',
    privacyAccepted: true,
  };
  afterEach(() => vi.unstubAllEnvs());
  it.each(['UNKNOWN', '', null, 42])(
    'rejects explicit invalid vertical %s before writes',
    async (vertical) => {
      const { auth, organizations } = service();
      const before = organizations.length;
      await expect(auth.register({ ...input, vertical } as never, NOW)).rejects.toThrow(
        /направление бизнеса/,
      );
      expect(organizations).toHaveLength(before);
    },
  );
  it.each(['BEAUTY', 'FOOD_SERVICE'])('keeps %s pilot closed by default', async (vertical) => {
    const { auth, organizations } = service();
    const before = organizations.length;
    await expect(auth.register({ ...input, vertical } as never, NOW)).rejects.toThrow(/пилот/);
    expect(organizations).toHaveLength(before);
  });
});

describe('MV2 pilot allowlist and first chain', () => {
  const input = {
    email: 'pilot@example.invalid',
    name: 'Мария Тестова',
    businessName: 'Пилот Тест',
    password: PASSWORD,
    phoneCountry: 'KZ',
    phone: '8 701 555 44 33',
    privacyAccepted: true,
  };
  afterEach(() => vi.unstubAllEnvs());
  it.each(['BEAUTY', 'FOOD_SERVICE'])('persists %s without creating a hotel', async (vertical) => {
    vi.stubEnv(`REGISTRATION_${vertical}_PILOT_EMAILS`, ' PILOT@example.invalid ');
    const { auth, businesses, locations, properties } = service();
    await auth.register({ ...input, vertical } as never, NOW);
    expect(businesses).toHaveLength(1);
    expect(businesses[0]).toMatchObject({ vertical, name: input.businessName });
    expect(locations).toHaveLength(1);
    expect(locations[0]!.businessId).toBe(businesses[0]!.id);
    expect(properties).toHaveLength(0);
  });
  it('a Beauty allowlist cannot open Food signup', async () => {
    vi.stubEnv('REGISTRATION_BEAUTY_PILOT_EMAILS', input.email);
    const { auth } = service();
    await expect(
      auth.register({ ...input, vertical: 'FOOD_SERVICE' } as never, NOW),
    ).rejects.toThrow(/пилот/);
  });
});
