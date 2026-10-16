import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { MarketingExpenseInput } from '@pms/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  BudgetAudit,
  BudgetScope,
  ExpenseRecord,
  MarketingBudgetRepository,
} from './marketing-budget.repository';
import { MarketingBudgetService } from './marketing-budget.service';

const SCOPE: BudgetScope = {
  organizationId: 'org-1',
  locationId: 'loc-1',
  locationCurrency: 'KZT',
  timezone: 'Asia/Almaty',
  reportingCurrency: 'KZT',
};

const ROW: ExpenseRecord = {
  id: '7b61f3e1-0000-4000-8000-000000000001',
  date: '2026-10-08',
  platform: 'META',
  campaign: null,
  category: 'Реклама',
  description: null,
  amount: 12000n,
  currency: 'KZT',
  fxRate: '1',
  baseAmount: 12000n,
  countedInBudget: true,
  campaignId: null,
  createdAt: new Date('2026-10-08T10:00:00Z'),
};

const OWN_CAMPAIGN = '7b61f3e1-0000-4000-8000-0000000000c1';

class FakeRepo implements MarketingBudgetRepository {
  writable = true;
  monthArgs: unknown[] = [];
  audits: BudgetAudit[] = [];
  planSet: { month: string; amount: bigint } | null = null;
  updateResult: ExpenseRecord | null = ROW;
  deleteResult = true;

  async scope(): Promise<BudgetScope> {
    return SCOPE;
  }
  async assertWritable(): Promise<void> {
    if (!this.writable) throw new Error('read only');
  }
  async monthData(locationId: string, first: string, nextFirst: string, prevFirst: string) {
    this.monthArgs = [locationId, first, nextFirst, prevFirst];
    return {
      plan: 300000n,
      expenses: [ROW],
      prevSpent: 5000n,
      lines: [{ platform: 'META' as const, amount: 200000n }],
      prevLines: [{ platform: 'GOOGLE' as const, amount: 50000n }],
    };
  }
  created: unknown = null;
  async createExpense(_l: string, input: unknown, audit: BudgetAudit): Promise<ExpenseRecord> {
    this.audits.push(audit);
    this.created = input;
    return ROW;
  }
  async campaignName(locationId: string, id: string): Promise<string | null> {
    return locationId === 'loc-1' && id === OWN_CAMPAIGN ? 'Осень: лиды' : null;
  }
  async updateExpense(_l: string, _id: string, _i: unknown, audit: BudgetAudit) {
    this.audits.push(audit);
    return this.updateResult;
  }
  async deleteExpense(_l: string, _id: string, audit: BudgetAudit): Promise<boolean> {
    this.audits.push(audit);
    return this.deleteResult;
  }
  linesSet: { month: string; lines: Array<{ platform: string; amount: bigint }> } | null = null;
  async setLines(_l: string, month: string, lines: Array<{ platform: string; amount: bigint }>, audit: BudgetAudit) {
    this.audits.push(audit);
    this.linesSet = { month, lines };
  }
  async setPlan(_l: string, month: string, amount: bigint, audit: BudgetAudit): Promise<void> {
    this.audits.push(audit);
    this.planSet = { month, amount };
  }
  imported: Array<{ input: MarketingExpenseInput; audit: BudgetAudit }> = [];
  async createExpenses(_l: string, items: Array<{ input: MarketingExpenseInput; audit: BudgetAudit }>) {
    this.imported = items;
    return items.length;
  }
  resultsArgs: unknown[] = [];
  async results(locationId: string, first: string, nextFirst: string) {
    this.resultsArgs = [locationId, first, nextFirst];
    return {
      supported: true,
      revenueCurrency: 'KZT',
      channels: [
        { channel: 'SITE' as const, leads: 5, bookings: 2, revenueMinor: 900000n },
        { channel: 'WHATSAPP' as const, leads: 3, bookings: 1, revenueMinor: 250000n },
      ],
      days: [{ date: '2026-10-02', leads: 8, bookings: 3, newGuests: 2, revenueMinor: 1150000n }],
    };
  }
}

