import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  MarketingBudgetError,
  parseMarketingBudgetInput,
  parseMarketingBudgetLinesInput,
  parseMarketingExpenseInput,
  parseMarketingExpensesCsv,
  type MarketingExpenseInput,
} from '@pms/domain';
import {
  MARKETING_BUDGET_REPOSITORY,
  type ExpenseRecord,
  type MarketingBudgetRepository,
} from './marketing-budget.repository';
import { SITE_ASSET_STORAGE, type SiteAssetStorage } from '../marketing-site/asset-storage';
import { signFiles, type ExpenseFileView } from './expense-files';

/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, ТЗ «Модуль Маркетинг» 1.0, DATA_MODEL §41).
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
  campaignId: string | null;
  /** Чеки и файлы (§51) с подписанными адресами: в ответе месяца */
  files?: ExpenseFileView[];
}

export interface BudgetLineRow {
  platform: string;
  amount: string;
}

const lineRow = (l: { platform: string; amount: bigint }): BudgetLineRow => ({
  platform: l.platform,
  amount: l.amount.toString(),
});

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
  /** Разбивка плана по каналам (§52), суммы строками minor units */
  lines: BudgetLineRow[];
  /** Разбивка прошлого месяца: «взять из прошлого месяца» */
  prevLines: BudgetLineRow[];
  expenses: ExpenseRow[];
}

/** Результаты каналов для «Аналитики маркетинга»; выручка строкой minor units в валюте объекта */
export interface ResultsView {
  month: string;
  reportingCurrency: string;
  revenueCurrency: string | null;
  /** false: у филиала нет броней гостиницы (салон, ресторан) */
  supported: boolean;
  channels: Array<{ channel: string; leads: number; bookings: number; revenue: string }>;
  /** Дни с активностью: обращения, живые брони, из них новые гости, выручка */
  days: Array<{ date: string; leads: number; bookings: number; newGuests: number; revenue: string }>;
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
  campaignId: r.campaignId,
});

@Injectable()
export class MarketingBudgetService {
  constructor(
    @Inject(MARKETING_BUDGET_REPOSITORY) private readonly repo: MarketingBudgetRepository,
    @Optional() @Inject(SITE_ASSET_STORAGE) private readonly storage: SiteAssetStorage | null = null,
  ) {}

  /**
   * Результаты маркетинговых каналов за месяц (МКТ-В5a, Q-MKT-ATTR): обращения, брони и выручка.
   * Воронку с расходами и CPL/ROMI собирает стойка доменной `buildMarketingFunnel`.
   */
  async results(month?: string): Promise<ResultsView> {
    const scope = await this.repo.scope();
    const window = month ?? todayIn(scope.timezone).slice(0, 7);
    if (!MONTH.test(window)) throw new BadRequestException('Месяц: в виде ГГГГ-ММ');
    const data = await this.repo.results(scope.locationId, firstOf(window, 0), firstOf(window, 1));
    return {
      month: window,
      reportingCurrency: scope.reportingCurrency,
      revenueCurrency: data.revenueCurrency,
      supported: data.supported,
      channels: data.channels.map((c) => ({
        channel: c.channel,
        leads: c.leads,
        bookings: c.bookings,
        revenue: c.revenueMinor.toString(),
      })),
      days: data.days.map((d) => ({
        date: d.date,
        leads: d.leads,
        bookings: d.bookings,
        newGuests: d.newGuests,
        revenue: d.revenueMinor.toString(),
      })),
    };
  }

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
      lines: data.lines.map(lineRow),
      prevLines: data.prevLines.map(lineRow),
      expenses: await Promise.all(
        data.expenses.map(async (r) => ({ ...toRow(r), files: await signFiles(this.storage, r.files ?? []) })),
      ),
    };
  }

  /** Кампания расхода (§53): только своего филиала; текстовое поле получает её имя */
  private async withCampaign(locationId: string, input: MarketingExpenseInput): Promise<MarketingExpenseInput> {
    if (!input.campaignId) return input;
    const name = await this.repo.campaignName(locationId, input.campaignId);
    if (name === null) throw new BadRequestException('Кампания не найдена в этом филиале');
    return { ...input, campaign: name };
  }

  async createExpense(dto: Record<string, unknown>): Promise<ExpenseRow> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = await this.withCampaign(
      scope.locationId,
      rule(() => parseMarketingExpenseInput(dto, { reportingCurrency: scope.reportingCurrency })),
    );
    const row = await this.repo.createExpense(scope.locationId, input, {
      entityType: 'marketing_expense',
      action: 'marketing_expense.created',
      after: { ...dto, locationId: scope.locationId },
    });
    return toRow(row);
  }

  /**
   * Импорт расходов из CSV (МКТ-В2): файл формата выгрузки разбирает домен, запись одной транзакцией.
   * Ошибка в любой строке: 400 со списком строк, в базу ничего (повторная загрузка того же файла
   * после правки не даёт половинных дублей).
   */
  async importExpenses(dto: Record<string, unknown>): Promise<{ imported: number; baseTotal: string }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    if (typeof dto.csv !== 'string') throw new BadRequestException('Нужен текст CSV-файла');
    const csv = dto.csv;
    const rows = rule(() => parseMarketingExpensesCsv(csv, { reportingCurrency: scope.reportingCurrency }));
    const imported = await this.repo.createExpenses(
      scope.locationId,
      rows.map(({ line, ...input }) => ({
        input,
        audit: {
          entityType: 'marketing_expense',
          action: 'marketing_expense.imported',
          after: {
            source: 'csv',
            line,
            locationId: scope.locationId,
            ...input,
            amount: input.amount.toString(),
            baseAmount: input.baseAmount.toString(),
          },
        },
      })),
    );
    const baseTotal = rows.reduce((sum, r) => sum + r.baseAmount, 0n);
    return { imported, baseTotal: baseTotal.toString() };
  }

  async updateExpense(id: string, dto: Record<string, unknown>): Promise<ExpenseRow> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = await this.withCampaign(
      scope.locationId,
      rule(() => parseMarketingExpenseInput(dto, { reportingCurrency: scope.reportingCurrency })),
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

  /**
   * Разбивка плана месяца по каналам (§52, ADR-MKT-B7) одним вводом: прежняя разбивка месяца заменяется целиком.
   * Сумма каналов больше общего плана не запрещается: это предупреждение на экране.
   */
  async setLines(dto: Record<string, unknown>): Promise<{ month: string; lines: BudgetLineRow[] }> {
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const input = rule(() => parseMarketingBudgetLinesInput(dto));
    const lines = input.lines.map(lineRow);
    await this.repo.setLines(scope.locationId, input.month, input.lines, {
      entityType: 'marketing_budget',
      action: 'marketing_budget.lines_set',
      after: { month: input.month, lines },
    });
    return { month: input.month.slice(0, 7), lines };
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
