import 'reflect-metadata';
import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  canWrite,
  type ChannelResult,
  type DayResult,
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
import type { ExpenseFileRow } from './expense-files';

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
  campaignId: string | null;
  createdAt: Date;
  /** Чеки и файлы (§51): только в чтении месяца */
  files?: ExpenseFileRow[];
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
  monthData(locationId: string, first: string, nextFirst: string, prevFirst: string): Promise<MonthData>;
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
  /** Импорт: все расходы одной транзакцией, у каждого своя запись журнала; возвращает число записанных */
  createExpenses(
    locationId: string,
    items: Array<{ input: MarketingExpenseInput; audit: BudgetAudit }>,
  ): Promise<number>;
  setPlan(locationId: string, month: string, amount: bigint, audit: BudgetAudit): Promise<void>;
  /** Разбивка плана месяца по каналам (§52) заменяется целиком одной транзакцией */
  setLines(locationId: string, month: string, lines: BudgetLineRecord[], audit: BudgetAudit): Promise<void>;
  /**
   * Результаты маркетинговых каналов филиала за месяц [first, nextFirst) по правилу Q-MKT-ATTR (МКТ-В5a).
   * `supported: false`: у филиала нет объекта размещения (салон, ресторан), броней гостиницы нет.
   */
  results(locationId: string, first: string, nextFirst: string): Promise<ResultsData>;
  /** Имя кампании этого филиала; null: кампании нет или она чужая */
  campaignName(locationId: string, id: string): Promise<string | null>;
}

export interface BudgetLineRecord {
  platform: MarketingPlatform;
  amount: bigint;
}

export interface MonthData {
  plan: bigint | null;
  expenses: ExpenseRecord[];
  prevSpent: bigint;
  /** Разбивка плана месяца по каналам (§52) */
  lines: BudgetLineRecord[];
  /** Разбивка прошлого месяца: «взять из прошлого месяца» на экране */
  prevLines: BudgetLineRecord[];
}

