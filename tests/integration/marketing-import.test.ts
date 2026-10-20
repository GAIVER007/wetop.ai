import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { parseMarketingExpensesCsv } from '@pms/domain';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';

const url = process.env.DATABASE_URL;

/**
 * Импорт расходов маркетинга из CSV (МКТ-В2) на настоящей базе: пачка пишется одной транзакцией.
 * Строка, которую отвергла база, откатывает всю пачку вместе с журналом аудита: повторная загрузка
 * исправленного файла не даёт половинных дублей. Данные вымышленные (ADR-010).
 */
describe.skipIf(!url)('импорт расходов маркетинга (integration)', () => {
  let db: Db;
  let repo: PrismaMarketingBudgetRepository;
  const org = randomUUID();
  let locationId = '';

  const audit = (line: number) => ({ entityType: 'marketing_expense', action: 'marketing_expense.imported', after: { source: 'csv', org, line } });
  const count = async () => ({
    expenses: await db.marketingExpense.count({ where: { locationId } }),
    audits: await db.auditLog.count({ where: { action: 'marketing_expense.imported', after: { path: ['org'], equals: org } } }),
  });

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: `Маркетинг импорт ${org}` } });
    const property = await createPropertyInChain(db, org, {
      name: `Импорт ${org}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    locationId = (await db.property.findUniqueOrThrow({ where: { id: property.id }, select: { locationId: true } })).locationId;
    repo = new PrismaMarketingBudgetRepository({ db } as PrismaService);
  });

  afterAll(async () => {
    if (!db) return;
    await purgeAuditRows(db, { action: 'marketing_expense.imported', after: { path: ['org'], equals: org } });
    await db.marketingExpense.deleteMany({ where: { locationId } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await deleteOrganizationChain(db, [org]);
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  it('файл из двух строк: два расхода и две записи журнала; строка, отвергнутая базой, откатывает пачку', async () => {
    const rows = parseMarketingExpensesCsv(
      'Дата;Платформа;Статья;Сумма;Валюта;Курс\n05.10.2026;Meta Ads;Реклама;12 500,50;;\n2026-10-06;Google Ads;Реклама;20;USD;543.27',
      { reportingCurrency: 'KZT' },
    );
    const items = rows.map(({ line, ...input }) => ({ input, audit: audit(line) }));
    expect(await repo.createExpenses(locationId, items)).toBe(2);
    expect(await count()).toEqual({ expenses: 2, audits: 2 });
    const saved = await db.marketingExpense.findMany({ where: { locationId }, orderBy: { date: 'asc' } });
    expect(saved.map((e) => [e.platform, e.baseAmount])).toEqual([
      ['META', 1250050n],
      ['GOOGLE', 1086540n],
    ]);

    // валюта строчными нарушает CHECK базы: первая строка пачки уже вставлена и должна откатиться
    const broken = [items[0]!, { input: { ...items[1]!.input, currency: 'usd' }, audit: audit(3) }];
    await expect(repo.createExpenses(locationId, broken)).rejects.toThrow();
    expect(await count()).toEqual({ expenses: 2, audits: 2 });
  });
});
