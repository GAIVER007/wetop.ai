import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  MarketingBudgetError,
  parseMarketingBudgetInput,
  parseMarketingExpenseInput,
} from '@pms/domain';
import {
  MARKETING_BUDGET_REPOSITORY,
  type ExpenseRecord,
  type MarketingBudgetRepository,
} from './marketing-budget.repository';

/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, ТЗ «Модуль Маркетинг» 1.0, DATA_MODEL §32).
 * Правила разбора: в домене (@pms/domain marketing/budget); деньги наружу уходят строками
 * minor units (ADR-008). Производные числа (израсходовано, прогноз, распределение) считает
 * стойка: API отдаёт строки и план.
 */

export interface ExpenseRow {
  id: string;
  date: string;
  platform: string;
  campaign: string | null;
  category: string;
  description: string | null;
  amount: string;
  currency: string;
  fxRate: string;
  baseAmount: string;
  countedInBudget: boolean;
}

export interface BudgetView {
  /** ГГГГ-ММ окна */
  month: string;
  /** Сегодня в поясе филиала: от него стойка считает прогноз и «дней до конца» */
  today: string;
  reportingCurrency: string;
  locationCurrency: string;
  /** План месяца в валюте отчётности, minor units; null: план не задан */
  plan: string | null;
  /** Учтённый расход прошлого месяца: динамика на экране аналитики */
  prevSpent: string;
  expenses: ExpenseRow[];
}

const MONTH = /^(\d{4})-(\d{2})$/;

function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MarketingBudgetError) throw new BadRequestException(e.message);
    throw e;
  }
}

/** Сегодня в IANA-поясе филиала (AGENTS.md §13) */
const todayIn = (timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

/** Первое число месяца со сдвигом в месяцах: ('2026-10', 1) → '2026-11-01' */
const firstOf = (month: string, shift: number): string => {
  const m = MONTH.exec(month)!;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + shift;
  const y = Math.floor(total / 12);
  const mm = String((total % 12) + 1).padStart(2, '0');
  return `${y}-${mm}-01`;
};

const toRow = (r: ExpenseRecord): ExpenseRow => ({
  id: r.id,
  date: r.date,
  platform: r.platform,
  campaign: r.campaign,
  category: r.category,
  description: r.description,
  amount: r.amount.toString(),
  currency: r.currency,
  fxRate: r.fxRate,
  baseAmount: r.baseAmount.toString(),
  countedInBudget: r.countedInBudget,
});

@Injectable()
export class MarketingBudgetService {
  constructor(
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
  ) {}

  async view(month?: string): Promise<BudgetView> {
    const scope = await this.repo.scope();
    const today = todayIn(scope.timezone);
    const window = month ?? today.slice(0, 7);
    if (!MONTH.test(window)) throw new BadRequestException('Месяц: в виде ГГГГ-ММ');
    const data = await this.repo.monthData(
      scope.locationId,
      firstOf(window, 0),
      firstOf(window, 1),
      firstOf(window, -1),
    );
    return {
      month: window,
      today,
      reportingCurrency: scope.reportingCurrency,
      locationCurrency: scope.locationCurrency,
      plan: data.plan === null ? null : data.plan.toString(),
      prevSpent: data.prevSpent.toString(),
      expenses: data.expenses.map(toRow),
    };
  }

  async createExpense(dto: Record<string, unknown>): Promise<ExpenseRow> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = rule(() =>
      parseMarketingExpenseInput(dto, { reportingCurrency: scope.reportingCurrency }),
    );
    const row = await this.repo.createExpense(scope.locationId, input, {
      entityType: 'marketing_expense',
      action: 'marketing_expense.created',
      after: { ...dto, locationId: scope.locationId },
    });
    return toRow(row);
  }

  async updateExpense(id: string, dto: Record<string, unknown>): Promise<ExpenseRow> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = rule(() =>
      parseMarketingExpenseInput(dto, { reportingCurrency: scope.reportingCurrency }),
    );
    const row = await this.repo.updateExpense(scope.locationId, id, input, {
      entityType: 'marketing_expense',
      entityId: id,
      action: 'marketing_expense.updated',
      after: { ...dto },
    });
    if (!row) throw new NotFoundException('Расход не найден');
    return toRow(row);
  }

  async deleteExpense(id: string): Promise<{ ok: true }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const gone = await this.repo.deleteExpense(scope.locationId, id, {
      entityType: 'marketing_expense',
      entityId: id,
      action: 'marketing_expense.deleted',
      after: {},
    });
    if (!gone) throw new NotFoundException('Расход не найден');
    return { ok: true };
  }

  async setPlan(dto: Record<string, unknown>): Promise<{ month: string; amount: string }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = rule(() => parseMarketingBudgetInput(dto));
    await this.repo.setPlan(scope.locationId, input.month, input.amount, {
      entityType: 'marketing_budget',
      action: 'marketing_budget.set',
      after: { month: input.month, amount: input.amount.toString() },
    });
    return { month: input.month.slice(0, 7), amount: input.amount.toString() };
  }
}
