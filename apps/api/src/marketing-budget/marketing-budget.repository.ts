import 'reflect-metadata';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  canWrite,
  type ChannelResult,
  type MarketingExpenseInput,
  type MarketingPlatform,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import {
  currentLocationId,
  currentOrganizationId,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * Учёт бюджета и расходов маркетинга (МКТ-В1/В2, DATA_MODEL §41, ADR-MKT-B1).
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
  /**
   * Результаты маркетинговых каналов филиала за месяц [first, nextFirst) по правилу Q-MKT-ATTR (МКТ-В5a).
   * `supported: false`: у филиала нет объекта размещения (салон, ресторан), броней гостиницы нет.
   */
  results(locationId: string, first: string, nextFirst: string): Promise<ResultsData>;
}

export interface ResultsData {
  supported: boolean;
  /** Валюта выручки: валюта объекта; null, когда объекта нет */
  revenueCurrency: string | null;
  channels: ChannelResult[];
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

  async results(locationId: string, first: string, nextFirst: string): Promise<ResultsData> {
    const property = await this.prisma.db.property.findUnique({
      where: { locationId },
      select: { id: true, timezone: true, currency: true },
    });
    if (!property) return { supported: false, revenueCurrency: null, channels: [] };
    const tz = property.timezone;
    // Брони маркетинговых каналов: месяц по дню, когда бронь сделали, в поясе объекта. Отмена и незаезд
    // в брони и выручку не входят; обращением считается и отменённая бронь, сделанная без ИИ-продавца
    // (обращения ИИ-продавца считаются по его диалогам ниже).
    const bookingRows = await this.prisma.db.$queryRaw<
      Array<{ source: string; bookings: bigint; revenue: bigint | string | null; direct: bigint }>
    >`
      SELECT r.source::text AS source,
        count(*) FILTER (WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')) AS bookings,
        COALESCE(sum(r.total_amount) FILTER (WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')), 0) AS revenue,
        count(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM seller_booking_intents i WHERE i.reservation_id = r.id)) AS direct
      FROM reservations r
      WHERE r.property_id = ${property.id}::uuid
        AND r.source::text IN ('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'PHONE')
        AND (COALESCE(r.booked_at, r.created_at) AT TIME ZONE ${tz})::date >= ${first}::date
        AND (COALESCE(r.booked_at, r.created_at) AT TIME ZONE ${tz})::date < ${nextFirst}::date
      GROUP BY r.source`;
    // Диалоги ИИ-продавца, дошедшие до предложения цены: один диалог одно обращение
    const dialogRows = await this.prisma.db.$queryRaw<Array<{ channel: string; dialogs: bigint }>>`
      SELECT i.channel, count(DISTINCT i.conversation_id) AS dialogs
      FROM seller_booking_intents i
      WHERE i.property_id = ${property.id}::uuid
        AND (i.created_at AT TIME ZONE ${tz})::date >= ${first}::date
        AND (i.created_at AT TIME ZONE ${tz})::date < ${nextFirst}::date
      GROUP BY i.channel`;
    // Заявки с сайта филиала, кроме спама
    const leadRows = await this.prisma.db.$queryRaw<Array<{ leads: bigint }>>`
      SELECT count(*) AS leads
      FROM site_leads l
      WHERE l.location_id = ${locationId}::uuid
        AND l.status::text <> 'SPAM'
        AND (l.created_at AT TIME ZONE ${tz})::date >= ${first}::date
        AND (l.created_at AT TIME ZONE ${tz})::date < ${nextFirst}::date`;

    const bySource = new Map(bookingRows.map((r) => [r.source, r]));
    const dialogs = new Map(dialogRows.map((r) => [r.channel, Number(r.dialogs)]));
    const siteLeads = Number(leadRows[0]?.leads ?? 0);
    const channel = (
      name: ChannelResult['channel'],
      source: string,
      extraLeads: number,
    ): ChannelResult => {
      const row = bySource.get(source);
      return {
        channel: name,
        leads: Number(row?.direct ?? 0) + extraLeads,
        bookings: Number(row?.bookings ?? 0),
        revenueMinor: BigInt(row?.revenue ?? 0),
      };
    };
    return {
      supported: true,
      revenueCurrency: property.currency,
      channels: [
        channel('SITE', 'WEBSITE', siteLeads + (dialogs.get('widget') ?? 0)),
        channel('WHATSAPP', 'WHATSAPP', dialogs.get('whatsapp') ?? 0),
        channel('INSTAGRAM', 'INSTAGRAM', 0),
        channel('PHONE', 'PHONE', 0),
      ],
    };
  }
}

/** Снимок строки для журнала: BigInt строками, даты ISO */
function toRecordJson(r: Parameters<typeof toRecord>[0]): Record<string, unknown> {
  const rec = toRecord(r);
  return { ...rec, amount: rec.amount.toString(), baseAmount: rec.baseAmount.toString(), createdAt: rec.createdAt.toISOString() };
}
