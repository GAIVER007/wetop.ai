import 'reflect-metadata';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { canWrite, type MarketingExpenseInput, type MarketingPlatform } from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import {
  currentLocationId,
  currentOrganizationId,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, DATA_MODEL §32, ADR-MKT-B1).
 * Строгий scope филиала, как у сайта (MKT3): филиал берётся только из проверенного указателя,
 * тело запроса филиал не выбирает; без филиала: 409 «Выберите филиал».
 */

export const CHOOSE_LOCATION = 'Выберите филиал';

export interface BudgetScope {
  organizationId: string;
  locationId: string;
  /** Операционная валюта филиала: умолчание формы расхода */
  locationCurrency: string;
  /** IANA-пояс филиала: от него считается «сегодня» (AGENTS.md §13) */
  timezone: string;
  /** Валюта отчётности организации (v2.4): в ней план и пересчитанные суммы */
  reportingCurrency: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  platform: MarketingPlatform;
  campaign: string | null;
  category: string;
  description: string | null;
  amount: bigint;
  currency: string;
  fxRate: string;
  baseAmount: bigint;
  countedInBudget: boolean;
  createdAt: Date;
}

/** Строка журнала, которую запись пишет той же транзакцией (аудит, ТЗ §8.7) */
export interface BudgetAudit {
  entityType: string;
  entityId?: string;
  action: string;
  after: Record<string, unknown>;
}

export interface MarketingBudgetRepository {
  /** Где мы: филиал выбора и валюты. Без выбранного филиала: 409 */
  scope(): Promise<BudgetScope>;
  /** Организация не только для чтения (пробный период, приостановка) */
  assertWritable(organizationId: string): Promise<void>;
  /** Месяц [first, nextFirst): план, строки расходов и учтённый расход прошлого месяца */
  monthData(
    locationId: string,
    first: string,
    nextFirst: string,
    prevFirst: string,
  ): Promise<{ plan: bigint | null; expenses: ExpenseRecord[]; prevSpent: bigint }>;
  createExpense(
    locationId: string,
    input: MarketingExpenseInput,
    audit: BudgetAudit,
  ): Promise<ExpenseRecord>;
  /** null: расхода нет у этого филиала */
  updateExpense(
    locationId: string,
    id: string,
    input: MarketingExpenseInput,
    audit: BudgetAudit,
  ): Promise<ExpenseRecord | null>;
  /** false: расхода нет у этого филиала */
  deleteExpense(locationId: string, id: string, audit: BudgetAudit): Promise<boolean>;
  setPlan(locationId: string, month: string, amount: bigint, audit: BudgetAudit): Promise<void>;
}
export const MARKETING_BUDGET_REPOSITORY = Symbol('MARKETING_BUDGET_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Tx = Parameters<Parameters<PrismaService['db']['$transaction']>[0]>[0];

async function writeAudit(tx: Tx, a: BudgetAudit, createdId?: string): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: auditUserId(),
      entityType: a.entityType,
      entityId: a.entityId ?? createdId ?? '',
      action: a.action,
      after: JSON.parse(JSON.stringify(createdId ? { ...a.after, id: createdId } : a.after)),
    },
  });
}

const toRecord = (r: {
  id: string;
  date: Date;
  platform: MarketingPlatform;
  campaign: string | null;
  category: string;
  description: string | null;
  amount: bigint;
  currency: string;
  fxRate: { toString(): string };
  baseAmount: bigint;
  countedInBudget: boolean;
  createdAt: Date;
}): ExpenseRecord => ({
  id: r.id,
  date: iso(r.date),
  platform: r.platform,
  campaign: r.campaign,
  category: r.category,
  description: r.description,
  amount: r.amount,
  currency: r.currency,
  fxRate: r.fxRate.toString(),
  baseAmount: r.baseAmount,
  countedInBudget: r.countedInBudget,
  createdAt: r.createdAt,
});

const expenseData = (input: MarketingExpenseInput) => ({
  date: asDate(input.date),
  platform: input.platform,
  campaign: input.campaign,
  category: input.category,
  description: input.description,
  amount: input.amount,
  currency: input.currency,
  fxRate: input.fxRate,
  baseAmount: input.baseAmount,
  countedInBudget: input.countedInBudget,
});

