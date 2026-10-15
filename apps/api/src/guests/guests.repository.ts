import 'reflect-metadata';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pms/database';
import {
  GUEST_RECENT_DAYS,
  LUXX_APARTS_PROPERTY,
  countGuestNights,
  folioBalance,
  pickMainStay,
  shiftDate,
  summarizeGuestStays,
  type GuestMainStay,
  type GuestStayMoney,
  type GuestStaySummary,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { auditUserId } from '../accounts/actor';
import { actsForOrganization, currentOrganizationId } from '../auth/request-context';
import { FOREIGN_PROPERTY_MESSAGE, propertyToday } from '../database/property-ref';

export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  citizenship: string | null;
  staysCount: number;
  lastStay: string | null;
}
export interface GuestProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone: string | null;
  email: string | null;
  notes: string | null;
  documents: Array<{
    id: string;
    type: string;
    numberEncrypted: string;
    issueCountry: string | null;
    /// v1.7 (ADR-082): даты — шифртекстом, как номер; расшифровывает guests.service
    issuedAtEncrypted: string | null;
    expiresAtEncrypted: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    unitCode: string | null;
    /** Откуда бронь (G4, ТЗ §21): стойка, сайт, канал продаж — и название канала, если есть */
    source: string;
    channel: string | null;
    currency: string;
    /** Начислено, оплачено, возвращено и остаток по счёту проживания (ТЗ §24: из Folio);
     *  null — счёта у проживания нет */
    chargedMinor: string | null;
    paidMinor: string | null;
    refundedMinor: string | null;
    balanceMinor: string | null;
  }>;
}
/** Разделы справочника «Гости v2»: бейдж строки равен фильтру, суммы чипов сходятся с «Все» */
export type GuestDirectoryFilter = 'ALL' | 'INHOUSE' | 'EXPECTED' | 'RECENT' | 'NONE';
/** G7 (ТЗ §28): окно последнего визита — `days` дней назад по сегодня (0 — сегодня) или период */
export type GuestLastVisitWindow = { days: number } | { from: string; to: string };
/** G7 (ТЗ §28): число состоявшихся визитов */
export type GuestVisitsFilter = '1' | '2-5' | '6+';
/** G7 (ТЗ §30): порядок справочника; «Долг» — после Q-202 */
export type GuestDirectorySort = 'name' | 'next' | 'last' | 'visits';
/**
 * «Гости и бронирования» (план guests-bookings-2026-10-09): быстрые виды над таблицей. `inhouse` и `expected`
 * равны разделам INHOUSE и EXPECTED; `today`: заезд или выезд сегодня; `departures`: выезд сегодня;
 * `attention`: те же четыре факта, что «Требуют внимания» в «Бронях» (R2), но по проживаниям гостя.
 */
