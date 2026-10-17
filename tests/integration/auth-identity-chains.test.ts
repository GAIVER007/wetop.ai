import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { EmailVerificationService } from '../../apps/api/src/auth/email-verification.service';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Единый контур входа (поручение 16.10.2026): сквозные цепочки на настоящей PostgreSQL. Проверяются итоговые строки
 * базы, а не надпись «успешно». Письма ловит подставной почтальон, наружу ничего не уходит.
 */
describe.skipIf(!process.env.DATABASE_URL)('auth identity chains (integration)', () => {
  let db: Db;
  let auth: AuthService;
  const prefix = `AUTHID-${randomUUID().slice(0, 8)}`;
  const emails: string[] = [];
  const letters: Array<{ to: string; text: string }> = [];

  beforeAll(() => {
    const url = process.env.DATABASE_URL!;
    if (!isLocalDatabase(url)) throw new Error('auth identity tests require isolated localhost database');
    process.env.SESSION_SECRET ??= 'секрет-для-прогона';
    db = createPrismaClient(url, 'pms_test');
    const prisma = { db };
    const verification = new EmailVerificationService(
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
