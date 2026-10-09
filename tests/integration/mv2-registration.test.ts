import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { EmailVerificationService } from '../../apps/api/src/auth/email-verification.service';
import { isLocalDatabase } from '../tools/seed-local';

describe.skipIf(!process.env.DATABASE_URL)('MV2 real registration persistence', () => {
  let db: Db;
  let auth: AuthService;
  let verification: EmailVerificationService;
  const prefix = `MV2-${randomUUID()}`;
  const emails: string[] = [];
  const letters: Array<{ to: string; text: string }> = [];
  const now = new Date();
  beforeAll(() => {
    const url = process.env.DATABASE_URL!;
    if (!isLocalDatabase(url)) throw new Error('MV2 tests require isolated localhost database');
    db = createPrismaClient(url, 'pms_test');
    const prisma = { db };
    verification = new EmailVerificationService(
      prisma as never,
      {
        send: async (letter) => {
          letters.push(letter);
        },
      },
      'https://app.example.invalid',
    );
    auth = new AuthService(prisma as never, verification);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    if (!db) return;
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const orgs = await db.organization.findMany({
      where: { name: { startsWith: prefix } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const orgIds = orgs.map((o) => o.id);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }] },
      });
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
  function input(vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE', suffix: string = vertical) {
    const email = `mv2-${randomUUID()}@example.invalid`;
    emails.push(email);
    vi.stubEnv(`REGISTRATION_${vertical}_PILOT_EMAILS`, email.toUpperCase());
    return {
      email,
      vertical,
      businessName: `${prefix}-${suffix}`,
      name: 'Мария Тестова',
      password: 'synthetic-password-2026',
      phoneCountry: 'KZ',
      phone: '7015554433',
      privacyAccepted: true,
    };
  }
  it.each(['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const)(
    '%s persists through resend and confirmation',
    async (vertical) => {
      const body = input(vertical);
      await auth.register(body, now);
      const business = await db.business.findFirstOrThrow({ where: { name: body.businessName } });
      const location = await db.location.findFirstOrThrow({ where: { businessId: business.id } });
      expect(business.vertical).toBe(vertical);
      expect(await db.property.count({ where: { organizationId: business.organizationId } })).toBe(
        vertical === 'HOSPITALITY' ? 1 : 0,
      );
      await verification.resend(body.email.toUpperCase(), new Date(now.getTime() + 61_000));
      const letter = letters.filter((l) => l.to === body.email).at(-1)!;
      const link = letter.text.match(
        /https:\/\/app\.example\.invalid\/login\/verify\?token=[A-Za-z0-9_-]+/,
      )?.[0];
      expect(Boolean(link)).toBe(true);
      const confirmed = await verification.confirm(
        new URL(link!).searchParams.get('token')!,
        new Date(now.getTime() + 62_000),
      );
      const session = await auth.startSession(confirmed, new Date(now.getTime() + 62_000));
      expect(
        (await auth.whoami(session.token, new Date(now.getTime() + 63_000)))?.user.organizationId,
      ).toBe(business.organizationId);
      expect(await auth.registrationContext(business.organizationId)).toMatchObject({
        businessId: business.id,
        locationId: location.id,
        vertical,
      });
      // Reload from a fresh database read, not the registration response or browser query.
      expect(await db.business.count({ where: { organizationId: business.organizationId } })).toBe(
        1,
      );
      expect(await db.location.count({ where: { businessId: business.id } })).toBe(1);
    },
  );
  it('concurrent duplicate submission rolls back the losing chain', async () => {
    const body = input('BEAUTY', 'race');
    const results = await Promise.allSettled([auth.register(body, now), auth.register(body, now)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db.organization.count({ where: { name: body.businessName } })).toBe(1);
    expect(await db.business.count({ where: { name: body.businessName } })).toBe(1);
    expect(await db.location.count({ where: { name: body.businessName } })).toBe(1);
  });
  it('denied pilot and global closed gate create no orphan chain', async () => {
    const body = input('FOOD_SERVICE', 'denied');
    vi.stubEnv('REGISTRATION_FOOD_SERVICE_PILOT_EMAILS', '');
    await expect(auth.register(body, now)).rejects.toThrow(
      'Направление пока доступно только участникам пилота',
    );
    vi.stubEnv('REGISTRATION_FOOD_SERVICE_PILOT_EMAILS', body.email);
    vi.stubEnv('REGISTRATION_OPEN', '0');
    await expect(auth.register(body, now)).rejects.toThrow();
    expect(await db.organization.count({ where: { name: body.businessName } })).toBe(0);
    expect(await db.business.count({ where: { name: body.businessName } })).toBe(0);
    expect(await db.location.count({ where: { name: body.businessName } })).toBe(0);
  });
});
