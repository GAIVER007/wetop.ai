import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Prisma, ReservationSource, ReservationStatus } from '@pms/database';
import { folioBalance, todayAt } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyRef } from '../database/property-ref';
import { Access } from '../auth/access.decorator';
export interface DirectoryQuery {
  from?: string;
  to?: string;
  status?: string;
  q?: string;
  page?: string;
  /** Сколько строк на странице, 1…200. По умолчанию 25 — как было до «Гостей на сегодня» */
  pageSize?: string;
  /** Быстрый вид (ADR-106, срез R2): today — день объекта; future, inhouse, attention — без периода */
  view?: string;
  /** К чему относится период: проживание пересекает его (по умолчанию), заезд, выезд, создание */
  date?: string;
  /** Значение ReservationSource без регистра, иначе — подстрока названия канала (booking → Booking.com) */
  source?: string;
  /** Состояние счетов — те же правила, что колонка «Финансы» (`finance-state.ts` стойки) */
  payment?: string;
  /** Все проживания с ячейкой / активная бронь с проживанием без ячейки / назначен номер / койка */
  allocation?: string;
  /** Код категории (`accommodation_types.code`) */
  category?: string;
  /** По умолчанию прежний `arrival_date desc`; у view=today — ближайший заезд */
  sort?: string;
}
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const PARAMS = [
  'from',
  'to',
  'status',
  'q',
  'page',
  'pageSize',
  'view',
  'date',
  'source',
  'payment',
  'allocation',
  'category',
  'sort',
] as const;
const VIEWS = ['all', 'today', 'future', 'inhouse', 'attention'] as const;
const DATE_BASES = ['stay', 'arrival', 'departure', 'created'] as const;
const PAYMENTS = ['paid', 'partial', 'unpaid', 'due', 'refund', 'refunded'] as const;
const ALLOCATIONS = ['assigned', 'missing', 'room', 'bed'] as const;
const SORTS = ['arrival', 'departure', 'new', 'amount', 'debt'] as const;
/** Место занято или будет занято: только у такой брони «без размещения» — забота смены */
const ACTIVE: ReservationStatus[] = ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'];
const oneOf = <T extends string>(list: readonly T[], value: string | undefined): T | undefined => {
  if (!value) return undefined;
  if (!(list as readonly string[]).includes(value))
    throw new BadRequestException('Неизвестное значение отбора');
  return value as T;
};

interface Filter {
  propertyId: string;
  timezone: string;
  today: string;
  from: string;
  to: string;
  status: string;
  q: string;
  view: (typeof VIEWS)[number];
  date: (typeof DATE_BASES)[number];
  source: ReservationSource | undefined;
  channel: string | undefined;
  payment: (typeof PAYMENTS)[number] | undefined;
  allocation: (typeof ALLOCATIONS)[number] | undefined;
  category: string;
  sort: (typeof SORTS)[number] | undefined;
  page: number;
  pageSize: number;
}