export type GuestDirectoryView = 'all' | 'today' | 'inhouse' | 'expected' | 'departures' | 'attention';
/** Окно дат основного проживания: `days` дней от сегодня включительно (1 значит сегодня) или период */
export type GuestStayPeriod = { days: number } | { from: string; to: string };
export interface GuestDirectoryRow extends GuestStaySummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  /** Основное проживание: заселён сейчас, иначе ближайшее будущее, иначе последнее; null, если подходящих нет */
  stay: GuestMainStay | null;
}
/** Плитки над таблицей: считаются без отборов (вся база гостей организации), заезды и выезды ещё и за вчера */
export interface GuestDirectoryKpi {
  /** всего гостей в базе организации: подпись к «Без активного проживания» */
  all: number;
  inhouse: number;
  arrivalsToday: number;
  departuresToday: number;
  expected: number;
  attention: number;
  none: number;
  arrivalsYesterday: number;
  departuresYesterday: number;
}
export interface GuestDirectoryResult {
  total: number;
  page: number;
  pageSize: number;
  counts: Record<GuestDirectoryFilter, number>;
  /** Числа быстрых видов при текущих поиске, отборах и разделе */
  views: Record<GuestDirectoryView, number>;
  kpi: GuestDirectoryKpi;
  rows: GuestDirectoryRow[];
}
/** Предпросмотр гостя панелью (G3, ТЗ §17): контакты, «сейчас», история и долг из Folio */
export interface GuestPreview extends GuestStaySummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  /** Заметки гостя (поле карточки); при ADR-072 пока база не в РК новых не принимается, прежние читаются */
  notes: string | null;
  /** Основное проживание: к нему относятся «Бронь», «Оплата» и «Услуги» панели */
  stay: GuestMainStay | null;
  /** Состоявшиеся визиты (заселён или выехал), новые первыми, не больше десяти */
  visits: Array<{
    confirmationNumber: string;
    arrivalDate: string;
    departureDate: string;
    nights: number;
    unitCode: string | null;
    accommodationTypeName: string;
    status: string;
  }>;
  /** Услуги в счёте основного проживания: начисления вида SERVICE без сторно, по дате */
  services: Array<{
    id: string;
    description: string;
    quantity: number;
    amountMinor: string;
    serviceDate: string | null;
  }>;
  /** Ночей по визитам — вся длительность, как в счёте */
  nightsTotal: number;
  /** Есть ли у проживаний гостя счета: без них долг — «—», а не 0 */
  hasFolios: boolean;
  /** Сумма остатков по счетам его проживаний; источник правды — Folio (ТЗ §24) */
  debtMinor: string;
  currency: string;
}
export interface GuestPatch {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  birthDate?: string | null;
  citizenship?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
export interface GuestDirectoryQuery {
  state: GuestDirectoryFilter;
  q: string;
  page: number;
  pageSize: number;
  lastVisit?: GuestLastVisitWindow | null;
  visits?: GuestVisitsFilter | null;
  sort?: GuestDirectorySort;
  /** Быстрый вид («Гости и бронирования»); не задан: `all` */
  view?: GuestDirectoryView;
  /** Источник основного проживания: значение ReservationSource без регистра... */
  source?: string | null;
  /** ...или подстрока названия канала продаж (booking → Booking.com) */
  channel?: string | null;
  /** Только с долгом: по заселённому или выехавшему проживанию остаток по счёту больше нуля */
  debt?: boolean;
  /** Только новые: визитов не больше одного */
  fresh?: boolean;
  /** Только без контакта: нет ни телефона, ни почты */
  noContact?: boolean;
  /** Даты основного проживания пересекают окно */
  stayPeriod?: GuestStayPeriod | null;
}
export interface GuestsRepository {
  search(q: string, limit: number): Promise<GuestSummary[]>;
  /** Гости организации с датой рождения: «Дни рождения» (Q-249 T0), окно считает домен */
  withBirthDates(): Promise<Array<{ id: string; firstName: string; lastName: string; birthDate: string }>>;
  /** Справочник «Гости v2»: одна строка — один гость, состояние вычисляется из его проживаний */
  directory(query: GuestDirectoryQuery): Promise<GuestDirectoryResult>;
  byId(id: string): Promise<GuestProfile | null>;
  /** Предпросмотр панелью (G3): null — гость не найден или не этой организации */
  preview(id: string): Promise<GuestPreview | null>;
  update(id: string, patch: GuestPatch): Promise<void>;
  addDocument(
    guestId: string,
    d: {
      type: string;
      numberEncrypted: string;
      issueCountry: string | null;
      issuedAtEncrypted: string | null;
      expiresAtEncrypted: string | null;
    },
  ): Promise<string>;
  /** Удалённый документ (его тип — для журнала) или null, если такого нет */
  deleteDocument(guestId: string, documentId: string): Promise<{ type: string } | null>;
  /** Без ПД: только имена изменённых полей */
  /** Журнал: имена полей без значений; `details` — идентификаторы (какой документ), не данные гостя */
  audit(
    guestId: string,
    action: string,
    fields: string[],
    details?: Record<string, unknown>,
  ): Promise<void>;
}
export const GUESTS_REPOSITORY = Symbol('GUESTS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

/** Основное проживание строки справочника: подробности и счёт одним запросом по id (см. `directory`) */
const mainStaySelect = {
  id: true,
  status: true,
  arrivalDate: true,
  departureDate: true,
  adults: true,
  children: true,
  accommodationType: { select: { name: true } },
  reservation: { select: { confirmationNumber: true, source: true, channel: true, currency: true } },
  allocations: {
    orderBy: { startDate: 'desc' },
    take: 1,
    select: { inventoryUnit: { select: { code: true } } },
  },
  folio: {
    select: {
      charges: { where: { voidedAt: null }, select: { amount: true } },
      allocations: { where: { payment: { status: 'COMPLETED' } }, select: { amount: true } },
      refunds: { select: { amount: true } },
    },
  },
} satisfies Prisma.ReservationItemSelect;
type MainStayItem = Prisma.ReservationItemGetPayload<{ select: typeof mainStaySelect }>;

/** Счёт проживания в минорных единицах строками; у проживания без счёта `null` (ТЗ §24: источник правды Folio) */
function stayMoney(folio: MainStayItem['folio']): GuestStayMoney | null {
  if (!folio) return null;
  const b = folioBalance({
    charges: folio.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
    allocations: folio.allocations.map((a) => ({ amountMinor: a.amount })),
    refunds: folio.refunds.map((r) => ({ amountMinor: r.amount })),
  });
  return {
    chargedMinor: b.chargedMinor.toString(),
    paidMinor: b.paidMinor.toString(),
    refundedMinor: b.refundedMinor.toString(),
    balanceMinor: b.balanceMinor.toString(),
  };
}

function mainStayOf(item: MainStayItem, today: string): GuestMainStay | null {
  return pickMainStay(
    [
      {
        status: item.status,
        arrivalDate: iso(item.arrivalDate)!,
        departureDate: iso(item.departureDate)!,
        unitCode: item.allocations[0]?.inventoryUnit.code ?? null,
        accommodationTypeName: item.accommodationType.name,
        confirmationNumber: item.reservation.confirmationNumber,
        adults: item.adults,
        children: item.children,
        source: item.reservation.source,
        channel: item.reservation.channel,
        currency: item.reservation.currency,
        money: stayMoney(item.folio),
      },
    ],
    today,
  );
}

@Injectable()
export class PrismaGuestsRepository implements GuestsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  /**
   * Замок организаций (ADR-061, Q-152 → v1.13 §17.1, ADR-103; поручение владельца 27.09).
   * `guests.organization_id` NOT NULL — канонический и ЕДИНСТВЕННЫЙ признак принадлежности:
   * гостя без колонки не существует (backfill миграции `20260927000027` + NOT NULL, все пути
   * создания — стойка, канал и сайт — штампуют организацию). Прежняя цепочка через
   * брони объекта снята: условие шире колонки расходилось бы с RLS — база под ролью `wetop_app`
   * режет ровно по колонке, и гость, проштампованный чужой организацией, не должен открываться
   * из-за связи через бронь. Служебный ходок (сторож, скрипты, импорт) — без фильтра, как раньше.
   */
  private visible(): Prisma.GuestWhereInput {
    if (!actsForOrganization()) return {};
    const organizationId = currentOrganizationId();
    // вошедший без организации не видит ни одного гостя — как и объект в property-ref
    if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
    return { organizationId };
  }
  async withBirthDates() {
    // ponytail: все гости с датой рождения в память, окно — в домене; при десятках тысяч гостей —
    // перенести отбор по месяцу и дню в SQL (to_char(birth_date, 'MM-DD'))
    const rows = await this.prisma.db.guest.findMany({
      where: { AND: [this.visible(), { birthDate: { not: null } }] },
      select: { id: true, firstName: true, lastName: true, birthDate: true },
    });
    return rows.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      birthDate: iso(g.birthDate)!,
    }));
  }
  async search(q: string, limit: number): Promise<GuestSummary[]> {
    const digits = q.replace(/\D/g, '');
    const rows = await this.prisma.db.guest.findMany({
      where: {
        AND: [
          this.visible(),
          {
            OR: [
              { lastName: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            ],
          },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit,
      include: { stays: { include: { reservationItem: { select: { arrivalDate: true } } } } },
    });
    return rows.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      phone: g.phone,
      email: g.email,
      citizenship: g.citizenship,
      staysCount: g.stays.length,
      lastStay:
        g.stays
          .map((s) => iso(s.reservationItem.arrivalDate)!)
          .sort()
          .at(-1) ?? null,
    }));
  }
  /**
   * Справочник «Гости v2» (ТЗ 27.09.2026, план plans/guests-v2-2026-09-27.md). SQL-условия разделов
   * повторяют определения summarizeGuestStays: живёт — есть CHECKED_IN; ожидается — не живёт и есть
   * CONFIRMED/TENTATIVE с выездом не раньше сегодня; недавние — не первые два и выехал за 30 дней.
   * Числа чипов считаются тем же отбором без раздела — видно до нажатия, как на «Бронях».
   */
  async directory(query: GuestDirectoryQuery): Promise<GuestDirectoryResult> {
    // замок организаций до любого запроса: вошедший без организации не видит никого (как `visible()`)
    const scope = this.visible();
    const organizationId = 'organizationId' in scope ? (scope.organizationId as string) : null;
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const recentFrom = shiftDate(today, -GUEST_RECENT_DAYS);
    const yesterday = shiftDate(today, -1);
    const like = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;
    const q = query.q;
    const digits = q.replace(/\D/g, '');
    const view: GuestDirectoryView = query.view ?? 'all';
    const orgWhere = organizationId
      ? Prisma.sql`g."organization_id" = ${organizationId}::uuid`
      : Prisma.sql`TRUE`;
    // Факты гостя — те же, что считает `summarizeGuestStays` для колонок таблицы (G2): визит —
    // заселён или выехал; «последний визит» — самый поздний выезд; «ближайший» — подтверждённая или
    // неподтверждённая бронь, чей выезд не прошёл. SQL нужен G7: отбор и порядок по этим фактам
    // Prisma не выражает. Схема не названа — `search_path` и RLS действуют, как у «Броней» (R2).
    const guestWhere: Prisma.Sql[] = [orgWhere];
    if (q)
      guestWhere.push(Prisma.sql`(
        g."last_name" ILIKE ${like(q)}
        OR g."first_name" ILIKE ${like(q)}
        OR g."email" ILIKE ${like(q)}
        ${digits.length >= 4 ? Prisma.sql`OR g."phone" LIKE ${like(digits)}` : Prisma.empty}
        OR EXISTS (
          SELECT 1 FROM "stay_guests" qs
          JOIN "reservation_items" qi ON qi."id" = qs."reservation_item_id"
          JOIN "reservations" qr ON qr."id" = qi."reservation_id"
          WHERE qs."guest_id" = g."id" AND qr."confirmation_number" ILIKE ${like(q)}))`);
    const facts = this.directoryFacts(guestWhere, today, recentFrom);
    const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
    const w = query.lastVisit;
    if (w && 'days' in w)
      filters.push(
        Prisma.sql`s."last_departure" BETWEEN ${shiftDate(today, -w.days)}::date AND ${today}::date`,
      );
    else if (w)
      filters.push(Prisma.sql`s."last_departure" BETWEEN ${w.from}::date AND ${w.to}::date`);
    if (query.visits === '1') filters.push(Prisma.sql`s."visits" = 1`);
    else if (query.visits === '2-5') filters.push(Prisma.sql`s."visits" BETWEEN 2 AND 5`);
    else if (query.visits === '6+') filters.push(Prisma.sql`s."visits" >= 6`);
    // отборы «Гостей и бронирований»: про основное проживание, ту же бронь, что видна в строке
    if (query.source) filters.push(Prisma.sql`s."ms_source" = ${query.source.toUpperCase()}`);
    if (query.channel) filters.push(Prisma.sql`s."ms_channel" ILIKE ${like(query.channel)}`);
    if (query.debt) filters.push(Prisma.sql`s."debt"`);
    if (query.fresh) filters.push(Prisma.sql`s."visits" <= 1`);
    if (query.noContact) filters.push(Prisma.sql`s."no_contact"`);
    const period = query.stayPeriod;
    if (period) {
      const from = 'days' in period ? today : period.from;
      const to = 'days' in period ? shiftDate(today, period.days - 1) : period.to;
      filters.push(Prisma.sql`s."ms_arrival" <= ${to}::date AND s."ms_departure" >= ${from}::date`);
    }
    const filtered = Prisma.join(filters, ' AND ');
    const byName = Prisma.sql`s."last_name" ASC, s."first_name" ASC, s."id" ASC`;
    const orderBy =
      query.sort === 'next'
        ? Prisma.sql`s."next_arrival" ASC NULLS LAST, ${byName}`
        : query.sort === 'last'
          ? Prisma.sql`s."last_departure" DESC NULLS LAST, ${byName}`
          : query.sort === 'visits'
            ? Prisma.sql`s."visits" DESC, ${byName}`
            : byName;
    const inState =
      query.state === 'ALL' ? Prisma.sql`TRUE` : Prisma.sql`s."state" = ${query.state}`;
    const inView =
      view === 'today'
        ? Prisma.sql`(s."arrives_today" OR s."departs_today")`
        : view === 'inhouse'
          ? Prisma.sql`s."state" = 'INHOUSE'`
          : view === 'expected'
            ? Prisma.sql`s."state" = 'EXPECTED'`
            : view === 'departures'
              ? Prisma.sql`s."departs_today"`
              : view === 'attention'
                ? Prisma.sql`s."attention"`
                : Prisma.sql`TRUE`;
    // плитки не зависят от поиска и отборов: вся база гостей организации
    const kpiFacts = this.directoryFacts([orgWhere], today, recentFrom);
    // числа чипов — тем же отбором без раздела: видно до нажатия, сколько найдётся (как на «Бронях»)
    const [countRows, viewRows, kpiRows, yesterdayRows, page] = await Promise.all([
      this.prisma.db.$queryRaw<Array<Record<GuestDirectoryFilter, number>>>(Prisma.sql`${facts}
        SELECT COUNT(*)::int AS "ALL",
          COUNT(*) FILTER (WHERE s."state" = 'INHOUSE')::int AS "INHOUSE",
          COUNT(*) FILTER (WHERE s."state" = 'EXPECTED')::int AS "EXPECTED",
          COUNT(*) FILTER (WHERE s."state" = 'RECENT')::int AS "RECENT",
          COUNT(*) FILTER (WHERE s."state" = 'NONE')::int AS "NONE"
        FROM s WHERE ${filtered}`),
      this.prisma.db.$queryRaw<Array<Record<GuestDirectoryView, number>>>(Prisma.sql`${facts}
        SELECT COUNT(*)::int AS "all",
          COUNT(*) FILTER (WHERE s."arrives_today" OR s."departs_today")::int AS "today",
          COUNT(*) FILTER (WHERE s."state" = 'INHOUSE')::int AS "inhouse",
          COUNT(*) FILTER (WHERE s."state" = 'EXPECTED')::int AS "expected",
          COUNT(*) FILTER (WHERE s."departs_today")::int AS "departures",
          COUNT(*) FILTER (WHERE s."attention")::int AS "attention"
        FROM s WHERE ${filtered} AND ${inState}`),
      this.prisma.db.$queryRaw<
        Array<{
          all: number;
          inhouse: number;
          arrivals_today: number;
          departures_today: number;
          expected: number;
          attention: number;
          none: number;
        }>
      >(Prisma.sql`${kpiFacts}
        SELECT COUNT(*)::int AS "all",
          COUNT(*) FILTER (WHERE s."state" = 'INHOUSE')::int AS "inhouse",
          COUNT(*) FILTER (WHERE s."arrives_today")::int AS "arrivals_today",
          COUNT(*) FILTER (WHERE s."departs_today")::int AS "departures_today",
          COUNT(*) FILTER (WHERE s."state" = 'EXPECTED')::int AS "expected",
          COUNT(*) FILTER (WHERE s."attention")::int AS "attention",
          COUNT(*) FILTER (WHERE s."state" = 'NONE')::int AS "none"
        FROM s`),
      // вчера считается по датам брони: приехали (заселены или уже выехали) и выехали
      this.prisma.db.$queryRaw<Array<{ arrivals: number; departures: number }>>(Prisma.sql`
        SELECT COUNT(DISTINCT sg."guest_id") FILTER (WHERE ri."arrival_date" = ${yesterday}::date
            AND ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT'))::int AS "arrivals",
          COUNT(DISTINCT sg."guest_id") FILTER (WHERE ri."departure_date" = ${yesterday}::date
            AND ri."status"::text = 'CHECKED_OUT')::int AS "departures"
        FROM "guests" g
        JOIN "stay_guests" sg ON sg."guest_id" = g."id"
        JOIN "reservation_items" ri ON ri."id" = sg."reservation_item_id"
        WHERE ${orgWhere}`),
      this.prisma.db.$queryRaw<Array<{ id: string; ms_id: string | null }>>(Prisma.sql`${facts}
        SELECT s."id"::text AS "id", s."ms_id"::text AS "ms_id" FROM s
        WHERE ${filtered} AND ${inState} AND ${inView}
        ORDER BY ${orderBy}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`),
    ]);
    const counts = countRows[0] ?? { ALL: 0, INHOUSE: 0, EXPECTED: 0, RECENT: 0, NONE: 0 };
    const views = viewRows[0] ?? {
      all: 0,
      today: 0,
      inhouse: 0,
      expected: 0,
      departures: 0,
      attention: 0,
    };
    const k = kpiRows[0];
    const y = yesterdayRows[0];
    const kpi: GuestDirectoryKpi = {
      all: k?.all ?? 0,
      inhouse: k?.inhouse ?? 0,
      arrivalsToday: k?.arrivals_today ?? 0,
      departuresToday: k?.departures_today ?? 0,
      expected: k?.expected ?? 0,
      attention: k?.attention ?? 0,
      none: k?.none ?? 0,
      arrivalsYesterday: y?.arrivals ?? 0,
      departuresYesterday: y?.departures ?? 0,
    };
    const ids = page.map((p) => p.id);
    const found = ids.length
      ? await this.prisma.db.guest.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true,
            // одним запросом на страницу, без рейса на каждого гостя (ТЗ §45)
            stays: {
              select: {
                reservationItem: {
                  select: {
                    status: true,
                    arrivalDate: true,
                    departureDate: true,
                    accommodationType: { select: { name: true } },
                    allocations: {
                      orderBy: { startDate: 'desc' },
                      take: 1,
                      select: { inventoryUnit: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
    // основное проживание выбрал SQL (тот же приоритет, что у summarizeGuestStays); подробности и счёт берём одной
    // выборкой по их id, чтобы не тащить счета всех проживаний каждого гостя страницы
    const mainIds = page.flatMap((p) => (p.ms_id ? [p.ms_id] : []));
    const mainItems = mainIds.length
      ? await this.prisma.db.reservationItem.findMany({
          where: { id: { in: mainIds } },
          select: mainStaySelect,
        })
      : [];
    const mainById = new Map(mainItems.map((i) => [i.id, i]));
    const mainOfGuest = new Map(
      page.flatMap((p) => {
        const item = p.ms_id ? mainById.get(p.ms_id) : undefined;
        return item ? [[p.id, mainStayOf(item, today)] as const] : [];
      }),
    );
    // порядок страницы — порядок SQL; строки дочитываются одной выборкой, без рейса на гостя (ТЗ §45)
    const byId = new Map(found.map((g) => [g.id, g]));
    const rows = ids.flatMap((id) => byId.get(id) ?? []);
    return {
      total: views[view],
      page: query.page,
      pageSize: query.pageSize,
      counts,
      views,
      kpi,
      rows: rows.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        middleName: g.middleName,
        phone: g.phone,
        email: g.email,
        stay: mainOfGuest.get(g.id) ?? null,
        ...summarizeGuestStays(
          g.stays.map((s) => ({
            status: s.reservationItem.status,
            arrivalDate: iso(s.reservationItem.arrivalDate)!,
            departureDate: iso(s.reservationItem.departureDate)!,
            unitCode: s.reservationItem.allocations[0]?.inventoryUnit.code ?? null,
            accommodationTypeName: s.reservationItem.accommodationType.name,
          })),
          today,
        ),
      })),
    };
  }
  /**
   * Факты гостей для справочника одним CTE (`f`: по гостю, `s`: плюс состояние и основное проживание `ms_*`).
   * Деньги проживания считаются формулой `folioBalance` (начислено без сторно − оплачено платежами COMPLETED + возвращено),
   * как в «Бронях». «Требуют внимания» это четыре факта R2 по проживаниям гостя: без ячейки, заезд просрочен,
   * долг при заселённом или выехавшем, деньги ждут возврата. Один CTE на справочник, плитки и числа чипов:
   * определения не расходятся между ними.
   */
  private directoryFacts(guestWhere: Prisma.Sql[], today: string, recentFrom: string): Prisma.Sql {
    const balance = Prisma.sql`(m."charged" - m."paid" + m."refunded")`;
    return Prisma.sql`
      WITH f AS (
        SELECT g."id", g."last_name", g."first_name",
          (COALESCE(g."phone", '') = '' AND COALESCE(g."email", '') = '') AS "no_contact",
          COUNT(ri."id") FILTER (WHERE ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT'))::int AS "visits",
          COALESCE(BOOL_OR(ri."status"::text = 'CHECKED_IN'), false) AS "inhouse",
          COALESCE(BOOL_OR(ri."status"::text IN ('CONFIRMED', 'TENTATIVE')
            AND ri."departure_date" >= ${today}::date), false) AS "expected",
          MAX(ri."departure_date") FILTER (WHERE ri."status"::text = 'CHECKED_OUT') AS "last_departure",
          MIN(ri."arrival_date") FILTER (WHERE ri."status"::text IN ('CONFIRMED', 'TENTATIVE')
            AND ri."departure_date" >= ${today}::date) AS "next_arrival",
          COALESCE(BOOL_OR(ri."arrival_date" = ${today}::date
            AND ri."status"::text IN ('CONFIRMED', 'TENTATIVE', 'CHECKED_IN', 'CHECKED_OUT')), false) AS "arrives_today",
          COALESCE(BOOL_OR(ri."departure_date" = ${today}::date
            AND ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT')), false) AS "departs_today",
          COALESCE(BOOL_OR(
            (ri."status"::text IN ('TENTATIVE', 'CONFIRMED', 'CHECKED_IN')
              AND NOT EXISTS (SELECT 1 FROM "allocations" a WHERE a."reservation_item_id" = ri."id"))
            OR (ri."status"::text IN ('TENTATIVE', 'CONFIRMED') AND ri."arrival_date" < ${today}::date)
            OR (ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT') AND ${balance} > 0)
            OR ${balance} < 0), false) AS "attention",
          COALESCE(BOOL_OR(ri."status"::text IN ('CHECKED_IN', 'CHECKED_OUT') AND ${balance} > 0), false) AS "debt"
        FROM "guests" g
        LEFT JOIN "stay_guests" sg ON sg."guest_id" = g."id"
        LEFT JOIN "reservation_items" ri ON ri."id" = sg."reservation_item_id"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE((SELECT SUM(c."amount") FROM "charges" c
              JOIN "folios" cf ON cf."id" = c."folio_id"
              WHERE cf."reservation_item_id" = ri."id" AND c."voided_at" IS NULL), 0) AS "charged",
            COALESCE((SELECT SUM(pa."amount") FROM "payment_allocations" pa
              JOIN "payments" p ON p."id" = pa."payment_id"
              JOIN "folios" pf ON pf."id" = pa."folio_id"
              WHERE pf."reservation_item_id" = ri."id" AND p."status"::text = 'COMPLETED'), 0) AS "paid",
            COALESCE((SELECT SUM(rf."amount") FROM "refunds" rf
              JOIN "folios" rff ON rff."id" = rf."folio_id"
              WHERE rff."reservation_item_id" = ri."id"), 0) AS "refunded"
        ) m ON TRUE
        WHERE ${Prisma.join(guestWhere, ' AND ')}
        GROUP BY g."id"
      ), s AS (
        SELECT f.*, CASE
          WHEN f."inhouse" THEN 'INHOUSE'
          WHEN f."expected" THEN 'EXPECTED'
          WHEN f."last_departure" >= ${recentFrom}::date THEN 'RECENT'
          ELSE 'NONE' END AS "state",
          ms."id" AS "ms_id", ms."arrival_date" AS "ms_arrival", ms."departure_date" AS "ms_departure",
          ms."source" AS "ms_source", ms."channel" AS "ms_channel"
        FROM f
        LEFT JOIN LATERAL (
          SELECT i."id", i."arrival_date", i."departure_date", r."source"::text AS "source", r."channel"
          FROM "stay_guests" x
          JOIN "reservation_items" i ON i."id" = x."reservation_item_id"
          JOIN "reservations" r ON r."id" = i."reservation_id"
          WHERE x."guest_id" = f."id"
            AND (i."status"::text IN ('CHECKED_IN', 'CHECKED_OUT')
              OR (i."status"::text IN ('CONFIRMED', 'TENTATIVE') AND i."departure_date" >= ${today}::date))
          ORDER BY CASE WHEN i."status"::text = 'CHECKED_IN' THEN 0
              WHEN i."status"::text = 'CHECKED_OUT' THEN 2 ELSE 1 END,
            CASE WHEN i."status"::text = 'CHECKED_IN' THEN i."arrival_date" END DESC NULLS LAST,
            CASE WHEN i."status"::text IN ('CONFIRMED', 'TENTATIVE') THEN i."arrival_date" END ASC NULLS LAST,
            CASE WHEN i."status"::text = 'CHECKED_OUT' THEN i."departure_date" END DESC NULLS LAST,
            i."id" ASC
          LIMIT 1
        ) ms ON TRUE
      )`;
  }
  /**
   * Предпросмотр гостя панелью (G3, ТЗ §17; «долг — сначала в предпросмотре» — решение владельца
   * 27.09). Долг считается из счетов его проживаний тем же `folioBalance`, что список броней и
   * карточка (ТЗ §24: источник правды — Folio, отдельных «денег гостя» нет). Документы сюда
   * намеренно не входят: их показ — событие журнала, предпросмотру они не нужны.
   */
  async preview(id: string): Promise<GuestPreview | null> {
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const g = await this.prisma.db.guest.findFirst({
      where: { AND: [{ id }, this.visible()] },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        email: true,
        notes: true,
        stays: {
          select: {
            reservationItem: {
              select: {
                status: true,
                arrivalDate: true,
                departureDate: true,
                adults: true,
                children: true,
                accommodationType: { select: { name: true } },
                reservation: {
                  select: { confirmationNumber: true, currency: true, source: true, channel: true },
                },
                allocations: {
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  select: { inventoryUnit: { select: { code: true } } },
                },
                folio: {
                  select: {
                    charges: {
                      where: { voidedAt: null },
                      select: {
                        id: true,
                        kind: true,
                        description: true,
                        quantity: true,
                        amount: true,
                        serviceDate: true,
                      },
                    },
                    allocations: {
                      where: { payment: { status: 'COMPLETED' } },
                      select: { amount: true },
                    },
                    refunds: { select: { amount: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!g) return null;
    const stays = g.stays.map((s) => ({
      status: s.reservationItem.status,
      arrivalDate: iso(s.reservationItem.arrivalDate)!,
      departureDate: iso(s.reservationItem.departureDate)!,
      unitCode: s.reservationItem.allocations[0]?.inventoryUnit.code ?? null,
      accommodationTypeName: s.reservationItem.accommodationType.name,
      confirmationNumber: s.reservationItem.reservation.confirmationNumber,
      adults: s.reservationItem.adults,
      children: s.reservationItem.children,
      source: s.reservationItem.reservation.source,
      channel: s.reservationItem.reservation.channel,
      currency: s.reservationItem.reservation.currency,
      money: stayMoney(s.reservationItem.folio),
    }));
    const folios = g.stays.flatMap((s) =>
      s.reservationItem.folio ? [s.reservationItem.folio] : [],
    );
    const balance = folioBalance({
      charges: folios.flatMap((f) =>
        f.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
      ),
      allocations: folios.flatMap((f) => f.allocations.map((a) => ({ amountMinor: a.amount }))),
      refunds: folios.flatMap((f) => f.refunds.map((r) => ({ amountMinor: r.amount }))),
    });
    const stay = pickMainStay(stays, today);
    // услуги основного проживания: его счёт, начисления вида SERVICE без сторно, по дате (потом по порядку записи)
    const mainFolio = stay
      ? g.stays.find(
          (s) =>
            s.reservationItem.reservation.confirmationNumber === stay.confirmationNumber &&
            iso(s.reservationItem.arrivalDate) === stay.arrivalDate &&
            iso(s.reservationItem.departureDate) === stay.departureDate &&
            s.reservationItem.status === stay.status,
        )?.reservationItem.folio
      : null;
    const services = (mainFolio?.charges ?? [])
      .filter((c) => c.kind === 'SERVICE')
      .map((c) => ({
        id: c.id,
        description: c.description,
        quantity: c.quantity,
        amountMinor: c.amount.toString(),
        serviceDate: iso(c.serviceDate),
      }))
      .sort((a, b) => (a.serviceDate ?? '').localeCompare(b.serviceDate ?? ''));
    const visits = stays
      .filter((s) => s.status === 'CHECKED_IN' || s.status === 'CHECKED_OUT')
      .sort((a, b) => (a.arrivalDate < b.arrivalDate ? 1 : -1))
      .slice(0, 10)
      .map((s) => ({
        confirmationNumber: s.confirmationNumber,
        arrivalDate: s.arrivalDate,
        departureDate: s.departureDate,
        nights: Math.max(
          0,
          Math.round((Date.parse(s.departureDate) - Date.parse(s.arrivalDate)) / 86400000),
        ),
        unitCode: s.unitCode,
        accommodationTypeName: s.accommodationTypeName,
        status: s.status,
      }));
    return {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      phone: g.phone,
      email: g.email,
      notes: g.notes,
      stay,
      visits,
      services,
      ...summarizeGuestStays(stays, today),
      nightsTotal: countGuestNights(stays),
      hasFolios: folios.length > 0,
      debtMinor: balance.balanceMinor.toString(),
      currency: g.stays[0]?.reservationItem.reservation.currency ?? 'KZT',
    };
  }
  async byId(id: string): Promise<GuestProfile | null> {
    const g = await this.prisma.db.guest.findFirst({
      where: { AND: [{ id }, this.visible()] },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        stays: {
          include: {
            reservationItem: {
              include: {
                reservation: {
                  select: { confirmationNumber: true, source: true, channel: true, currency: true },
                },
                accommodationType: { select: { name: true } },
                allocations: {
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  include: { inventoryUnit: { select: { code: true } } },
                },
                // счёт проживания — тем же отбором, что список броней и предпросмотр (folioBalance)
                folio: {
                  select: {
                    charges: { where: { voidedAt: null }, select: { amount: true } },
                    allocations: {
                      where: { payment: { status: 'COMPLETED' } },
                      select: { amount: true },
                    },
                    refunds: { select: { amount: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!g) return null;
    return {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      birthDate: iso(g.birthDate),
      citizenship: g.citizenship,
      gender: g.gender,
      phone: g.phone,
      email: g.email,
      notes: g.notes,
      documents: g.documents.map((d) => ({
        id: d.id,
        type: d.type,
        numberEncrypted: d.numberEncrypted,
        issueCountry: d.issueCountry,
        issuedAtEncrypted: d.issuedAtEncrypted,
        expiresAtEncrypted: d.expiresAtEncrypted,
      })),
      stays: g.stays
        .map((s) => {
          const { reservation, folio } = s.reservationItem;
          const balance = folio
            ? folioBalance({
                charges: folio.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
                allocations: folio.allocations.map((a) => ({ amountMinor: a.amount })),
                refunds: folio.refunds.map((r) => ({ amountMinor: r.amount })),
              })
            : null;
          return {
            confirmationNumber: reservation.confirmationNumber,
            accommodationTypeName: s.reservationItem.accommodationType.name,
            arrivalDate: iso(s.reservationItem.arrivalDate)!,
            departureDate: iso(s.reservationItem.departureDate)!,
            status: s.reservationItem.status,
            unitCode: s.reservationItem.allocations[0]?.inventoryUnit.code ?? null,
            source: reservation.source,
            channel: reservation.channel,
            currency: reservation.currency,
            chargedMinor: balance ? balance.chargedMinor.toString() : null,
            paidMinor: balance ? balance.paidMinor.toString() : null,
            refundedMinor: balance ? balance.refundedMinor.toString() : null,
            balanceMinor: balance ? balance.balanceMinor.toString() : null,
          };
        })
        .sort((a, b) => (a.arrivalDate < b.arrivalDate ? 1 : -1)),
    };
  }
  async update(id: string, p: GuestPatch): Promise<void> {
    // Phase 1 изоляции (ADR-100 §17.2): правка по прямому id — только гостя своей организации.
    // Сервис уже проверяет byId, это второй замок на уровне репозитория: чужой id — «не найден».
    const updated = await this.prisma.db.guest.updateMany({
      where: { AND: [{ id }, await this.visible()] },
      data: {
        ...(p.firstName !== undefined ? { firstName: p.firstName } : {}),
        ...(p.lastName !== undefined ? { lastName: p.lastName } : {}),
        ...(p.middleName !== undefined ? { middleName: p.middleName } : {}),
        ...(p.birthDate !== undefined
          ? { birthDate: p.birthDate ? asDate(p.birthDate) : null }
          : {}),
        ...(p.citizenship !== undefined ? { citizenship: p.citizenship } : {}),
        ...(p.gender !== undefined ? { gender: p.gender } : {}),
        ...(p.phone !== undefined ? { phone: p.phone } : {}),
        ...(p.email !== undefined ? { email: p.email } : {}),
        ...(p.notes !== undefined ? { notes: p.notes } : {}),
      },
    });
    if (updated.count === 0) throw new NotFoundException(`Гость ${id} не найден`);
  }
  async addDocument(
    guestId: string,
    d: {
      type: string;
      numberEncrypted: string;
      issueCountry: string | null;
      issuedAtEncrypted: string | null;
      expiresAtEncrypted: string | null;
    },
  ): Promise<string> {
    // Phase 1 изоляции (ADR-100 §17.2): документ по прямому id гостя — только гостю своей организации
    const guest = await this.prisma.db.guest.findFirst({
      where: { AND: [{ id: guestId }, await this.visible()] },
      select: { id: true },
    });
    if (!guest) throw new NotFoundException(`Гость ${guestId} не найден`);
    const row = await this.prisma.db.guestDocument.create({
      data: {
        guestId,
        type: d.type,
        numberEncrypted: d.numberEncrypted,
        issueCountry: d.issueCountry,
        // v1.7 (ADR-082): в базе только шифртекст — дат открытым текстом в строке нет
        issuedAtEncrypted: d.issuedAtEncrypted,
        expiresAtEncrypted: d.expiresAtEncrypted,
      },
      select: { id: true },
    });
    return row.id;
  }
  async deleteDocument(guestId: string, documentId: string): Promise<{ type: string } | null> {
    // Phase 1 изоляции (ADR-100 §17.2): и поиск, и удаление — только внутри гостей своей организации
    const doc = await this.prisma.db.guestDocument.findFirst({
      where: { id: documentId, guestId, guest: await this.visible() },
      select: { type: true },
    });
    if (!doc) return null;
    const res = await this.prisma.db.guestDocument.deleteMany({
      where: { id: documentId, guestId, guest: await this.visible() },
    });
    return res.count > 0 ? doc : null;
  }
  async audit(
    guestId: string,
    action: string,
    fields: string[],
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'Guest',
        entityId: guestId,
        action,
        after: { ...(fields.length ? { fields } : {}), ...(details ?? {}) },
      },
    });
  }
}
