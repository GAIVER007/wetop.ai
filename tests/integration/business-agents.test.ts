import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import {
  ForeignIdempotencyKeyError,
  LocationTakenError,
  PrismaBusinessAgentsRepository,
} from '../../apps/api/src/ai-seller/business-agents.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Создание AI-продавца в базе (SA2, DATA_MODEL §20): запросы Prisma, которые подставное хранилище не ловит. Повтор по ключу
 * (один агент, один журнал), чужой ключ, занятый филиал и гонка двух создателей на один филиал (частичный уникальный индекс
 * SA1.6), архивный агент освобождает филиал, рабочий продавец (`id = organization_id`) не отдаётся как черновик.
 */
describe.skipIf(!url)('Business Agents: создание и чтение (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaBusinessAgentsRepository;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userA2 = randomUUID();
  const userB = randomUUID();
  const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
  let businessA = '';
  let locA1 = '';
  let locA2 = '';
  let businessB = '';
  let locB1 = '';

  const input = (over: Record<string, string> = {}) => ({
    id: randomUUID(),
    organizationId: orgA,
    userId: userA,
    name: 'AI-продавец теста',
    businessId: businessA,
    locationId: locA1,
    ...over,
  });
  const agentsOf = (organizationId: string) =>
    db.sellerAgent.findMany({ where: { organizationId }, select: { id: true, lifecycle: true, scenario: true, locationId: true } });
  const created = (organizationId: string) =>
    db.auditLog.count({ where: { organizationId, entityType: 'seller-agent', action: 'agent.created' } });
  const placementOf = async (propertyId: string) =>
    (await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { location: { select: { id: true, businessId: true } } } }))
      .location;

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaBusinessAgentsRepository({ db } as PrismaService);
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Агенты А ${orgA}` },
        { id: orgB, name: `Агенты Б ${orgB}` },
      ],
    });
    await db.user.createMany({ data: [userA, userA2, userB].map((id) => ({ id, email: `${id}@example.invalid` })) });
    const first = await placementOf((await createPropertyInChain(db, orgA, { name: `Филиал А1 ${orgA}`, ...base })).id);
    businessA = first.businessId;
    locA1 = first.id;
    // у Property и Location связь 1:1: второй филиал — это второй объект
    locA2 = (await placementOf((await createPropertyInChain(db, orgA, { name: `Филиал А2 ${orgA}`, ...base })).id)).id;
    const third = await placementOf((await createPropertyInChain(db, orgB, { name: `Филиал Б1 ${orgB}`, ...base })).id);
    businessB = third.businessId;
    locB1 = third.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerAgent.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await purgeAuditRows(db, { organizationId: { in: [orgA, orgB] } });
    await db.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.user.deleteMany({ where: { id: { in: [userA, userA2, userB] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('placement: свой Business и свой филиал — да; чужой, не того Business, снятый с показа — null', async () => {
    expect((await repo.placement(orgA, businessA, locA1))?.location.id).toBe(locA1);
    expect(await repo.placement(orgA, businessB, locB1)).toBeNull();
    expect(await repo.placement(orgA, businessA, locB1)).toBeNull();
    expect(await repo.placement(orgB, businessA, locA1)).toBeNull();
    expect(await repo.placement(orgA, businessA, randomUUID())).toBeNull();
    await db.location.update({ where: { id: locA2 }, data: { status: 'ARCHIVED' } });
    try {
      expect(await repo.placement(orgA, businessA, locA2)).toBeNull();
    } finally {
      await db.location.update({ where: { id: locA2 }, data: { status: 'ACTIVE' } });
    }
  });

  it('create: черновик с филиалом, автором и журналом; повтор по ключу — тот же агент, один журнал', async () => {
    const key = randomUUID();
    const first = await repo.create(input({ id: key }));
    expect(first.created).toBe(true);
    expect(first.agent).toMatchObject({ id: key, lifecycle: 'draft', location: { id: locA1 }, business: { id: businessA } });
    const row = await db.sellerAgent.findUniqueOrThrow({ where: { id: key } });
    expect(row).toMatchObject({ organizationId: orgA, createdBy: userA, scenario: 'sales', lifecycle: 'draft', locationId: locA1 });

    const again = await repo.create(input({ id: key }));
    expect(again.created).toBe(false);
    expect(again.agent.id).toBe(key);
    expect((await agentsOf(orgA)).filter((a) => a.id === key)).toHaveLength(1);
    expect(await created(orgA)).toBe(1);
    const event = await db.auditLog.findFirstOrThrow({ where: { entityId: key, action: 'agent.created' } });
    expect(event.userId).toBe(userA);
    expect(JSON.stringify(event.after)).not.toContain('AI-продавец теста');
    expect(event.after).toMatchObject({ source: 'business-agent', businessId: businessA, locationId: locA1, lifecycle: 'draft' });
  });

  it('create: занятый филиал — LocationTakenError, второй записи и журнала нет; архивный агент филиал освобождает', async () => {
    const before = await created(orgA);
    await expect(repo.create(input({ id: randomUUID() }))).rejects.toBeInstanceOf(LocationTakenError);
    expect(await created(orgA)).toBe(before);

    const holder = (await agentsOf(orgA)).find((a) => a.locationId === locA1)!;
    await db.sellerAgent.update({ where: { id: holder.id }, data: { lifecycle: 'archived' } });
    const next = await repo.create(input({ id: randomUUID(), name: 'После архива' }));
    expect(next.created).toBe(true);
  });

  it('create: ключ чужой организации, чужого человека и ключ, равный организации, — ForeignIdempotencyKeyError', async () => {
    const key = randomUUID();
    await repo.create(input({ id: key, locationId: locA2 }));
    await expect(
      repo.create({ ...input({ id: key }), organizationId: orgB, userId: userB, businessId: businessB, locationId: locB1 }),
    ).rejects.toBeInstanceOf(ForeignIdempotencyKeyError);
    await expect(repo.create(input({ id: key, userId: userA2 }))).rejects.toBeInstanceOf(ForeignIdempotencyKeyError);
    // рабочий продавец: id = organization_id
    await db.sellerAgent.create({ data: { id: orgB, organizationId: orgB, createdBy: userB, name: 'Рабочий продавец Б' } });
    await expect(
      repo.create({ ...input({ id: orgB }), organizationId: orgB, userId: userB, businessId: businessB, locationId: locB1 }),
    ).rejects.toBeInstanceOf(ForeignIdempotencyKeyError);
    expect(await repo.get(orgB, orgB)).toBeNull();
  });

  it('create: два одновременных создателя на свободный филиал — победитель один, второй LocationTakenError', async () => {
    const race = await Promise.allSettled([
      repo.create({ ...input(), organizationId: orgB, userId: userB, businessId: businessB, locationId: locB1 }),
      repo.create({ ...input(), organizationId: orgB, userId: userB, businessId: businessB, locationId: locB1 }),
    ]);
    const won = race.filter((r) => r.status === 'fulfilled');
    const lost = race.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]!.reason).toBeInstanceOf(LocationTakenError);
    expect((await agentsOf(orgB)).filter((a) => a.locationId === locB1 && a.lifecycle !== 'archived')).toHaveLength(1);
  });

  it('options: Business и филиалы своей организации, занятый помечен; чужие не видны', async () => {
    const options = await repo.options(orgA);
    expect(options.map((b) => b.id)).toEqual([businessA]);
    const flags = Object.fromEntries(options[0]!.locations.map((l) => [l.id, l.taken]));
    expect(flags[locA1]).toBe(true); // после архива филиал держит новый агент
    expect(flags[locA2]).toBe(true);
    expect(JSON.stringify(options)).not.toContain(locB1);
    expect((await repo.options(orgB))[0]!.locations.find((l) => l.id === locB1)?.taken).toBe(true);
  });

  it('get: агент своей организации с филиалом; чужой, рабочий продавец и запись мастера без филиала — null', async () => {
    const mine = (await agentsOf(orgA)).find((a) => a.lifecycle === 'draft')!;
    expect((await repo.get(orgA, mine.id))?.id).toBe(mine.id);
    expect(await repo.get(orgB, mine.id)).toBeNull();
    const wizard = await db.sellerAgent.create({ data: { organizationId: orgA, createdBy: userA, name: 'Черновик мастера' } });
    expect(await repo.get(orgA, wizard.id)).toBeNull();
    expect(await repo.get(orgA, randomUUID())).toBeNull();
  });
});
