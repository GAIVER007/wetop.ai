import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  createdAt: new Date('2026-10-08T10:00:00Z'),
};

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
    return { plan: 300000n, expenses: [ROW], prevSpent: 5000n };
  }
  async createExpense(_l: string, _i: unknown, audit: BudgetAudit): Promise<ExpenseRecord> {
    this.audits.push(audit);
    return ROW;
  }
  async updateExpense(_l: string, _id: string, _i: unknown, audit: BudgetAudit) {
    this.audits.push(audit);
    return this.updateResult;
  }
  async deleteExpense(_l: string, _id: string, audit: BudgetAudit): Promise<boolean> {
    this.audits.push(audit);
    return this.deleteResult;
  }
  async setPlan(_l: string, month: string, amount: bigint, audit: BudgetAudit): Promise<void> {
    this.audits.push(audit);
    this.planSet = { month, amount };
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
});