const rowSelect = {
  id: true,
  confirmationNumber: true,
  status: true,
  source: true,
  channel: true,
  arrivalDate: true,
  departureDate: true,
  currency: true,
  totalAmount: true,
  primaryGuest: {
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  },
  items: {
    select: {
      allocations: {
        orderBy: { startDate: 'desc' },
        take: 1,
        select: { inventoryUnit: { select: { code: true } } },
      },
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
} satisfies Prisma.ReservationSelect;
type Row = Prisma.ReservationGetPayload<{ select: typeof rowSelect }>;

@Injectable()
export class ReservationDirectory {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(query: DirectoryQuery) {
    for (const key of PARAMS) {
      if (query[key] !== undefined && typeof query[key] !== 'string')
        throw new BadRequestException('Параметры поиска должны быть строками');
    }
    const status = query.status || 'ALL';
    const page = Number(query.page || 1);
    // Потолок держит один запрос в берегах: на объекте 88 мест, больше 200 броней в сутках не бывает
    const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
    if (status !== 'ALL' && !Object.values(ReservationStatus).includes(status as ReservationStatus))
      throw new BadRequestException('Неизвестный статус');
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Некорректная страница');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      throw new BadRequestException(`Размер страницы — целое число от 1 до ${MAX_PAGE_SIZE}`);
    const q = (query.q || '').trim();
    if (q.length > 120) throw new BadRequestException('Слишком длинный запрос');
    const view = oneOf(VIEWS, query.view) ?? 'all';
    const date = oneOf(DATE_BASES, query.date) ?? 'stay';
    const payment = oneOf(PAYMENTS, query.payment);
    const allocation = oneOf(ALLOCATIONS, query.allocation);
    const sort = oneOf(SORTS, query.sort) ?? (view === 'today' ? 'arrival' : undefined);
    const sourceText = (query.source || '').trim();
    const category = (query.category || '').trim();
    if (sourceText.length > 64 || category.length > 64)
      throw new BadRequestException('Слишком длинное значение отбора');
    const source = Object.values(ReservationSource).find((s) => s === sourceText.toUpperCase());

    const property = await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name).catch(() => null);
    if (!property) throw new NotFoundException('Гостиница ещё не настроена');
    // Без дат — «сегодня» по поясу объекта (С-13), а не по Алматы: справочник у каждой гостиницы свой
    const today = todayAt(property.timezone);
    const from = view === 'today' ? today : query.from || today;
    const to = view === 'today' ? today : query.to || from;
    const valid = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (
      !valid(from) ||
      !valid(to) ||
      from > to ||
      Date.parse(to) - Date.parse(from) > 365 * 86400000
    )
      throw new BadRequestException('Выберите период до 366 дней');

    const filter: Filter = {
      propertyId: property.id,
      timezone: property.timezone,
      today,
      from,
      to,
      status,
      q,
      view,
      date,
      source,
      channel: sourceText && !source ? sourceText : undefined,
      payment,
      allocation,
      category,
      sort,
      page,
      pageSize,
    };
    // Деньги, «Требуют внимания» и сутки создания по поясу объекта Prisma не выразит — эти отборы
    // считает SQL; остальное — прежним запросом R1
    const { rows, total, grouped } =
      payment || sort === 'debt' || view === 'attention' || date === 'created'
        ? await this.bySql(filter)
        : await this.byPrisma(filter);
    const counts: Record<string, number> = { ALL: 0 };
    let all = 0;
    for (const g of grouped) {
      counts[g.status] = g.count;
      all += g.count;
    }
    counts['ALL'] = all;
    return {
      from,
      to,
      total,
      page,
      pageSize,
      counts,
      rows: rows.map((r) => {
        const folios = r.items.flatMap((it) => (it.folio ? [it.folio] : []));
        const balance = folioBalance({
          charges: folios.flatMap((f) =>
            f.charges.map((c) => ({ amountMinor: c.amount, voided: false })),
          ),
          allocations: folios.flatMap((f) => f.allocations.map((a) => ({ amountMinor: a.amount }))),
          refunds: folios.flatMap((f) => f.refunds.map((a) => ({ amountMinor: a.amount }))),
        });
        return {
          confirmationNumber: r.confirmationNumber,
          status: r.status,
          source: r.source,
          channel: r.channel,
          arrivalDate: r.arrivalDate.toISOString().slice(0, 10),
          departureDate: r.departureDate.toISOString().slice(0, 10),
          currency: r.currency,
          totalAmountMinor: r.totalAmount.toString(),
          primaryGuest: r.primaryGuest
            ? {
                id: r.primaryGuest.id,
                label: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`.trim(),
                phone: r.primaryGuest.phone,
                email: r.primaryGuest.email,
              }
            : null,
          unitCodes: r.items.flatMap((it) => it.allocations.map((a) => a.inventoryUnit.code)),
          itemsCount: r.items.length,
          chargedMinor: balance.chargedMinor.toString(),
          paidMinor: balance.paidMinor.toString(),
          refundedMinor: balance.refundedMinor.toString(),
          balanceMinor: balance.balanceMinor.toString(),
          hasFolios: folios.length > 0,
        };
      }),
    };
  }

  private async byPrisma(f: Filter) {
    const periodless = f.view === 'future' || f.view === 'inhouse';
    const period = periodless
      ? {}
      : f.date === 'arrival'
        ? { arrivalDate: { gte: new Date(f.from), lte: new Date(f.to) } }
        : f.date === 'departure'
          ? { departureDate: { gte: new Date(f.from), lte: new Date(f.to) } }
          : { arrivalDate: { lte: new Date(f.to) }, departureDate: { gte: new Date(f.from) } };
    const extra: Prisma.ReservationWhereInput[] = [];
    if (f.view === 'future')
      extra.push({ arrivalDate: { gt: new Date(f.today) } }, { status: { not: 'CANCELLED' } });
    if (f.view === 'inhouse') extra.push({ status: 'CHECKED_IN' });
    if (f.source) extra.push({ source: f.source });
    if (f.channel) extra.push({ channel: { contains: f.channel, mode: 'insensitive' } });
    if (f.category) extra.push({ items: { some: { accommodationType: { code: f.category } } } });
    if (f.allocation === 'assigned')
      extra.push({ items: { every: { allocations: { some: {} } } } });
    if (f.allocation === 'missing')
      extra.push({ status: { in: ACTIVE } }, { items: { some: { allocations: { none: {} } } } });
    if (f.allocation === 'room' || f.allocation === 'bed')
      extra.push({
        items: {
          some: {
            allocations: {
              some: { inventoryUnit: { kind: f.allocation === 'room' ? 'ROOM' : 'BED' } },
            },
          },
        },
      });
    // Отбор без статуса: по нему же считаются числа на чипах, чтобы «Проживают 3» было видно
    // до нажатия — смена не перебирает семь статусов вслепую (поручение владельца 21.09)
    const whereBase: Prisma.ReservationWhereInput = {
      propertyId: f.propertyId,
      ...period,
      ...(f.q
        ? {
            OR: [
              { confirmationNumber: { contains: f.q, mode: 'insensitive' as const } },
              // ADR-071: номер брони в канале стойка вводит без пробелов — так же и ищем
              { externalId: { contains: f.q.replace(/\s+/g, '') } },
              {
                primaryGuest: {
                  is: {
                    OR: [
                      { firstName: { contains: f.q, mode: 'insensitive' as const } },
                      { lastName: { contains: f.q, mode: 'insensitive' as const } },
                      { phone: { contains: f.q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(extra.length ? { AND: extra } : {}),
    };
    const where = {
      ...whereBase,
      ...(f.status !== 'ALL' ? { status: f.status as ReservationStatus } : {}),
    };
    const orderBy: Prisma.ReservationOrderByWithRelationInput[] = [
      f.sort === 'arrival'
        ? { arrivalDate: 'asc' }
        : f.sort === 'departure'
          ? { departureDate: 'asc' }
          : f.sort === 'new'
            ? { createdAt: 'desc' }
            : f.sort === 'amount'
              ? { totalAmount: 'desc' }
              : { arrivalDate: 'desc' },
      { id: 'asc' },
    ];
    const [total, rows, grouped] = await Promise.all([
      this.prisma.db.reservation.count({ where }),
      this.prisma.db.reservation.findMany({
        where,
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        orderBy,
        select: rowSelect,
      }),
      this.prisma.db.reservation.groupBy({
        by: ['status'],
        where: whereBase,
        _count: { _all: true },
      }),
    ]);
    return {
      total,
      rows: rows as Row[],
      grouped: (grouped as { status: string; _count: { _all: number } }[]).map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
    };
  }

  /**
   * SQL-путь (ADR-106, срез R2): страница, итог и чипы — одним отбором. Деньги — по формуле
   * `folioBalance` домена: начислено без сторно − оплачено платежами COMPLETED + возвращено.
   * Имени схемы в SQL нет: `search_path` направит прогон в `pms_test` (ADR-042); запрос идёт тем же
   * пулом, что остальные, и RLS действует (ADR-103). Строки ответа — прежней выборкой R1 по id.
   */
  private async bySql(f: Filter) {
    const balance = Prisma.sql`(m."charged" - m."paid" + m."refunded")`;
    const withoutUnit = Prisma.sql`EXISTS (
      SELECT 1 FROM "reservation_items" wi
      WHERE wi."reservation_id" = r."id"
        AND NOT EXISTS (SELECT 1 FROM "allocations" wa WHERE wa."reservation_item_id" = wi."id"))`;
    const active = Prisma.sql`r."status"::text IN ('TENTATIVE', 'CONFIRMED', 'CHECKED_IN')`;
    const where: Prisma.Sql[] = [Prisma.sql`r."property_id" = ${f.propertyId}::uuid`];
    if (f.view === 'future')
      where.push(
        Prisma.sql`r."arrival_date" > ${f.today}::date`,
        Prisma.sql`r."status"::text <> 'CANCELLED'`,
      );
    else if (f.view === 'inhouse') where.push(Prisma.sql`r."status"::text = 'CHECKED_IN'`);
    else if (f.view === 'attention')
      // Четыре существующих факта (план R2 §2): без ячейки; не заехал вовремя — правило
      // overdueArrivals Главной; долг гостя в доме или после выезда; деньги ждут возврата
      where.push(Prisma.sql`(
        (${active} AND ${withoutUnit})
        OR (r."status"::text IN ('TENTATIVE', 'CONFIRMED') AND r."arrival_date" < ${f.today}::date)
        OR (${balance} > 0 AND r."status"::text IN ('CHECKED_IN', 'CHECKED_OUT'))
        OR (${balance} < 0))`);
    else if (f.date === 'arrival')
      where.push(Prisma.sql`r."arrival_date" BETWEEN ${f.from}::date AND ${f.to}::date`);
    else if (f.date === 'departure')
      where.push(Prisma.sql`r."departure_date" BETWEEN ${f.from}::date AND ${f.to}::date`);
    else if (f.date === 'created')
      // `created_at` — момент в UTC; сутки создания — по поясу объекта
      where.push(
        Prisma.sql`(r."created_at" AT TIME ZONE ${f.timezone})::date BETWEEN ${f.from}::date AND ${f.to}::date`,
      );
    else
      where.push(
        Prisma.sql`r."arrival_date" <= ${f.to}::date`,
        Prisma.sql`r."departure_date" >= ${f.from}::date`,
      );
    if (f.q) {
      const text = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`;
      const compact = `%${f.q.replace(/\s+/g, '').replace(/[\\%_]/g, '\\$&')}%`;
      where.push(Prisma.sql`(
        r."confirmation_number" ILIKE ${text}
        OR r."external_id" LIKE ${compact}
        OR g."first_name" ILIKE ${text}
        OR g."last_name" ILIKE ${text}
        OR g."phone" LIKE ${text})`);
    }
    if (f.source) where.push(Prisma.sql`r."source"::text = ${f.source}`);
    if (f.channel)
      where.push(Prisma.sql`r."channel" ILIKE ${`%${f.channel.replace(/[\\%_]/g, '\\$&')}%`}`);
    if (f.category)
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "reservation_items" ci
        JOIN "accommodation_types" ct ON ct."id" = ci."accommodation_type_id"
        WHERE ci."reservation_id" = r."id" AND ct."code" = ${f.category})`);
    if (f.allocation === 'assigned') where.push(Prisma.sql`NOT ${withoutUnit}`);
    if (f.allocation === 'missing') where.push(active, withoutUnit);
    if (f.allocation === 'room' || f.allocation === 'bed')
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "reservation_items" ki
        JOIN "allocations" ka ON ka."reservation_item_id" = ki."id"
        JOIN "inventory_units" ku ON ku."id" = ka."inventory_unit_id"
        WHERE ki."reservation_id" = r."id" AND ku."kind"::text = ${f.allocation === 'room' ? 'ROOM' : 'BED'})`);
    // Те же развилки, что `financeState` колонки «Финансы»: «возвращено» раньше «оплачено»
    const refunded = Prisma.sql`(${balance} = 0 AND m."charged" = 0 AND m."refunded" > 0)`;
    if (f.payment === 'paid')
      where.push(Prisma.sql`(${balance} = 0 AND m."paid" > 0 AND NOT ${refunded})`);
    if (f.payment === 'partial') where.push(Prisma.sql`(${balance} > 0 AND m."paid" > 0)`);
    if (f.payment === 'unpaid') where.push(Prisma.sql`(${balance} > 0 AND m."paid" = 0)`);
    if (f.payment === 'due') where.push(Prisma.sql`${balance} > 0`);
    if (f.payment === 'refund') where.push(Prisma.sql`${balance} < 0`);
    if (f.payment === 'refunded') where.push(refunded);

    const money = Prisma.sql`CROSS JOIN LATERAL (
      SELECT
        COALESCE((SELECT SUM(c."amount") FROM "charges" c
          JOIN "folios" cf ON cf."id" = c."folio_id"
          JOIN "reservation_items" ci2 ON ci2."id" = cf."reservation_item_id"
          WHERE ci2."reservation_id" = r."id" AND c."voided_at" IS NULL), 0) AS "charged",
        COALESCE((SELECT SUM(pa."amount") FROM "payment_allocations" pa
          JOIN "payments" p ON p."id" = pa."payment_id"
          JOIN "folios" pf ON pf."id" = pa."folio_id"
          JOIN "reservation_items" pi ON pi."id" = pf."reservation_item_id"
          WHERE pi."reservation_id" = r."id" AND p."status"::text = 'COMPLETED'), 0) AS "paid",
        COALESCE((SELECT SUM(rf."amount") FROM "refunds" rf
          JOIN "folios" rff ON rff."id" = rf."folio_id"
          JOIN "reservation_items" ri ON ri."id" = rff."reservation_item_id"
          WHERE ri."reservation_id" = r."id"), 0) AS "refunded"
    ) m`;
    const source = Prisma.sql`FROM "reservations" r
      LEFT JOIN "guests" g ON g."id" = r."primary_guest_id"
      ${money}`;
    const whereBase = Prisma.join(where, ' AND ');
    const whereFull =
      f.status === 'ALL' ? whereBase : Prisma.sql`${whereBase} AND r."status"::text = ${f.status}`;
    const orderBy =
      f.sort === 'arrival'
        ? Prisma.sql`r."arrival_date" ASC`
        : f.sort === 'departure'
          ? Prisma.sql`r."departure_date" ASC`
          : f.sort === 'new'
            ? Prisma.sql`r."created_at" DESC`
            : f.sort === 'amount'
              ? Prisma.sql`r."total_amount" DESC`
              : f.sort === 'debt'
                ? Prisma.sql`${balance} DESC`
                : Prisma.sql`r."arrival_date" DESC`;
    const [page, total, grouped] = await Promise.all([
      this.prisma.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT r."id"::text AS "id" ${source}
        WHERE ${whereFull}
        ORDER BY ${orderBy}, r."id" ASC
        LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`),
      this.prisma.db.$queryRaw<Array<{ n: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "n" ${source} WHERE ${whereFull}`),
      this.prisma.db.$queryRaw<Array<{ status: string; n: number }>>(Prisma.sql`
        SELECT r."status"::text AS "status", COUNT(*)::int AS "n" ${source}
        WHERE ${whereBase} GROUP BY r."status"`),
    ]);
    const ids = page.map((p) => p.id);
    const found = ids.length
      ? await this.prisma.db.reservation.findMany({
          where: { id: { in: ids } },
          select: rowSelect,
        })
      : [];
    const byId = new Map((found as Row[]).map((r) => [r.id, r]));
    return {
      total: total[0]?.n ?? 0,
      rows: ids.flatMap((id) => byId.get(id) ?? []),
      grouped: grouped.map((g) => ({ status: g.status, count: g.n })),
    };
  }
}
@Access('desk')
@Controller('hotel/reservations')
export class ReservationDirectoryController {
  constructor(@Inject(ReservationDirectory) private readonly service: ReservationDirectory) {}
  @Get() list(@Query() query: DirectoryQuery) {
    return this.service.list(query);
  }
}
