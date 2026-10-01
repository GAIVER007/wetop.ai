import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { resolveScope } from '../../apps/api/src/auth/scope';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef, propertyIdRef } from '../../apps/api/src/database/property-ref';
import { PrismaOrganizationRepository } from '../../apps/api/src/organization/organization.repository';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';

config({ quiet: true });

/**
 * Филиалы организации на настоящей базе (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md`):
 * новый филиал встаёт в цепочку Business → Location → Property того же Business и получает журнал; указатель на него
 * открывает его объект, а без указателя стойка по-прежнему видит первый; тёзка находится без учёта регистра;
 * структура соседней организации не видна и не пополняется.
 */
describe.skipIf(!process.env.DATABASE_URL)('филиалы организации (integration)', () => {
  const marker = randomUUID();
  const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
  let db: Db;
  let own: { id: string };
  let foreign: { id: string };
  let first: { id: string; locationId: string };
  let alien: { id: string; locationId: string };
  const created: string[] = [];

  beforeAll(async () => {
    db = createPrismaClient();
    own = await db.organization.create({ data: { name: `TEST branches ${marker}` } });
    foreign = await db.organization.create({ data: { name: `TEST branches foreign ${marker}` } });
    first = await createPropertyInChain(db, own.id, { name: `TEST branch A ${marker}`, ...base });
    alien = await createPropertyInChain(db, foreign.id, { name: `TEST branch X ${marker}`, ...base });
  });

  afterAll(async () => {
    await purgeAuditRows(db, { entityType: 'Location', entityId: { in: created } });
    await db.property.deleteMany({ where: { organizationId: { in: [own.id, foreign.id] } } });
    await deleteOrganizationChain(db, [own.id, foreign.id]);
    await db.organization.deleteMany({ where: { id: { in: [own.id, foreign.id] } } });
    forgetPropertyRef();
    await db.$disconnect();
  });

  it('новый филиал — в том же Business, с объектом, журналом; указатель открывает его объект', async () => {
    const repo = new PrismaOrganizationRepository({ db } as never);
    const branch = await repo.createBranch(own.id, {
      name: `TEST branch B ${marker}`,
      address: 'Астана, пр. Мангилик Ел, 1',
      phone: null,
      email: null,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
    });
    created.push(branch.id);
    const firstLocation = await db.location.findUniqueOrThrow({ where: { id: first.locationId } });
    expect(branch.businessId).toBe(firstLocation.businessId);
    expect(branch.property).not.toBeNull();
    const property = await db.property.findUniqueOrThrow({ where: { id: branch.property!.id } });
    expect(property).toMatchObject({
      organizationId: own.id,
      locationId: branch.id,
      name: `TEST branch B ${marker}`,
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const journal = await db.auditLog.findMany({ where: { entityType: 'Location', entityId: branch.id } });
    expect(journal.map((j) => j.action)).toEqual(['organization.location.created']);

    // структура организации: два филиала по порядку создания, соседний не виден
    const structure = await repo.structure(own.id);
    expect(structure?.businesses.map((b) => b.locations.map((l) => l.name))).toEqual([
      [`TEST branch A ${marker}`, `TEST branch B ${marker}`],
    ]);
    expect(JSON.stringify(structure)).not.toContain(alien.id);

    // стойка без указателя — первый объект; указатель нового филиала — его объект
    const open = async (pointer: { businessId?: string; locationId?: string }) => {
      const scope = await resolveScope(db, own.id, pointer);
      return withSignedInUser({ userId: randomUUID(), organizationId: own.id, ...scope }, () =>
        propertyIdRef(db, 'не важно'),
      );
    };
    forgetPropertyRef();
    expect(await open({})).toBe(first.id);
    expect(await open({ businessId: branch.businessId, locationId: branch.id })).toBe(branch.property!.id);
  }, 60000);

  it('тёзка находится без учёта регистра и только внутри своей организации', async () => {
    const repo = new PrismaOrganizationRepository({ db } as never);
    expect(await repo.namesake(own.id, `test BRANCH a ${marker}`)).toBe(true);
    expect(await repo.namesake(own.id, `TEST branch X ${marker}`)).toBe(false);
    expect(await repo.namesake(foreign.id, `TEST branch A ${marker}`)).toBe(false);
    // соседняя организация филиала не получила
    const foreignStructure = await repo.structure(foreign.id);
    expect(foreignStructure?.businesses.flatMap((b) => b.locations).map((l) => l.id)).toEqual([alien.locationId]);
  });
});