export interface ResultsData {
  supported: boolean;
  /** Валюта выручки: валюта объекта; null, когда объекта нет */
  revenueCurrency: string | null;
  channels: ChannelResult[];
  /** Дни месяца с активностью, по возрастанию; сумма по дням равна сумме по каналам */
  days: DayResult[];
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
  campaignId: string | null;
  createdAt: Date;
  files?: ExpenseFileRow[];
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
  campaignId: r.campaignId,
  ...(r.files ? { files: r.files } : {}),
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
  campaignId: input.campaignId,
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
  ): Promise<MonthData> {
    const linesOf = (month: string) =>
      this.prisma.db.marketingBudgetLine.findMany({
        where: { locationId, month: asDate(month) },
        select: { platform: true, amount: true },
        orderBy: [{ amount: 'desc' }, { platform: 'asc' }],
      });
    const [plan, rows, prev, lines, prevLines] = await Promise.all([
      this.prisma.db.marketingBudget.findUnique({
        where: { locationId_month: { locationId, month: asDate(first) } },
        select: { amount: true },
      }),
      this.prisma.db.marketingExpense.findMany({
        where: { locationId, date: { gte: asDate(first), lt: asDate(nextFirst) } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          files: {
            select: { id: true, fileName: true, mimeType: true, byteSize: true, storageRef: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.db.marketingExpense.aggregate({
        where: {
          locationId,
          countedInBudget: true,
          date: { gte: asDate(prevFirst), lt: asDate(first) },
        },
        _sum: { baseAmount: true },
      }),
      linesOf(first),
      linesOf(prevFirst),
    ]);
    return {
      plan: plan?.amount ?? null,
      expenses: rows.map(toRecord),
      prevSpent: prev._sum.baseAmount ?? 0n,
      lines,
      prevLines,
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

  async createExpenses(
    locationId: string,
    items: Array<{ input: MarketingExpenseInput; audit: BudgetAudit }>,
  ): Promise<number> {
    return this.prisma.db.$transaction(async (tx) => {
      for (const { input, audit } of items) {
        const row = await tx.marketingExpense.create({
          data: { locationId, ...expenseData(input), createdById: auditUserId() },
          select: { id: true },
        });
        await writeAudit(tx, audit, row.id);
      }
      return items.length;
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

  async setLines(locationId: string, month: string, lines: BudgetLineRecord[], audit: BudgetAudit): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      await tx.marketingBudgetLine.deleteMany({ where: { locationId, month: asDate(month) } });
      if (lines.length > 0)
        await tx.marketingBudgetLine.createMany({
          data: lines.map((l) => ({ locationId, month: asDate(month), platform: l.platform, amount: l.amount })),
        });
      await writeAudit(tx, audit);
    });
  }

  async campaignName(locationId: string, id: string): Promise<string | null> {
    const c = await this.prisma.db.marketingCampaign.findFirst({ where: { id, locationId }, select: { name: true } });
    return c?.name ?? null;
  }

  async results(locationId: string, first: string, nextFirst: string): Promise<ResultsData> {
    const property = await this.prisma.db.property.findUnique({
      where: { locationId },
      select: { id: true, timezone: true, currency: true },
    });
    if (!property) return { supported: false, revenueCurrency: null, channels: [], days: [] };
    const tz = property.timezone;
    // Брони маркетинговых каналов по дню, когда их сделали, в поясе объекта. Отмена и незаезд в брони и
    // выручку не входят; обращением считается и отменённая бронь, сделанная без ИИ-продавца (обращения
    // ИИ-продавца считаются по его диалогам ниже). Новый гость: живая бронь, у основного гостя которой раньше
    // не было ни одной брони у этого объекта из любого канала; бронь без гостя новым не считается.
    const bookingRows = await this.prisma.db.$queryRaw<
      Array<{
        day: string;
        source: string;
        bookings: bigint;
        revenue: bigint | string | null;
        direct: bigint;
        new_guests: bigint;
      }>
    >`
      SELECT (COALESCE(r.booked_at, r.created_at) AT TIME ZONE ${tz})::date::text AS day,
        r.source::text AS source,
        count(*) FILTER (WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')) AS bookings,
        COALESCE(sum(r.total_amount) FILTER (WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')), 0) AS revenue,
        count(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM seller_booking_intents i WHERE i.reservation_id = r.id)) AS direct,
        count(*) FILTER (WHERE r.status NOT IN ('CANCELLED', 'NO_SHOW')
          AND r.primary_guest_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM reservations p
            WHERE p.property_id = r.property_id
              AND p.primary_guest_id = r.primary_guest_id
              AND p.id <> r.id
              AND COALESCE(p.booked_at, p.created_at) < COALESCE(r.booked_at, r.created_at))) AS new_guests
      FROM reservations r
      WHERE r.property_id = ${property.id}::uuid
        AND r.source::text IN ('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'PHONE')
        AND (COALESCE(r.booked_at, r.created_at) AT TIME ZONE ${tz})::date >= ${first}::date
        AND (COALESCE(r.booked_at, r.created_at) AT TIME ZONE ${tz})::date < ${nextFirst}::date
      GROUP BY 1, 2`;
    // Диалог ИИ-продавца одно обращение в день своего первого предложения цены (по всем его предложениям у
    // объекта): тогда диалог, начатый в прошлом месяце, не попадает в этот второй раз, а сумма дней равна месяцу
    const dialogRows = await this.prisma.db.$queryRaw<
      Array<{ day: string; channel: string; dialogs: bigint }>
    >`
      SELECT (f.first_at AT TIME ZONE ${tz})::date::text AS day, f.channel, count(*) AS dialogs
      FROM (
        SELECT DISTINCT ON (i.agent_id, i.conversation_id) i.channel, i.created_at AS first_at
        FROM seller_booking_intents i
        WHERE i.property_id = ${property.id}::uuid
        ORDER BY i.agent_id, i.conversation_id, i.created_at
      ) f
      WHERE (f.first_at AT TIME ZONE ${tz})::date >= ${first}::date
        AND (f.first_at AT TIME ZONE ${tz})::date < ${nextFirst}::date
      GROUP BY 1, 2`;
    // Заявки с сайта филиала, кроме спама
    const leadRows = await this.prisma.db.$queryRaw<Array<{ day: string; leads: bigint }>>`
      SELECT (l.created_at AT TIME ZONE ${tz})::date::text AS day, count(*) AS leads
      FROM site_leads l
      WHERE l.location_id = ${locationId}::uuid
        AND l.status::text <> 'SPAM'
        AND (l.created_at AT TIME ZONE ${tz})::date >= ${first}::date
        AND (l.created_at AT TIME ZONE ${tz})::date < ${nextFirst}::date
      GROUP BY 1`;

    const SOURCE_CHANNEL: Record<string, ChannelResult['channel']> = {
      WEBSITE: 'SITE',
      WHATSAPP: 'WHATSAPP',
      INSTAGRAM: 'INSTAGRAM',
      PHONE: 'PHONE',
    };
    const DIALOG_CHANNEL: Record<string, ChannelResult['channel']> = { widget: 'SITE', whatsapp: 'WHATSAPP' };
    const channels = new Map<ChannelResult['channel'], ChannelResult>(
      (['SITE', 'WHATSAPP', 'INSTAGRAM', 'PHONE'] as const).map((c) => [
        c,
        { channel: c, leads: 0, bookings: 0, revenueMinor: 0n },
      ]),
    );
    const days = new Map<string, DayResult>();
    const dayOf = (date: string) => {
      let d = days.get(date);
      if (!d) {
        d = { date, leads: 0, bookings: 0, newGuests: 0, revenueMinor: 0n };
        days.set(date, d);
      }
      return d;
    };
    for (const r of bookingRows) {
      const c = channels.get(SOURCE_CHANNEL[r.source]!)!;
      const d = dayOf(r.day);
      const revenue = BigInt(r.revenue ?? 0);
      c.leads += Number(r.direct);
      c.bookings += Number(r.bookings);
      c.revenueMinor += revenue;
      d.leads += Number(r.direct);
      d.bookings += Number(r.bookings);
      d.newGuests += Number(r.new_guests);
      d.revenueMinor += revenue;
    }
    for (const r of dialogRows) {
      const channel = DIALOG_CHANNEL[r.channel];
      if (!channel) continue;
      channels.get(channel)!.leads += Number(r.dialogs);
      dayOf(r.day).leads += Number(r.dialogs);
    }
    for (const r of leadRows) {
      channels.get('SITE')!.leads += Number(r.leads);
      dayOf(r.day).leads += Number(r.leads);
    }
    return {
      supported: true,
      revenueCurrency: property.currency,
      channels: [...channels.values()],
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}

/** Снимок строки для журнала: BigInt строками, даты ISO */
function toRecordJson(r: Parameters<typeof toRecord>[0]): Record<string, unknown> {
  const rec = toRecord(r);
  return { ...rec, amount: rec.amount.toString(), baseAmount: rec.baseAmount.toString(), createdAt: rec.createdAt.toISOString() };
}
