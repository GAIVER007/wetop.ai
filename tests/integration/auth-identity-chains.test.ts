import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { EmailVerificationService } from '../../apps/api/src/auth/email-verification.service';
import { PrismaAccountsRepository } from '../../apps/api/src/accounts/accounts.prisma-repository';
import { hashSessionToken } from '@pms/domain';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Единый контур входа (поручение 16.10.2026): сквозные цепочки на настоящей PostgreSQL. Проверяются итоговые строки
 * базы, а не надпись «успешно». Письма ловит подставной почтальон, наружу ничего не уходит.
 */
describe.skipIf(!process.env.DATABASE_URL)('auth identity chains (integration)', () => {
  let db: Db;
  let auth: AuthService;
  let verification: EmailVerificationService;
  const prefix = `AUTHID-${randomUUID().slice(0, 8)}`;
  const emails: string[] = [];
  const letters: Array<{ to: string; text: string }> = [];

  beforeAll(() => {
    const url = process.env.DATABASE_URL!;
    if (!isLocalDatabase(url)) throw new Error('auth identity tests require isolated localhost database');
    process.env.SESSION_SECRET ??= 'секрет-для-прогона';
    db = createPrismaClient(url, 'pms_test');
    const prisma = { db };
    verification = new EmailVerificationService(
      prisma as never,
      { send: async (letter) => void letters.push(letter) },
      'https://app.example.invalid',
    );
    auth = new AuthService(prisma as never, verification);
  });

  afterAll(async () => {
    if (!db) return;
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const orgs = await db.organization.findMany({ where: { name: { startsWith: prefix } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const orgIds = orgs.map((o) => o.id);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }] } });
      await tx.session.deleteMany({ where: { userId: { in: userIds } } });
      await tx.membership.deleteMany({ where: { userId: { in: userIds } } });
      await tx.emailVerification.deleteMany({ where: { userId: { in: userIds } } });
      await tx.passwordReset.deleteMany({ where: { userId: { in: userIds } } });
      await tx.invite.deleteMany({ where: { organizationId: { in: orgIds } } });
      await tx.property.deleteMany({ where: { organizationId: { in: orgIds } } });
      await tx.location.deleteMany({ where: { business: { organizationId: { in: orgIds } } } });
      await tx.business.deleteMany({ where: { organizationId: { in: orgIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.organization.deleteMany({ where: { id: { in: orgIds } } });
    });
    await db.$disconnect();
  });

  const password = 'synthetic-password-2026';

  /** Регистрация владельца через сервис и подтверждение почты ссылкой из перехваченного письма. */
  async function owner(vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', label: string) {
    const email = `authid-${randomUUID()}@example.invalid`;
    emails.push(email);
    await auth.register({
      email, vertical, businessName: `${prefix}-${label}`, name: 'Ирина Тестова', password,
      phoneCountry: 'KZ', phone: '7015554433', privacyAccepted: true,
    });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    const membership = await db.membership.findFirstOrThrow({ where: { userId: user.id } });
    return { email, userId: user.id, organizationId: membership.organizationId };
  }

  async function sessionOrg(token: string) {
    const { hashSessionToken } = await import('@pms/domain');
    const row = await db.session.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token) } });
    return row.organizationId;
  }

  const linkToken = (to: string) => {
    const letter = [...letters].reverse().find((l) => l.to === to);
    const m = letter?.text.match(/token=([^\s]+)/);
    if (!m) throw new Error(`no verification letter for ${to}`);
    return decodeURIComponent(m[1]!.replace(/\+/g, '%20'));
  };

  // А: новый владелец каждого направления получает ровно свой контекст; вход до подтверждения закрыт
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)(
    '%s owner registers, verifies by the mailed link and lands only in the own new organization',
    async (vertical) => {
      const email = `authid-${randomUUID()}@example.invalid`;
      emails.push(email);
      const name = `${prefix}-A-${vertical}`;
      // лишние поля тела (чужая организация, роль) регистрация не читает
      const body = {
        email: `  ${email.toUpperCase()} `, vertical, businessName: name, name: 'Пётр Тестов', password,
        phoneCountry: 'KZ', phone: '7015554433', privacyAccepted: true,
        organizationId: randomUUID(), role: 'PLATFORM_ADMIN', status: 'ACTIVE',
      } as Parameters<AuthService['register']>[0];
      const result = await auth.register(body);
      expect(result).toMatchObject({ pendingVerification: true, email });

      const user = await db.user.findUniqueOrThrow({ where: { email }, include: { memberships: true } });
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.memberships).toHaveLength(1);
      const [m] = user.memberships;
      expect(m!.role).toBe('OWNER');
      const org = await db.organization.findUniqueOrThrow({ where: { id: m!.organizationId } });
      expect(org).toMatchObject({ name, status: 'TRIAL' });
      expect(org.trialEndsAt).not.toBeNull();
      const businesses = await db.business.findMany({ where: { organizationId: org.id } });
      expect(businesses.map((b) => b.vertical)).toEqual([vertical]);
      expect(await db.location.count({ where: { businessId: businesses[0]!.id } })).toBe(1);
      expect(await db.property.count({ where: { organizationId: org.id } })).toBe(vertical === 'HOSPITALITY' ? 1 : 0);
      expect(await db.platformAdmin.count({ where: { userId: user.id } })).toBe(0);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

      // вход до подтверждения закрыт словами, сессии нет
      await expect(auth.login({ email, password })).rejects.toThrow(/не подтвержден/i);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

      const confirmed = await verification.confirm(linkToken(email));
      expect(confirmed).toEqual({ userId: user.id, organizationId: org.id });
      const opened = await auth.startSession(confirmed);
      expect(opened.user.organizationId).toBe(org.id);
      expect(opened.user.role).toBe('OWNER');
      // та же ссылка через окно повтора не впускает; после неё обычный вход работает
      await expect(verification.confirm(linkToken(email), new Date(Date.now() + 11 * 60_000))).rejects.toThrow();
      const login = await auth.login({ email, password });
      expect(login.user.organizationId).toBe(org.id);
    },
  );

  // Б: повтор регистрации, вход и сброс не заводят новых организаций, людей и бизнесов
  it('repeated registration, login and reset request create no extra entities', async () => {
    const o = await owner('BEAUTY', 'repeat');
    const snapshot = async () => ({
      users: await db.user.count({ where: { email: o.email } }),
      orgs: await db.organization.count({ where: { name: { startsWith: prefix } } }),
      businesses: await db.business.count({ where: { organization: { name: { startsWith: prefix } } } }),
      memberships: await db.membership.count({ where: { userId: o.userId } }),
    });
    const before = await snapshot();
    // потерянный ответ: человек жмёт ещё раз, с другим регистром и пробелами
    await expect(
      auth.register({
        email: ` ${o.email.toUpperCase()}`, vertical: 'BEAUTY', businessName: `${prefix}-repeat-2`, name: 'Ирина Тестова',
        password, phoneCountry: 'KZ', phone: '7015554433', privacyAccepted: true,
      }),
    ).rejects.toThrow();
    await auth.login({ email: o.email, password });
    await auth.login({ email: o.email, password });
    await verification.resend(o.email);
    expect(await snapshot()).toEqual(before);
  });

  // Г: существующий человек принимает приглашение в чужую организацию: аккаунт тот же, прежний доступ цел, пароль не меняется
  it('existing user accepts an invite into another organization without a second account', async () => {
    const a = await owner('HOSPITALITY', 'invite-home');
    const b = await owner('FOOD_SERVICE', 'invite-host');
    const repo = new PrismaAccountsRepository({ db } as never);
    const before = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    const invite = await db.invite.create({
      data: {
        organizationId: b.organizationId, email: a.email, role: 'STAFF',
        tokenHash: hashSessionToken(`inv-${randomUUID()}`), expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: b.userId,
      },
    });
    const accepted = await repo.acceptInvite({
      id: invite.id, now: new Date(), passwordTokenHash: hashSessionToken(`pw-${randomUUID()}`),
      passwordExpiresAt: new Date(Date.now() + 86_400_000),
    });
    // пароль уже есть: ссылки «задать пароль» нет, пароль не меняется
    expect(accepted).toEqual({ passwordTokenIssued: false });
    const after = await db.user.findUniqueOrThrow({ where: { id: a.userId }, include: { memberships: true } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(await db.user.count({ where: { email: a.email } })).toBe(1);
    expect(after.memberships.map((m) => [m.organizationId, m.role]).sort()).toEqual(
      [[a.organizationId, 'OWNER'], [b.organizationId, 'STAFF']].sort(),
    );
    // повтор и параллельный повтор той же ссылки ничего не добавляют
    const again = await Promise.all([1, 2].map(() => repo.acceptInvite({
      id: invite.id, now: new Date(), passwordTokenHash: hashSessionToken(`pw-${randomUUID()}`),
      passwordExpiresAt: new Date(Date.now() + 86_400_000),
    })));
    expect(again).toEqual([null, null]);
    expect(await db.membership.count({ where: { userId: a.userId } })).toBe(2);
    // приглашённый вход ведёт в его первую организацию, а не в чужую
    expect((await auth.login({ email: a.email, password })).user.organizationId).toBe(a.organizationId);
  });

  // В: отозванное приглашение доступа не даёт
  it('a revoked invite grants nothing', async () => {
    const b = await owner('BEAUTY', 'invite-revoked');
    const repo = new PrismaAccountsRepository({ db } as never);
    const email = `authid-new-${randomUUID()}@example.invalid`;
    emails.push(email);
    const invite = await db.invite.create({
      data: {
        organizationId: b.organizationId, email, role: 'MANAGER',
        tokenHash: hashSessionToken(`inv-${randomUUID()}`), expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: b.userId,
      },
    });
    await db.invite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await repo.acceptInvite({
      id: invite.id, now: new Date(), passwordTokenHash: hashSessionToken(`pw-${randomUUID()}`),
      passwordExpiresAt: new Date(Date.now() + 86_400_000),
    })).toBeNull();
    expect(await db.user.count({ where: { email } })).toBe(0);
  });

  // Е: смена пароля из профиля, проверившая старый пароль до сброса по ссылке, не перезаписывает новый пароль сброса
  it('profile password change that checked the old password before a reset does not overwrite the reset', async () => {
    const o = await owner('HOSPITALITY', 'change-vs-reset');
    const { token } = await auth.login({ email: o.email, password });
    const resetHash = 'scrypt$16384$8$1$cmVzZXQ$cmVzZXQ';
    // сброс по ссылке коммитится ровно между проверкой текущего пароля и записью нового
    const racing = db.$extends({ query: { user: {
      async update({ args, query }) {
        if ((args.data as { passwordHash?: unknown }).passwordHash !== undefined)
          await db.$transaction([
            db.user.update({ where: { id: o.userId }, data: { passwordHash: resetHash } }),
            db.session.updateMany({ where: { userId: o.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
          ]);
        return query(args);
      },
      async updateMany({ args, query }) {
        if ((args.data as { passwordHash?: unknown }).passwordHash !== undefined)
          await db.$transaction([
            db.user.update({ where: { id: o.userId }, data: { passwordHash: resetHash } }),
            db.session.updateMany({ where: { userId: o.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
          ]);
        return query(args);
      },
    } } });
    const racingAuth = new AuthService({ db: racing } as never, null as never);
    await expect(
      racingAuth.changePassword({ token, currentPassword: password, newPassword: 'another-synthetic-2026' }),
    ).rejects.toThrow();
    const after = await db.user.findUniqueOrThrow({ where: { id: o.userId } });
    expect(after.passwordHash).toBe(resetHash);
  });

  // Г + Ж: человек с доступом в две организации переходит между ними без нового аккаунта; чужой номер не открывает ничего
  it('a member of two organizations switches between them; a foreign or archived id opens nothing', async () => {
    const a = await owner('HOSPITALITY', 'switch-home');
    const b = await owner('BEAUTY', 'switch-other');
    const stranger = await owner('FOOD_SERVICE', 'switch-stranger');
    // a принял приглашение в b администратором
    await db.membership.create({ data: { userId: a.userId, organizationId: b.organizationId, role: 'STAFF' } });
    const first = await auth.login({ email: a.email, password });
    expect(await sessionOrg(first.token)).toBe(a.organizationId);

    const list = await auth.organizations(first.token);
    expect(list.map((o) => [o.id, o.role, o.current])).toEqual([
      [a.organizationId, 'OWNER', true],
      [b.organizationId, 'STAFF', false],
    ]);

    const sessionsBefore = await db.session.count({ where: { userId: a.userId } });
    for (const foreign of [stranger.organizationId, randomUUID(), 'not-a-uuid'])
      await expect(auth.switchOrganization(first.token, foreign)).rejects.toThrow();
    expect(await db.session.count({ where: { userId: a.userId } })).toBe(sessionsBefore);

    const switched = await auth.switchOrganization(first.token, b.organizationId);
    expect(await sessionOrg(switched.token)).toBe(b.organizationId);
    expect(switched.user.role).toBe('STAFF');
    // прежний ключ погашен, срок смены не продлён
    const { hashSessionToken } = await import('@pms/domain');
    const old = await db.session.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(first.token) } });
    expect(old.revokedAt).not.toBeNull();
    expect(switched.expiresAt).toBe(first.expiresAt);
    expect(await auth.whoami(first.token)).toBeNull();
    // аккаунт один, организаций не прибавилось
    expect(await db.user.count({ where: { email: a.email } })).toBe(1);
    expect(await db.membership.count({ where: { userId: a.userId } })).toBe(2);

    await db.organization.update({ where: { id: a.organizationId }, data: { status: 'SUSPENDED' } });
    await expect(auth.switchOrganization(switched.token, a.organizationId)).rejects.toThrow();
    expect((await auth.organizations(switched.token)).map((o) => o.id)).toEqual([b.organizationId]);
  });

  // Г + И: доступ в архивной организации А не должен отнимать законный доступ в Б
  it('login skips an archived first organization and opens the next open membership', async () => {
    const a = await owner('BEAUTY', 'archived-first');
    const b = await owner('FOOD_SERVICE', 'open-second');
    // человек из А приглашён в Б позже (членство Б новее)
    await db.membership.create({ data: { userId: a.userId, organizationId: b.organizationId, role: 'STAFF' } });
    await db.organization.update({ where: { id: a.organizationId }, data: { status: 'SUSPENDED' } });

    const result = await auth.login({ email: a.email, password });
    expect(await sessionOrg(result.token)).toBe(b.organizationId);
    // идентичность прежняя: новый человек и новая организация не появились
    expect(await db.user.count({ where: { email: a.email } })).toBe(1);
    expect(await db.membership.count({ where: { userId: a.userId } })).toBe(2);
  });
});
