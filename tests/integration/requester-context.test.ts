import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaRequesterContextRepository } from '../../apps/api/src/assistant/requester-context.repository';
import { RequesterContextService } from '../../apps/api/src/assistant/requester-context.service';
import { ExtensionsService } from '../../apps/api/src/platform/extensions.service';
import { deleteOrganizationChain } from '../tools/property-owner';

config({ quiet: true });

/**
 * S4 на настоящей базе: контекст обратившегося строится по членству из базы. Роль берётся из строки членства, пара без
 * членства не отвечает, чужая организация в ответ не попадает.
 */
describe.skipIf(!process.env.DATABASE_URL)('контекст обратившегося (integration)', () => {
  const mark = randomUUID().slice(0, 8);
  const db = createPrismaClient();
  const ids = {
    orgA: randomUUID(),
    orgB: randomUUID(),
    owner: randomUUID(),
    staff: randomUUID(),
    stranger: randomUUID(),
  };
  const props: string[] = [];
  const service = () =>
    new RequesterContextService(
      new PrismaRequesterContextRepository({ db } as PrismaService),
      { aiSeller: async () => ({ access: 'off', status: null, activeUntil: null, daysLeft: null }) } as unknown as ExtensionsService,
    );

  beforeAll(async () => {
    await db.organization.createMany({
      data: [
        { id: ids.orgA, name: `TEST S4 A ${mark}` },
        { id: ids.orgB, name: `TEST S4 B ${mark}` },
      ],
    });
    await db.user.createMany({
      data: [
        { id: ids.owner, email: `s4-owner-${mark}@example.invalid`, name: 'Оля Тестова' },
        { id: ids.staff, email: `s4-staff-${mark}@example.invalid` },
        { id: ids.stranger, email: `s4-stranger-${mark}@example.invalid` },
      ],
    });
    await db.membership.createMany({
      data: [
        { userId: ids.owner, organizationId: ids.orgA, role: 'OWNER' },
        { userId: ids.staff, organizationId: ids.orgA, role: 'STAFF' },
        { userId: ids.stranger, organizationId: ids.orgB, role: 'OWNER' },
      ],
    });
    const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
    props.push((await createPropertyInChain(db, ids.orgA, { name: `TEST S4 объект A ${mark}`, ...base })).id);
    props.push((await createPropertyInChain(db, ids.orgB, { name: `TEST S4 объект B ${mark}`, ...base })).id);
  });

  afterAll(async () => {
    await db.membership.deleteMany({ where: { userId: { in: [ids.owner, ids.staff, ids.stranger] } } });
    await db.user.deleteMany({ where: { id: { in: [ids.owner, ids.staff, ids.stranger] } } });
    await db.property.deleteMany({ where: { id: { in: props } } });
    await deleteOrganizationChain(db, [ids.orgA, ids.orgB]);
    await db.organization.deleteMany({ where: { id: { in: [ids.orgA, ids.orgB] } } });
    await db.$disconnect();
  });

  it('роль — из членства в базе; бизнес и филиал своей организации, чужих нет', async () => {
    const owner = await service().context(ids.owner, ids.orgA);
    const staff = await service().context(ids.staff, ids.orgA);
    expect(owner?.role.code).toBe('OWNER');
    expect(staff?.role.code).toBe('STAFF');
    expect(staff?.permissions.denied.map((p) => p.code)).toContain('refunds');
    expect(owner?.organization.name).toBe(`TEST S4 A ${mark}`);
    expect(owner?.businesses).toHaveLength(1);
    expect(owner?.businesses[0]?.locations).toHaveLength(1);
    expect(JSON.stringify(owner)).not.toContain(mark + ' B');
    expect(JSON.stringify(owner)).not.toContain(ids.owner);
    expect(owner?.user.email).toBe('s***@example.invalid'); // маска: первая буква и домен
    expect(owner?.subscription.aiSeller.access).toBe('off');
  });

  it('пара без членства не отвечает: чужой человек в чужой организации и несуществующие id', async () => {
    expect(await service().context(ids.stranger, ids.orgA)).toBeNull();
    expect(await service().context(ids.owner, ids.orgB)).toBeNull();
    expect(await service().context(randomUUID(), ids.orgA)).toBeNull();
  });
});
