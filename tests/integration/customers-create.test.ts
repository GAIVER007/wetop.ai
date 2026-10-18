import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { makeClients, seedUser, url } from './core-security/harness';

describe.skipIf(!url)('M4-A: создание клиента через настоящую RLS-роль', () => {
  let admin: Db;
  let tenant: Db;
  let service: BeautyCatalogService;
  let userId: string;
  const org = randomUUID(), otherOrg = randomUUID(), business = randomUUID(), sibling = randomUUID();
  const run = <T>(fn: () => Promise<T>, businessId = business) => withSignedInUser({
    userId, organizationId: org, role: 'OWNER', scope: 'BUSINESS', businessId, vertical: 'BEAUTY',
  }, fn);

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    for (const id of [org, otherOrg])
      await admin.organization.create({ data: { id, name: 'Синтетическая организация M4', status: 'ACTIVE' } });
    for (const id of [business, sibling])
      await admin.business.create({ data: { id, organizationId: org, name: 'Синтетический салон M4', vertical: 'BEAUTY' } });
    userId = await seedUser(admin, org, 'OWNER', 'M4A');
    service = new BeautyCatalogService({ db: tenant } as PrismaService);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: { in: [org, otherOrg] } } });
      await tx.customerBusiness.deleteMany({ where: { customer: { organizationId: { in: [org, otherOrg] } } } });
      await tx.customer.deleteMany({ where: { organizationId: { in: [org, otherOrg] } } });
      await tx.business.deleteMany({ where: { id: { in: [business, sibling] } } });
      await tx.membership.deleteMany({ where: { organizationId: { in: [org, otherOrg] } } });
      if (userId) await tx.user.delete({ where: { id: userId } });
      await tx.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
    });
    await tenant?.$disconnect(); await admin.$disconnect();
  });

  it('создаёт клиента и audit без Appointment и не принимает scope из тела', async () => {
    const result = await run(() => service.createCustomer({
      firstName: 'Синтетический клиент', phone: '8 (700) 000-40-01', organizationId: otherOrg,
    }));
    expect(result.created).toBe(true);
    const customer = await admin.customer.findUniqueOrThrow({ where: { id: result.id } });
    expect(customer).toMatchObject({ organizationId: org, phone: '8 (700) 000-40-01', phoneNormalized: '+77000004001' });
    expect(await admin.appointment.count({ where: { customerId: result.id } })).toBe(0);
    expect(await admin.customerBusiness.count({ where: { customerId: result.id, businessId: business } })).toBe(1);
    expect(await admin.auditLog.count({ where: { entityId: result.id, userId, action: 'beauty.customer.created' } })).toBe(1);
  });

  it('привязывает карточку другого бизнеса организации и сохраняет профиль/историю', async () => {
    const existing = await admin.customer.create({ data: { organizationId: org, firstName: 'Исходное тестовое имя', phone: '87000004002' } });
    await admin.customerBusiness.create({ data: { customerId: existing.id, businessId: sibling } });
    const result = await run(() => service.createCustomer({ firstName: 'Другое имя', phone: '7000004002' }));
    expect(result).toEqual({ id: existing.id, created: false });
    expect((await admin.customer.findUniqueOrThrow({ where: { id: existing.id } })).firstName).toBe('Исходное тестовое имя');
    expect(await admin.customerBusiness.count({ where: { customerId: existing.id } })).toBe(2);
    await run(() => service.createCustomer({ firstName: 'Повтор', phone: '+77000004002' }));
    expect(await admin.auditLog.count({ where: { entityId: existing.id, action: 'beauty.customer.linked' } })).toBe(1);
  });

  it('не переиспользует клиента чужой организации и не позволяет обойти RLS напрямую', async () => {
    const foreign = await admin.customer.create({ data: { organizationId: otherOrg, firstName: 'Чужой тестовый клиент', phone: '+77000004003' } });
    const result = await run(() => service.createCustomer({ firstName: 'Свой тестовый клиент', phone: '87000004003' }));
    expect(result.id).not.toBe(foreign.id);
    expect(result.created).toBe(true);
    await expect(run(() => tenant.customer.create({ data: { organizationId: otherOrg, firstName: 'Запрещённый тест', phone: '+77000004004' } }))).rejects.toThrow();
    expect(await run(() => tenant.customer.findUnique({ where: { id: foreign.id } }))).toBeNull();
  });

  it('два бизнеса при конкурентном создании не получают двух клиентов одного номера', async () => {
    const results = await Promise.allSettled([
      run(() => service.createCustomer({ firstName: 'Тест гонки 1', phone: '+77000004005' })),
      run(() => service.createCustomer({ firstName: 'Тест гонки 2', phone: '87000004005' }), sibling),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled' && r.value.created)).toHaveLength(1);
    expect(await admin.customer.count({ where: { organizationId: org, phoneNormalized: '+77000004005' } })).toBe(1);
  });
});
