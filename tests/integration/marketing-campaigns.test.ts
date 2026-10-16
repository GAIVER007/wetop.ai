import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingCampaignsService } from '../../apps/api/src/marketing-budget/campaigns';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import { MarketingBudgetService } from '../../apps/api/src/marketing-budget/marketing-budget.service';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Рекламные кампании (DATA_MODEL §53, ADR-MKT-B3) на настоящей базе: имя одно на площадку филиала, деньги кампании это
 * её учтённые расходы месяца, день статистики заменяется вводом, CSV всё или ничего, кампания другого филиала неотличима
 * от несуществующей, переименование доходит до текста у расходов. Данные вымышленные (ADR-010).
 */
describe('рекламные кампании (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Кампании проверяются только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const db = prisma.db;
  const repo = new PrismaMarketingBudgetRepository(prisma);
  const campaigns = new MarketingCampaignsService(prisma, repo);
  const budget = new MarketingBudgetService(repo);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const branch = { own: { business: randomUUID(), location: randomUUID() }, other: { business: randomUUID(), location: randomUUID() } };
  const as = <T>(b: keyof typeof branch, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, scope: 'LOCATION', businessId: branch[b].business, locationId: branch[b].location, vertical: 'HOSPITALITY' },
      fn,
    );
  const ids: string[] = [];

  beforeAll(async () => {
    await db.user.create({ data: { id: user, email: `mkt-camp-${tag}@example.invalid` } });
    await db.organization.create({ data: { id: org, name: `Кампании ${tag}`, status: 'ACTIVE' } });
    for (const b of ['own', 'other'] as const) {
      await db.business.create({ data: { id: branch[b].business, organizationId: org, name: `${b} ${tag}`, vertical: 'HOSPITALITY' } });
      await db.location.create({ data: { id: branch[b].location, businessId: branch[b].business, name: `${b} ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    }
  });

  afterAll(async () => {
    await purgeAuditRows(db, { entityId: { in: ids } });
    await purgeAuditRows(db, { entityType: 'marketing_expense', after: { path: ['locationId'], equals: branch.own.location } });
    await db.marketingExpense.deleteMany({ where: { locationId: { in: [branch.own.location, branch.other.location] } } });
    await db.$transaction([
      db.marketingCampaignStat.deleteMany({ where: { campaign: { locationId: { in: [branch.own.location, branch.other.location] } } } }),
      db.marketingCampaign.deleteMany({ where: { locationId: { in: [branch.own.location, branch.other.location] } } }),
    ]);
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.user.deleteMany({ where: { id: user } });
    await prisma.onModuleDestroy();
  });

  it('кампания, расход к ней, статистика дня, CSV и сводка месяца', async () => {
    const { id } = await as('own', () => campaigns.create({ platform: 'META', name: 'Осень: лиды', startsOn: '2026-10-01' }));
    ids.push(id);
    await expect(as('own', () => campaigns.create({ platform: 'META', name: 'Осень: лиды' }))).rejects.toMatchObject({ status: 409 });
    // то же имя на другой площадке можно
    ids.push((await as('own', () => campaigns.create({ platform: 'GOOGLE', name: 'Осень: лиды' }))).id);

    // деньги кампании это её учтённые расходы месяца
    const expense = (date: string, amount: string, counted = true) =>
      as('own', () => budget.createExpense({ date, platform: 'META', category: 'Реклама', amount, campaignId: id, countedInBudget: counted }));
    await expense('2026-10-05', '10000');
    await expense('2026-10-06', '5000');
    await expense('2026-10-07', '999', false); // вне бюджета не считается
    await expense('2026-09-30', '700'); // прошлый месяц не считается
    const linked = await db.marketingExpense.findFirstOrThrow({ where: { campaignId: id, date: new Date('2026-10-05T00:00:00Z') } });
    expect(linked.campaign).toBe('Осень: лиды');

    await as('own', () => campaigns.setDay(id, { date: '2026-10-05', impressions: '20 000', clicks: '200', leads: '5' }));
    await as('own', () => campaigns.setDay(id, { date: '2026-10-05', impressions: '25000', clicks: '300', leads: '10' })); // замена
    await expect(as('own', () => campaigns.setDay(id, { date: '2026-10-06', impressions: '10', clicks: '20' }))).rejects.toMatchObject({ status: 400 });
    await as('own', () => campaigns.importDays(id, { csv: 'Дата;Показы;Клики;Лиды\n06.10.2026;5000;50;2\n2026-10-07;1000;10;0' }));
    // CSV с ошибкой ничего не пишет
    await expect(as('own', () => campaigns.importDays(id, { csv: 'Дата;Показы;Клики\n2026-10-08;1;1\n2026-10-09;1;5' }))).rejects.toMatchObject({ status: 400 });

    const oct = await as('own', () => campaigns.list('2026-10'));
    const meta = oct.campaigns.find((c) => c.id === id)!;
    expect(meta).toMatchObject({ spend: '1500000', impressions: 31000, clicks: 360, leads: 12, startsOn: '2026-10-01' });
    expect(meta.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect((await as('own', () => campaigns.list('2026-09'))).campaigns.find((c) => c.id === id)).toMatchObject({ spend: '70000', impressions: 0 });

    await as('own', () => campaigns.removeDay(id, '2026-10-07'));
    await expect(as('own', () => campaigns.removeDay(id, '2026-10-07'))).rejects.toMatchObject({ status: 404 });
  });

  it('чужой филиал: кампании не видно, расход к ней не привязать; переименование доходит до расходов', async () => {
    const id = ids[0]!;
    expect((await as('other', () => campaigns.list('2026-10'))).campaigns).toEqual([]);
    await expect(as('other', () => campaigns.setDay(id, { date: '2026-10-05', impressions: '1' }))).rejects.toMatchObject({ status: 404 });
    await expect(
      as('other', () => budget.createExpense({ date: '2026-10-05', platform: 'META', category: 'Реклама', amount: '1', campaignId: id })),
    ).rejects.toMatchObject({ status: 400 });

    await as('own', () => campaigns.update(id, { platform: 'META', name: 'Осень: брони', status: 'FINISHED' }));
    expect(await db.marketingExpense.count({ where: { campaignId: id, campaign: 'Осень: брони' } })).toBe(4);
    await expect(as('own', () => campaigns.update(id, { platform: 'GOOGLE', name: 'Осень: лиды' }))).rejects.toMatchObject({ status: 409 });
  });

  it('кампания из кабинета (§55): ручная правка, день и CSV отклоняются словами, данные не меняются', async () => {
    const cabinet = await db.marketingCampaign.create({
      data: { locationId: branch.own.location, platform: 'META', name: 'Из кабинета', externalId: '120200000000777' },
      select: { id: true },
    });
    ids.push(cabinet.id);
    const attempts: Array<() => Promise<unknown>> = [
      () => campaigns.update(cabinet.id, { platform: 'META', name: 'Руками' }),
      () => campaigns.setDay(cabinet.id, { date: '2026-10-05', impressions: '1' }),
      () => campaigns.importDays(cabinet.id, { csv: 'Дата;Показы\n2026-10-05;1' }),
      () => campaigns.removeDay(cabinet.id, '2026-10-05'),
    ];
    for (const attemptIt of attempts) await expect(as('own', attemptIt)).rejects.toMatchObject({ status: 409 });
    expect(await db.marketingCampaign.findUniqueOrThrow({ where: { id: cabinet.id }, select: { name: true } })).toEqual({ name: 'Из кабинета' });
    expect(await db.marketingCampaignStat.count({ where: { campaignId: cabinet.id } })).toBe(0);
  });
});