describe('сервис бюджета маркетинга (МКТ-В1/В2)', () => {
  let repo: FakeRepo;
  let service: MarketingBudgetService;

  beforeEach(() => {
    repo = new FakeRepo();
    service = new MarketingBudgetService(repo);
  });

  it('view: месяц из запроса, границы окна и сериализация денег строками', async () => {
    const view = await service.view('2026-10');
    expect(repo.monthArgs).toEqual(['loc-1', '2026-10-01', '2026-11-01', '2026-09-01']);
    expect(view.month).toBe('2026-10');
    expect(view.plan).toBe('300000');
    expect(view.prevSpent).toBe('5000');
    expect(view.reportingCurrency).toBe('KZT');
    expect(view.expenses[0]).toMatchObject({
      amount: '12000',
      baseAmount: '12000',
      platform: 'META',
      date: '2026-10-08',
    });
  });

  it('view: границы декабря и января считаются без сдвига', async () => {
    await service.view('2026-12');
    expect(repo.monthArgs).toEqual(['loc-1', '2026-12-01', '2027-01-01', '2026-11-01']);
    await service.view('2026-01');
    expect(repo.monthArgs).toEqual(['loc-1', '2026-01-01', '2026-02-01', '2025-12-01']);
  });

  it('view: без месяца берётся текущий месяц филиала, в ответе есть today', async () => {
    const view = await service.view(undefined);
    expect(view.month).toMatch(/^\d{4}-\d{2}$/);
    expect(view.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(view.today.startsWith(view.month)).toBe(true);
  });

  it('view: кривой месяц: отказ словами', async () => {
    await expect(service.view('октябрь')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('создание: кривой ввод → 400, корректный → строка и журнал', async () => {
    await expect(service.createExpense({ date: 'вчера' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const row = await service.createExpense({
      date: '2026-10-08',
      platform: 'META',
      category: 'Реклама',
      amount: '120',
    });
    expect(row.amount).toBe('12000');
    expect(repo.audits[0]!.action).toBe('marketing_expense.created');
  });

  it('правка несуществующего: 404', async () => {
    repo.updateResult = null;
    await expect(
      service.updateExpense(ROW.id, {
        date: '2026-10-08',
        platform: 'META',
        category: 'Реклама',
        amount: '120',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('удаление несуществующего: 404, существующего: журнал', async () => {
    repo.deleteResult = false;
    await expect(service.deleteExpense(ROW.id)).rejects.toBeInstanceOf(NotFoundException);
    repo.deleteResult = true;
    await service.deleteExpense(ROW.id);
    expect(repo.audits.at(-1)!.action).toBe('marketing_expense.deleted');
  });

  it('план: месяц нормализуется, сумма в тиынах, журнал пишется', async () => {
    const res = await service.setPlan({ month: '2026-10', amount: '3000' });
    expect(repo.planSet).toEqual({ month: '2026-10-01', amount: 300000n });
    expect(res).toEqual({ month: '2026-10', amount: '300000' });
    expect(repo.audits[0]!.action).toBe('marketing_budget.set');
  });

  it('results: окно месяца как у бюджета, деньги строками, валюта выручки отдельно', async () => {
    const r = await service.results('2026-10');
    expect(repo.resultsArgs).toEqual(['loc-1', '2026-10-01', '2026-11-01']);
    expect(r.month).toBe('2026-10');
    expect(r.reportingCurrency).toBe('KZT');
    expect(r.revenueCurrency).toBe('KZT');
    expect(r.supported).toBe(true);
    expect(r.channels).toEqual([
      { channel: 'SITE', leads: 5, bookings: 2, revenue: '900000' },
      { channel: 'WHATSAPP', leads: 3, bookings: 1, revenue: '250000' },
    ]);
    expect(r.days).toEqual([{ date: '2026-10-02', leads: 8, bookings: 3, newGuests: 2, revenue: '1150000' }]);
  });

  it('results: кривой месяц: отказ словами', async () => {
    await expect(service.results('октябрь')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('импорт CSV: все строки одной пачкой, у каждой своя запись журнала, итог в валюте отчётности', async () => {
    const csv = 'Дата;Платформа;Статья;Сумма;Валюта;Курс\n2026-10-05;Meta Ads;Реклама;100;;\n2026-10-06;Google Ads;Реклама;10;USD;500';
    const r = await service.importExpenses({ csv });
    expect(r).toEqual({ imported: 2, baseTotal: '510000' });
    expect(repo.imported.map((i) => i.input.platform)).toEqual(['META', 'GOOGLE']);
    expect(repo.imported.map((i) => i.audit.action)).toEqual(['marketing_expense.imported', 'marketing_expense.imported']);
    expect(repo.imported[1]!.audit.after).toMatchObject({ source: 'csv', line: 3, locationId: 'loc-1', amount: '1000', baseAmount: '500000' });
  });

  it('импорт CSV: ошибка в любой строке или не текст: 400, в базу ничего', async () => {
    await expect(service.importExpenses({ csv: 'Дата;Платформа;Статья;Сумма\n2026-10-05;Яндекс;Реклама;100' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.importExpenses({})).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.imported).toEqual([]);
  });

  it('импорт CSV: организация только для чтения: отказ до разбора', async () => {
    repo.writable = false;
    await expect(service.importExpenses({ csv: 'x' })).rejects.toThrow('read only');
  });

  it('план по каналам: разбивка месяца и прошлого месяца строками в ответе бюджета', async () => {
    const v = await service.view('2026-10');
    expect(v.lines).toEqual([{ platform: 'META', amount: '200000' }]);
    expect(v.prevLines).toEqual([{ platform: 'GOOGLE', amount: '50000' }]);
  });

  it('план по каналам: разбивка месяца заменяется целиком, в журнал суммы строками', async () => {
    const r = await service.setLines({ month: '2026-10', lines: [{ platform: 'META', amount: '1500' }, { platform: 'SITE', amount: '' }] });
    expect(r).toEqual({ month: '2026-10', lines: [{ platform: 'META', amount: '150000' }] });
    expect(repo.linesSet).toEqual({ month: '2026-10-01', lines: [{ platform: 'META', amount: 150000n }] });
    expect(repo.audits.at(-1)).toMatchObject({
      entityType: 'marketing_budget',
      action: 'marketing_budget.lines_set',
      after: { month: '2026-10-01', lines: [{ platform: 'META', amount: '150000' }] },
    });
    await expect(service.setLines({ month: '2026-10', lines: [{ platform: 'YANDEX', amount: '1' }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('план по каналам: организация только для чтения: отказ', async () => {
    repo.writable = false;
    await expect(service.setLines({ month: '2026-10', lines: [] })).rejects.toThrow('read only');
  });

  it('расход и кампания (§53): своя кампания подставляет имя, чужая или несуществующая: 400', async () => {
    await service.createExpense({ date: '2026-10-08', platform: 'META', category: 'Реклама', amount: '120', campaign: 'старое', campaignId: OWN_CAMPAIGN });
    expect(repo.created).toMatchObject({ campaignId: OWN_CAMPAIGN, campaign: 'Осень: лиды' });
    await expect(
      service.createExpense({ date: '2026-10-08', platform: 'META', category: 'Реклама', amount: '120', campaignId: '7b61f3e1-0000-4000-8000-0000000000ff' }),
    ).rejects.toThrow('Кампания не найдена');
  });
});
