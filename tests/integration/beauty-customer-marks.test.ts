import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * VIP-метка и день рождения клиента салона (DATA_MODEL §36, Q-BS-3): те же поля, что у ресторана; клиент виден в
 * бизнесе, дата не в будущем, в журнал идёт отметка «дата изменена», а не сама дата. Вымышленные данные (ADR-010).
 */
describe('пометки клиента салона (integration, §36)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, catalog: BeautyCatalogService;
  const org = randomUUID(), user = randomUUID(), business = randomUUID(), other = randomUUID(), location = randomUUID();
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', vertical: 'BEAUTY', businessId: business, locationId: location },
      fn,
    );
  let mine = '', foreign = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    catalog = new BeautyCatalogService({ db } as unknown as PrismaService);
    await db.organization.create({ data: { id: org, name: 'Пометки клиента', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `marks-${user}@example.invalid`, name: 'Владелец' } });
    for (const id of [business, other]) await db.business.create({ data: { id, organizationId: org, name: 'Салон', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: location, businessId: business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    mine = (await db.customer.create({ data: { organizationId: org, firstName: 'Айгуль', businesses: { create: { businessId: business } } } })).id;
    foreign = (await db.customer.create({ data: { organizationId: org, firstName: 'Чужая', businesses: { create: { businessId: other } } } })).id;
  });
  afterAll(async () => db?.$disconnect());

  it('VIP и дата сохраняются, «через сколько дней» считается; чужой клиент и будущая дата отклоняются', async () => {
    const before = (await as(() => catalog.customers())).items.find((c) => c.id === mine)!;
    expect([before.isVip, before.birthDate, before.birthdayInDays]).toEqual([false, null, null]);
    await as(() => catalog.updateCustomer(mine, { isVip: true, birthDate: '1990-03-15' }));
    const after = (await as(() => catalog.customers())).items.find((c) => c.id === mine)!;
    expect([after.isVip, after.birthDate]).toEqual([true, '1990-03-15']);
    expect(typeof after.birthdayInDays).toBe('number');
    await expect(as(() => catalog.updateCustomer(foreign, { isVip: true }))).rejects.toThrow('Клиент не найден');
    await expect(as(() => catalog.updateCustomer(mine, { birthDate: '2999-01-01' }))).rejects.toThrow();
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: mine, action: 'beauty.customer.marks' } });
    expect(audit.after).toEqual({ isVip: true, birthDateChanged: true });
    expect(JSON.stringify(audit.after)).not.toContain('1990');
  });
});
