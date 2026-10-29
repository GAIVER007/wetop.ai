import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaSubscriptionNightlyRepository, SubscriptionNightlyService } from '../../apps/api/src/platform/subscription-nightly';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Ночная проверка подписок на настоящей базе (срез 4 кабинета руководителя): пробный кончился → только чтение со строкой
 * журнала `by: nightly`; оплату получили → снова работает; письмо за 7 дней один раз. Данные вымышленные, убираются за собой.
 */
describe.skipIf(!url)('ночная проверка подписок (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaSubscriptionNightlyRepository;
  const mark = Date.now().toString(36);
  const ended = randomUUID();
  const soon = randomUUID();
  const manual = randomUUID();
  const owner = randomUUID();
  const orgs = [ended, soon, manual];
  const now = new Date('2026-10-29T00:30:00.000Z');
  const sent: Array<{ to: string; subject: string }> = [];
  const mailer = { send: async (l: { to: string; subject: string; text: string }) => void sent.push({ to: l.to, subject: l.subject }) };
  const statusOf = async (id: string) => (await db.organization.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaSubscriptionNightlyRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: ended, name: `Ночь: пробный кончился ${mark}`, status: 'TRIAL', trialEndsAt: new Date('2026-10-28T00:00:00Z') },
        { id: soon, name: `Ночь: пробный через 7 ${mark}`, status: 'TRIAL', trialEndsAt: new Date('2026-11-05T09:00:00Z') },
        { id: manual, name: `Ночь: вручную ${mark}`, status: 'READ_ONLY' },
      ],
    });
    await db.user.create({ data: { id: owner, email: `night-${mark}@example.invalid` } });
    await db.membership.create({ data: { userId: owner, organizationId: soon, role: 'OWNER' } });
    await db.platformSubscription.create({ data: { organizationId: manual, monthlyCents: 4900n, paidUntil: new Date('2026-12-01') } });
  });

  afterAll(async () => {
    if (!db) return;
    await purgeAuditRows(db, { entityType: 'organization', entityId: { in: orgs } });
    await db.platformSubscription.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.user.deleteMany({ where: { id: owner } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.$disconnect();
  });

  it('закрывает кончившийся пробный, пишет журнал, шлёт письмо за 7 дней; ручное «только чтение» не открывает', async () => {
    const service = new SubscriptionNightlyService(repo, mailer, 'https://app.wetop.ai');
    const run = await service.runIfDue(now);
    expect(run.ran).toBe(true);
    expect(await statusOf(ended)).toBe('READ_ONLY');
    expect(await statusOf(soon)).toBe('TRIAL');
    // оплачено вперёд, но закрыто руками главного администратора: проверка не открывает
    expect(await statusOf(manual)).toBe('READ_ONLY');
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: ended, action: 'organization.status_changed' } });
    expect(log.after).toMatchObject({ status: 'READ_ONLY', by: 'nightly', reason: 'trial_ended' });
    expect(sent.filter((s) => s.to === `night-${mark}@example.invalid`)).toHaveLength(1);

    // на следующий день то же письмо второй раз не уходит (до конца уже 6 дней, и ключ 7 записан)
    const again = new SubscriptionNightlyService(repo, mailer, 'https://app.wetop.ai');
    await again.runIfDue(now);
    expect(sent.filter((s) => s.to === `night-${mark}@example.invalid`)).toHaveLength(1);
  });

  it('оплату получили после ночного закрытия: снова работает', async () => {
    await db.platformSubscription.create({ data: { organizationId: ended, monthlyCents: 4900n, paidUntil: new Date('2026-11-29') } });
    const service = new SubscriptionNightlyService(repo, mailer, 'https://app.wetop.ai');
    await service.runIfDue(new Date('2026-10-30T00:30:00.000Z'));
    expect(await statusOf(ended)).toBe('ACTIVE');
  });
});
