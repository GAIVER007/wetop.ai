import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaRequesterContextRepository } from '../../apps/api/src/assistant/requester-context.repository';
import { RequesterContextService } from '../../apps/api/src/assistant/requester-context.service';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Контекст обратившегося для помощника поддержки (S4) на настоящей базе: пара «человек, организация» сверяется с
 * членством, чужая организация не читается, архивные бизнес и филиал не видны, главный администратор без членства
 * получает то же «нет такого». Всё вымышленное (ADR-010), убирается за собой.
 */
describe.skipIf(!url)('контекст обратившегося (integration, DATABASE_URL required)', () => {
  let db: Db;
  let service: RequesterContextService;
  const mark = Date.now().toString(36);
  const [orgA, orgB] = [randomUUID(), randomUUID()];
  const [ownerA, staffA, ownerB, blockedA, adminUser] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const now = new Date('2026-09-29T12:00:00Z');

  beforeAll(async () => {
    db = createPrismaClient(url);
    service = new RequesterContextService(new PrismaRequesterContextRepository({ db } as PrismaService));
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Гостиница А ${mark}`, status: 'READ_ONLY', trialEndsAt: new Date('2026-09-01T00:00:00Z') },
        { id: orgB, name: `Гостиница Б ${mark}`, status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: ownerA, email: `owner-a-${mark}@example.invalid`, name: 'Секретное Имя' },
        { id: staffA, email: `staff-a-${mark}@example.invalid` },
        { id: ownerB, email: `owner-b-${mark}@example.invalid` },
        { id: blockedA, email: `blocked-a-${mark}@example.invalid`, status: 'BLOCKED' },
        { id: adminUser, email: `admin-${mark}@example.invalid` },
      ],
    });
    await db.membership.createMany({
      data: [
        { userId: ownerA, organizationId: orgA, role: 'OWNER' },
        { userId: staffA, organizationId: orgA, role: 'STAFF' },
        { userId: ownerB, organizationId: orgB, role: 'OWNER' },
        { userId: blockedA, organizationId: orgA, role: 'STAFF' },
        { userId: adminUser, organizationId: orgB, role: 'OWNER' },
      ],
    });
    await db.platformAdmin.create({ data: { userId: adminUser } });
    const bizA = await db.business.create({ data: { organizationId: orgA, name: 'Бизнес А', vertical: 'HOSPITALITY' } });
    await db.business.create({ data: { organizationId: orgA, name: 'Архивный бизнес', vertical: 'BEAUTY', status: 'ARCHIVED' } });
    await db.location.createMany({
      data: [
        { businessId: bizA.id, name: 'Филиал А1', timezone: 'Asia/Almaty', currency: 'KZT' },
        { businessId: bizA.id, name: 'Архивный филиал', timezone: 'Asia/Almaty', currency: 'KZT', status: 'ARCHIVED' },
      ],
    });
    const bizB = await db.business.create({ data: { organizationId: orgB, name: 'Бизнес Б', vertical: 'BEAUTY' } });
    await db.location.create({ data: { businessId: bizB.id, name: 'Филиал Б1', timezone: 'Asia/Dubai', currency: 'AED' } });
  });

  afterAll(async () => {
    if (!db) return;
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.platformAdmin.deleteMany({ where: { userId: adminUser } });
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: { in: [ownerA, staffA, ownerB, blockedA, adminUser] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('владелец А получает только А: организация, живые бизнес и филиал, READ_ONLY по сроку', async () => {
    const ctx = await service.resolve(ownerA, orgA, now);
    expect(ctx?.organization.displayName).toContain('Гостиница А');
    expect(ctx?.businesses).toEqual([
      { displayName: 'Бизнес А', vertical: 'HOSPITALITY', locations: [{ displayName: 'Филиал А1' }] },
    ]);
    expect(ctx?.account).toMatchObject({ status: 'READ_ONLY', canMutate: false });
    expect(JSON.stringify(ctx)).not.toContain('Бизнес Б');
  });

  it('администратор А: права из роли — settings нет, desk есть', async () => {
    const ctx = await service.resolve(staffA, orgA, now);
    expect(ctx?.requester.role).toBe('staff');
    expect(ctx?.permissions.settings).toBe(false);
    expect(ctx?.permissions.desk).toBe(true);
  });

  it('пара «человек А, организация Б» и обратная — нет такого', async () => {
    expect(await service.resolve(ownerA, orgB, now)).toBeNull();
    expect(await service.resolve(ownerB, orgA, now)).toBeNull();
  });

  it('заблокированный человек — нет такого', async () => {
    expect(await service.resolve(blockedA, orgA, now)).toBeNull();
  });

  it('главный администратор: в своей организации — отдельный вид, в чужой без членства — нет такого', async () => {
    expect((await service.resolve(adminUser, orgB, now))?.requester.kind).toBe('PLATFORM_ADMIN');
    expect(await service.resolve(adminUser, orgA, now)).toBeNull();
  });

  it('ответ не несёт ни почты, ни имени человека, ни id', async () => {
    const text = JSON.stringify(await service.resolve(ownerA, orgA, now));
    for (const banned of ['example.invalid', 'Секретное Имя', ownerA, orgA]) expect(text).not.toContain(banned);
  });
});
