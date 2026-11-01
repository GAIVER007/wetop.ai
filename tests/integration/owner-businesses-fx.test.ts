import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { withServiceDatabase, withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { ExchangeRatesService } from '../../apps/api/src/platform/exchange-rates';
import { OwnerBusinessesController } from '../../apps/api/src/platform/owner-businesses.controller';
import type { MoneyRepository } from '../../apps/api/src/platform/money.repository';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * «Все бизнесы» в валюте компании по курсу Нацбанка РК на день операции (владелец 01.11.2026, миграция 180): загрузчик
 * пишет настоящий сохранённый ответ Нацбанка за 31.10.2026 в `exchange_rates`, филиал салона в QAR с записью 31 октября
 * показывается в тенге по 124,52, филиал в тенге как есть, итог один. Вымышленные данные, только локальная база.
 */
describe('все бизнесы в тенге по курсу Нацбанка (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db;
  const org = randomUUID(), user = randomUUID(), kzt = randomUUID(), qar = randomUUID();
  const lkzt = randomUUID(), lqar = randomUUID();
  const xml = readFileSync(new URL('../../apps/api/src/platform/__fixtures__/nbk-2026-10-31.xml', import.meta.url), 'utf8');
  const as = <T>(fn: () => Promise<T>) =>
    withSignedInUser({ userId: user, organizationId: org, role: 'OWNER', scope: 'ORGANIZATION' }, fn);

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: 'Курсы Нацбанка', status: 'ACTIVE', reportingCurrency: 'KZT' } });
    await db.user.create({ data: { id: user, email: `fx-${user}@example.invalid`, name: 'Владелец' } });
    await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER', status: 'ACTIVE' } });
    for (const [id, name] of [[kzt, 'Салон Алматы'], [qar, 'Салон Доха']] as const)
      await db.business.create({ data: { id, organizationId: org, name, vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: lkzt, businessId: kzt, name: 'Алматы', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.location.create({ data: { id: lqar, businessId: qar, name: 'Доха', timezone: 'Asia/Qatar', currency: 'QAR' } });
    for (const [b, l, cur, price] of [[kzt, lkzt, 'KZT', 1_000_000n], [qar, lqar, 'QAR', 10_000n]] as const) {
      const service = await db.beautyService.create({ data: { businessId: b, name: 'Стрижка', durationMinutes: 60, price, currency: cur } });
      const master = await db.employee.create({ data: { businessId: b, name: 'Мастер' } });
      await db.employeeLocation.create({ data: { employeeId: master.id, locationId: l } });
      await db.employeeService.create({ data: { employeeId: master.id, serviceId: service.id } });
      await db.locationService.create({ data: { locationId: l, serviceId: service.id, enabled: true } });
      const customer = await db.customer.create({ data: { organizationId: org, firstName: 'Гость', businesses: { create: { businessId: b } } } });
      // 31 октября 12:00 по поясу филиала
      const startsAt = new Date(cur === 'QAR' ? '2026-10-31T09:00:00Z' : '2026-10-31T07:00:00Z');
      await db.appointment.create({
        data: {
          locationId: l, customerId: customer.id, employeeId: master.id, serviceId: service.id, startsAt,
          endsAt: new Date(startsAt.getTime() + 3_600_000), status: 'DONE', price, currency: cur,
        },
      });
    }
  });
  afterAll(async () => db?.$disconnect());

  it('загрузчик пишет курс дня, «Все бизнесы» показывает всё в тенге', async () => {
    const prisma = { db } as unknown as PrismaService;
    await db.$executeRaw`DELETE FROM exchange_rates WHERE rate_date = '2026-10-31'`.catch(() => undefined);
    const loader = new ExchangeRatesService(prisma, async (day) => {
      if (day === '2026-10-31') return xml;
      throw new Error('нет сети в тесте');
    });
    const sync = await loader.sync(new Date('2026-10-31T12:00:00Z'));
    expect(sync.days).toBe(1);
    const usd = await db.exchangeRate.findUniqueOrThrow({
      where: { rateDate_currency: { rateDate: new Date('2026-10-31T00:00:00Z'), currency: 'QAR' } },
    });
    expect(usd.kztPerUnitMicro).toBe(124_520_000n);
    // повтор того же дня ничего не пишет
    expect((await loader.sync(new Date('2026-10-31T12:00:00Z'))).days).toBe(0);

    const money = { ready: async () => false, source: async () => ({ payments: [], expenses: [] }) } as unknown as MoneyRepository;
    const view = await withServiceDatabase(() =>
      as(() => new OwnerBusinessesController(prisma, money).businesses('2026-10')),
    );
    // 100,00 QAR × 124,52 = 12 452,00 ₸; плюс 10 000,00 ₸
    expect(view.totals).toEqual([
      { currency: 'KZT', revenueMinor: String(1_000_000n + 1_245_200n), expensesMinor: '0', profitMinor: String(2_245_200n), previousProfitMinor: '0' },
    ]);
    const doha = view.rows.find((r) => r.name === 'Доха')!;
    expect([doha.currency, doha.revenueMinor, doha.source?.currency, doha.source?.revenueMinor]).toEqual(['KZT', '1245200', 'QAR', '10000']);
    expect(view.fx).toEqual({ currency: 'KZT', source: 'NBK', converted: ['QAR'], approximate: false, missing: [] });
  });
});