@Injectable()
export class PrismaMarketingBudgetRepository implements MarketingBudgetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async scope(): Promise<BudgetScope> {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId)
      throw new ForbiddenException('Войдите в организацию');
    const locationId = currentLocationId();
    if (!locationId) throw new ConflictException(CHOOSE_LOCATION);
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, status: 'ACTIVE', business: { organizationId } },
      select: { id: true, currency: true, timezone: true },
    });
    if (!location) throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { reportingCurrency: true },
    });
    return {
      organizationId,
      locationId: location.id,
      locationCurrency: location.currency,
      timezone: location.timezone,
      reportingCurrency: org?.reportingCurrency ?? 'KZT',
    };
  }

  async assertWritable(organizationId: string): Promise<void> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { status: true, trialEndsAt: true },
    });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }

  async monthData(
    locationId: string,
    first: string,
    nextFirst: string,
    prevFirst: string,
  ): Promise<{ plan: bigint | null; expenses: ExpenseRecord[]; prevSpent: bigint }> {
    const [plan, rows, prev] = await Promise.all([
      this.prisma.db.marketingBudget.findUnique({
        where: { locationId_month: { locationId, month: asDate(first) } },
        select: { amount: true },
      }),
      this.prisma.db.marketingExpense.findMany({
        where: { locationId, date: { gte: asDate(first), lt: asDate(nextFirst) } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.db.marketingExpense.aggregate({
        where: {
          locationId,
          countedInBudget: true,
          date: { gte: asDate(prevFirst), lt: asDate(first) },
        },
        _sum: { baseAmount: true },
      }),
    ]);
    return {
      plan: plan?.amount ?? null,
      expenses: rows.map(toRecord),
      prevSpent: prev._sum.baseAmount ?? 0n,
    };
  }

  async createExpense(
    locationId: string,
    input: MarketingExpenseInput,
    audit: BudgetAudit,
  ): Promise<ExpenseRecord> {
    return this.prisma.db.$transaction(async (tx) => {
      const row = await tx.marketingExpense.create({
        data: { locationId, ...expenseData(input), createdById: auditUserId() },
      });
      await writeAudit(tx, audit, row.id);
      return toRecord(row);
    });
  }

  async updateExpense(
    locationId: string,
    id: string,
    input: MarketingExpenseInput,
    audit: BudgetAudit,
  ): Promise<ExpenseRecord | null> {
    const found = await this.prisma.db.marketingExpense.findFirst({
      where: { id, locationId },
      select: { id: true },
    });
    if (!found) return null;
    return this.prisma.db.$transaction(async (tx) => {
      const row = await tx.marketingExpense.update({ where: { id }, data: expenseData(input) });
      await writeAudit(tx, audit);
      return toRecord(row);
    });
  }

  async deleteExpense(locationId: string, id: string, audit: BudgetAudit): Promise<boolean> {
    const found = await this.prisma.db.marketingExpense.findFirst({
      where: { id, locationId },
    });
    if (!found) return false;
    await this.prisma.db.$transaction(async (tx) => {
      await tx.marketingExpense.delete({ where: { id } });
      await writeAudit(tx, { ...audit, after: { ...audit.after, deleted: toRecordJson(found) } });
    });
    return true;
  }

  async setPlan(
    locationId: string,
    month: string,
    amount: bigint,
    audit: BudgetAudit,
  ): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      await tx.marketingBudget.upsert({
        where: { locationId_month: { locationId, month: asDate(month) } },
        create: { locationId, month: asDate(month), amount },
        update: { amount },
      });
      await writeAudit(tx, audit);
    });
  }
}

/** Снимок строки для журнала: BigInt строками, даты ISO */
function toRecordJson(r: Parameters<typeof toRecord>[0]): Record<string, unknown> {
  const rec = toRecord(r);
  return { ...rec, amount: rec.amount.toString(), baseAmount: rec.baseAmount.toString(), createdAt: rec.createdAt.toISOString() };
}
