import 'reflect-metadata';
import { Controller, ForbiddenException, Get, Inject, Injectable, Query } from '@nestjs/common';
import { canAt, localDate, zonedStartOfDay } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { currentAssignments, currentLocationId, currentOrganizationId, currentRole, hasSignedInActor } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';

/**
 * Единая Главная «B» для ресторана и гостиницы (владелец 30.10.2026: «для ресторана и для гостиниц и для салонов
 * единая главная должна быть»). Тот же вид, что у салона (`beauty/owner-home.ts`): цифры месяца с прошлым, путь гостя,
 * сотрудники, откуда гости, шесть месяцев. Чистый расчёт без базы, источник собирает `OwnerHomeService`.
 *
 * - выручка: продажи месяца (ресторан: закрытые чеки и бар, гостиница: начисления по дню услуги) как на прежней Главной;
 * - прибыль: выручка минус оплаченные расходы кассы месяца;
 * - «оплачено»: число продаж месяца (чеки, брони с начислениями); средний чек = выручка / продажи, целыми, половина вверх;
 * - путь гостя по людям из броней месяца: забронировали, пришли, (гостиница: оплатили), вернулись повторно.
 * Деньги в минорных единицах bigint, проценты целые (AGENTS §12).
 */
export type VerticalStep = 'BOOKED' | 'CAME' | 'PAID' | 'RETURNED';
/** Ресторан: официант (чеки) или бармен (продажи бара) */
export type StaffRole = 'WAITER' | 'BARTENDER';

export interface VerticalHomeSource {
  vertical: 'FOOD_SERVICE' | 'HOSPITALITY';
  month: string;
  currency: string;
  /** Шаги пути гостя этого направления по порядку */
  steps: VerticalStep[];
  /** Продажи за шесть месяцев: `visitId` чек или бронь, `payerId` кто платил, доли сотрудников */
  sales: Array<{ month: string; amountMinor: bigint; visitId: string; payerId: string; staff: Array<{ id: string; amountMinor: bigint; role?: StaffRole }> }>;
  /** Гостиница: ночи по категориям номеров (начисления за проживание), вместо мастеров (владелец 30.10.2026) */
  rooms: Array<{ typeId: string; name: string; month: string; nights: number; reservationId: string; amountMinor: bigint }>;
  /** Гостиница: активные номера по категории и дни месяца в отчёте (текущий месяц по сегодня) для загрузки */
  capacity?: { days: number; units: Map<string, number> };
  /** Брони месяца и прошлых: гость, статус приведён к BOOKED / CAME / NO_SHOW / CANCELLED */
  visits: Array<{ customerId: string; month: string; status: 'BOOKED' | 'CAME' | 'NO_SHOW' | 'CANCELLED'; paid: boolean; source: string; valueMinor: bigint | null }>;
  /** Месяц первого прихода гостя за всё время */
  firstCame: Map<string, string>;
  lapsed: number;
  expenses: Array<{ month: string; amountMinor: bigint }>;
  ratings: Array<{ staffId: string; stars: number }>;
  staffNames: Map<string, string>;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);
/** целые единицы валюты, половина вверх (владелец 30.10.2026: «с копейками, округлять нужно») */
const roundedAverage = (sum: bigint, n: number) => (n ? String(((sum * 2n + BigInt(n) * 100n) / (BigInt(n) * 200n)) * 100n) : null);

export function sixMonthsOf(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(y, m - 1 - (5 - i), 1)).toISOString().slice(0, 7));
}

function monthKpi(src: VerticalHomeSource, month: string) {
  const rows = src.sales.filter((s) => s.month === month);
  const revenue = rows.reduce((n, s) => n + s.amountMinor, 0n);
  const spent = src.expenses.filter((e) => e.month === month).reduce((n, e) => n + e.amountMinor, 0n);
  const payers = new Set(rows.map((s) => s.payerId)).size;
  return {
    revenueMinor: String(revenue),
    expensesMinor: String(spent),
    profitMinor: String(revenue - spent),
    paidClients: payers,
    averageMinor: roundedAverage(revenue, rows.length),
    revenue,
    spent,
  };
}

/** Гостиница: категории номеров месяца по выручке; средняя цена ночи целыми, половина вверх */
function roomsOf(src: VerticalHomeSource) {
  const by = new Map<string, { typeId: string; name: string; nights: number; guests: Set<string>; revenue: bigint }>();
  for (const r of src.rooms.filter((x) => x.month === src.month)) {
    const t = by.get(r.typeId) ?? { typeId: r.typeId, name: r.name, nights: 0, guests: new Set<string>(), revenue: 0n };
    t.nights += r.nights;
    t.guests.add(r.reservationId);
    t.revenue += r.amountMinor;
    by.set(r.typeId, t);
  }
  const cap = (typeId: string) => (src.capacity?.units.get(typeId) ?? 0) * (src.capacity?.days ?? 0);
  return [...by.values()]
    .sort((a, b) => (a.revenue === b.revenue ? a.name.localeCompare(b.name) : a.revenue > b.revenue ? -1 : 1))
    .map((t) => ({
      typeId: t.typeId,
      name: t.name,
      nights: t.nights,
      guests: t.guests.size,
      revenueMinor: String(t.revenue),
      avgNightMinor: roundedAverage(t.revenue, t.nights),
      // загрузка категории: проданные ночи / (номера × дни); без номеров в базе пусто, не 0%
      loadPercent: cap(t.typeId) ? pct(t.nights, cap(t.typeId)) : null,
    }));
}

/** Гостиница: общая загрузка месяца, проданные ночи / все номера × дни */
function loadOf(src: VerticalHomeSource) {
  if (!src.capacity) return null;
  const nights = src.rooms.filter((r) => r.month === src.month).reduce((n, r) => n + r.nights, 0);
  const capacity = [...src.capacity.units.values()].reduce((n, u) => n + u, 0) * src.capacity.days;
  return { nights, capacity, percent: pct(nights, capacity) };
}

export function buildVerticalHome(src: VerticalHomeSource) {
  const months = sixMonthsOf(src.month);
  const cur = monthKpi(src, src.month);
  const prev = monthKpi(src, months[4]!);
  const inMonth = src.visits.filter((v) => v.month === src.month);
  const before = (c: string) => {
    const first = src.firstCame.get(c);
    return first !== undefined && first < src.month;
  };
  const sets: Record<VerticalStep, Set<string>> = {
    BOOKED: new Set(inMonth.map((v) => v.customerId)),
    CAME: new Set(inMonth.filter((v) => v.status === 'CAME').map((v) => v.customerId)),
    PAID: new Set(inMonth.filter((v) => v.status === 'CAME' && v.paid).map((v) => v.customerId)),
    RETURNED: new Set<string>(),
  };
  // «вернулись повторно»: из гостей прошлого шага те, кто приходил до этого месяца
  const prevOfReturned = src.steps[src.steps.indexOf('RETURNED') - 1] ?? 'CAME';
  sets.RETURNED = new Set([...sets[prevOfReturned]].filter(before));
  const funnel = src.steps.map((step, i) => ({
    step,
    count: sets[step].size,
    percent: i === 0 ? null : pct(sets[step].size, sets[src.steps[i - 1]!].size),
  }));

  // ресторан: официант и бармен отдельной строкой, даже если это один человек
  const per = new Map<string, { id: string; role: StaffRole; revenue: bigint; visits: Set<string>; customers: Set<string> }>();
  for (const s of src.sales.filter((x) => x.month === src.month))
    for (const part of s.staff) {
      const role = part.role ?? 'WAITER';
      const key = `${part.id}:${role}`;
      const m = per.get(key) ?? { id: part.id, role, revenue: 0n, visits: new Set<string>(), customers: new Set<string>() };
      m.revenue += part.amountMinor;
      m.visits.add(s.visitId);
      m.customers.add(s.payerId);
      per.set(key, m);
    }
  const stars = new Map<string, { sum: number; count: number }>();
  for (const r of src.ratings) {
    const s = stars.get(r.staffId) ?? { sum: 0, count: 0 };
    s.sum += r.stars;
    s.count += 1;
    stars.set(r.staffId, s);
  }
  const masters = [...per.values()]
    .sort((a, b) => (a.revenue === b.revenue ? (src.staffNames.get(a.id) ?? '').localeCompare(src.staffNames.get(b.id) ?? '') : a.revenue > b.revenue ? -1 : 1))
    .map((m) => {
      const employeeId = m.id;
      const s = m.role === 'WAITER' ? stars.get(employeeId) : undefined;
      return {
        employeeId,
        name: src.staffNames.get(employeeId) ?? '',
        role: m.role,
        revenueMinor: String(m.revenue),
        visits: m.visits.size,
        customers: m.customers.size,
        returning: 0,
        reviews: s?.count ?? 0,
        avgTenths: s ? Math.round((s.sum * 10) / s.count) : null,
      };
    });

  // откуда гости: источник первой брони пришедшего гостя месяца; сумма броней, если у направления она есть
  const firstSource = new Map<string, string>();
  const bySource = new Map<string, { clients: Set<string>; revenue: bigint; priced: boolean }>();
  for (const v of inMonth.filter((x) => x.status === 'CAME')) {
    if (!firstSource.has(v.customerId)) firstSource.set(v.customerId, v.source);
    const source = firstSource.get(v.customerId)!;
    const s = bySource.get(source) ?? { clients: new Set<string>(), revenue: 0n, priced: false };
    s.clients.add(v.customerId);
    if (v.valueMinor !== null) {
      s.revenue += v.valueMinor;
      s.priced = true;
    }
    bySource.set(source, s);
  }
  const sources = [...bySource]
    .map(([source, s], order) => ({ source, clients: s.clients.size, revenue: s.revenue, priced: s.priced, order }))
    .sort((a, b) => (a.revenue !== b.revenue ? (a.revenue > b.revenue ? -1 : 1) : b.clients - a.clients || a.order - b.order))
    .map((s) => ({ source: s.source, clients: s.clients, revenueMinor: s.priced ? String(s.revenue) : null }));

  return {
    vertical: src.vertical,
    month: src.month,
    currency: src.currency,
    kpi: {
      revenueMinor: cur.revenueMinor,
      expensesMinor: cur.expensesMinor,
      profitMinor: cur.profitMinor,
      paidClients: cur.paidClients,
      averageMinor: cur.averageMinor,
      previous: { revenueMinor: prev.revenueMinor, expensesMinor: prev.expensesMinor, profitMinor: prev.profitMinor, paidClients: prev.paidClients, averageMinor: prev.averageMinor },
    },
    funnel,
    clients: {
      new: [...sets.CAME].filter((c) => src.firstCame.get(c) === src.month).length,
      noShow: inMonth.filter((v) => v.status === 'NO_SHOW').length,
      lapsed: src.lapsed,
    },
    masters,
    rooms: roomsOf(src),
    load: loadOf(src),
    sources,
    months: months.map((m) => {
      const k = monthKpi(src, m);
      return { month: m, revenueMinor: String(k.revenue), expensesMinor: String(k.spent), profitMinor: String(k.revenue - k.spent) };
    }),
  };
}

/** «Давно не были»: последний приход от 46 до 180 дней назад, как у салона */
const LAPSED_AFTER_DAYS = 46;
const LAPSED_MAX_DAYS = 180;
const DAY = 86_400_000;
const lastDay = (m: string) => {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
};
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10);

@Injectable()
export class OwnerHomeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async read(rawMonth?: string, now = new Date()) {
    const locationId = currentLocationId(), organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !locationId || !organizationId) throw new ForbiddenException('Select an authorized location');
    const db = this.prisma.db;
    const location = await db.location.findFirst({
      where: { id: locationId, business: { organizationId } },
      select: { id: true, timezone: true, currency: true, business: { select: { id: true, vertical: true } }, property: { select: { id: true } } },
    });
    if (!location || !canAt(currentRole() ?? 'STAFF', currentAssignments(), 'reports', { businessId: location.business.id, locationId }))
      throw new ForbiddenException('Reports are not available in this scope');
    const vertical = location.business.vertical;
    if (vertical !== 'FOOD_SERVICE' && vertical !== 'HOSPITALITY') throw new ForbiddenException('Owner home is for restaurant and hotel');
    const tz = location.timezone;
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : localDate(now, tz).slice(0, 7);
    const months = sixMonthsOf(month);
    const from = zonedStartOfDay(`${months[0]}-01`, tz);
    const until = zonedStartOfDay(nextDay(lastDay(month)), tz);
    const monthFrom = zonedStartOfDay(`${month}-01`, tz);
    const monthOf = (at: Date) => localDate(at, tz).slice(0, 7);
    const lapseFrom = new Date(until.getTime() - LAPSED_MAX_DAYS * DAY);
    const lapseTo = new Date(until.getTime() - LAPSED_AFTER_DAYS * DAY);

    if (vertical === 'FOOD_SERVICE') {
      const [orders, bar, reservations, history, expenses, ratings] = await Promise.all([
        db.restaurantOrder.findMany({
          where: { locationId, status: 'CLOSED', closedAt: { gte: from, lt: until } },
          select: { id: true, total: true, closedAt: true, waiterId: true },
        }),
        db.barSale.findMany({ where: { locationId, status: 'POSTED', createdAt: { gte: from, lt: until } }, select: { id: true, totalRevenue: true, createdAt: true, createdById: true } }),
        db.restaurantReservation.findMany({ where: { locationId, startsAt: { gte: from, lt: until } }, select: { customerId: true, startsAt: true, status: true, source: true } }),
        db.restaurantReservation.groupBy({
          by: ['customerId'],
          where: { locationId, status: { in: ['SEATED', 'COMPLETED'] }, startsAt: { lt: until } },
          _min: { startsAt: true },
          _max: { startsAt: true },
        }),
        db.restaurantCashOperation.findMany({
          where: { locationId, kind: 'EXPENSE', status: 'COMPLETED', appointmentId: null, orderId: null, occurredAt: { gte: from, lt: until } },
          select: { amount: true, occurredAt: true },
        }),
        db.restaurantOrderRating.findMany({ where: { createdAt: { gte: monthFrom, lt: until }, order: { locationId } }, select: { waiterId: true, stars: true } }),
      ]);
      const staffIds = [...new Set(orders.flatMap((o) => (o.waiterId ? [o.waiterId] : [])))];
      const names = await db.employee.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } });
      // бармен: кто провёл продажу бара (пользователь); имя сотрудника этого пользователя, иначе имя входа
      const barUsers = [...new Set(bar.flatMap((b) => (b.createdById ? [b.createdById] : [])))];
      const [barStaff, barLogins] = await Promise.all([
        db.employee.findMany({ where: { userId: { in: barUsers }, businessId: location.business.id }, select: { userId: true, name: true } }),
        db.user.findMany({ where: { id: { in: barUsers } }, select: { id: true, name: true } }),
      ]);
      const barName = new Map<string, string>(barLogins.map((u) => [u.id, u.name ?? '']));
      for (const e of barStaff) if (e.userId) barName.set(e.userId, e.name);
      const status = (s: string) => (s === 'SEATED' || s === 'COMPLETED' ? 'CAME' : s === 'NO_SHOW' ? 'NO_SHOW' : s === 'CANCELLED' ? 'CANCELLED' : 'BOOKED') as 'CAME';
      return buildVerticalHome({
        vertical,
        month,
        currency: location.currency ?? '',
        steps: ['BOOKED', 'CAME', 'RETURNED'],
        sales: [
          ...orders.map((o) => ({ month: monthOf(o.closedAt!), amountMinor: o.total, visitId: o.id, payerId: o.id, staff: o.waiterId ? [{ id: o.waiterId, amountMinor: o.total }] : [] })),
          ...bar.map((b) => ({
            month: monthOf(b.createdAt),
            amountMinor: b.totalRevenue,
            visitId: b.id,
            payerId: b.id,
            staff: b.createdById ? [{ id: `user:${b.createdById}`, amountMinor: b.totalRevenue, role: 'BARTENDER' as const }] : [],
          })),
        ],
        visits: reservations.map((r) => ({ customerId: r.customerId, month: monthOf(r.startsAt), status: status(r.status), paid: false, source: r.source, valueMinor: null })),
        firstCame: new Map(history.flatMap((h) => (h._min.startsAt ? [[h.customerId, monthOf(h._min.startsAt)] as const] : []))),
        lapsed: history.filter((h) => h._max.startsAt && h._max.startsAt >= lapseFrom && h._max.startsAt < lapseTo).length,
        expenses: expenses.map((e) => ({ month: monthOf(e.occurredAt), amountMinor: e.amount })),
        ratings: ratings.flatMap((r) => (r.waiterId ? [{ staffId: r.waiterId, stars: r.stars }] : [])),
        staffNames: new Map([...names.map((n) => [n.id, n.name] as const), ...[...barName].map(([id, n]) => [`user:${id}`, n] as const)]),
        rooms: [],
      });
    }

    // гостиница: начисления по дню услуги, брони по дате заезда, гость брони
    const propertyId = location.property?.id;
    if (!propertyId) throw new ForbiddenException('Hotel property is not set up');
    const property = { id: propertyId, locationId, organizationId };
    const [charges, reservations, history, expenses, units] = await Promise.all([
      db.charge.findMany({
        where: {
          voidedAt: null,
          serviceDate: { gte: new Date(`${months[0]}-01T00:00Z`), lte: new Date(`${lastDay(month)}T00:00Z`) },
          folio: { reservationItem: { reservation: { property } } },
        },
        select: {
          amount: true,
          kind: true,
          quantity: true,
          serviceDate: true,
          folio: {
            select: {
              reservationItem: {
                select: { reservationId: true, accommodationType: { select: { id: true, name: true } }, reservation: { select: { primaryGuestId: true } } },
              },
            },
          },
        },
      }),
      db.reservation.findMany({
        where: { property, arrivalDate: { gte: new Date(`${months[0]}-01T00:00Z`), lte: new Date(`${lastDay(month)}T00:00Z`) } },
        select: {
          id: true,
          primaryGuestId: true,
          arrivalDate: true,
          status: true,
          source: true,
          totalAmount: true,
          items: { select: { folio: { select: { allocations: { select: { amount: true }, take: 1 } } } } },
        },
      }),
      db.reservation.groupBy({
        by: ['primaryGuestId'],
        where: { property, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, arrivalDate: { lte: new Date(`${lastDay(month)}T00:00Z`) } },
        _min: { arrivalDate: true },
        _max: { arrivalDate: true },
      }),
      db.$queryRaw<Array<{ amount: bigint; occurredAt: Date }>>`SELECT c.amount, c.occurred_at AS "occurredAt" FROM cash_operations c JOIN properties p ON p.id=c.property_id WHERE c.property_id=${propertyId}::uuid AND p.location_id=${locationId}::uuid AND p.organization_id=${organizationId}::uuid AND c.status='COMPLETED' AND c.kind='EXPENSE' AND c.occurred_at>=${from} AND c.occurred_at<${until}`,
      db.inventoryUnit.groupBy({ by: ['accommodationTypeId'], where: { propertyId, active: true, property: { locationId, organizationId } }, _count: { _all: true } }),
    ]);
    // дни месяца в отчёте: прошлый месяц целиком, текущий по сегодня филиала
    const today = localDate(now, tz);
    const days = today.slice(0, 7) === month ? Number(today.slice(8, 10)) : Number(lastDay(month).slice(8, 10));
    const day = (d: Date) => d.toISOString().slice(0, 7);
    // одна продажа = одна бронь в месяце услуги: сумма её начислений
    const sales = new Map<string, { month: string; amountMinor: bigint; visitId: string; payerId: string; staff: [] }>();
    for (const c of charges) {
      const item = c.folio.reservationItem;
      const m = day(c.serviceDate!);
      const key = `${item.reservationId}:${m}`;
      const s = sales.get(key) ?? { month: m, amountMinor: 0n, visitId: item.reservationId, payerId: item.reservation.primaryGuestId ?? item.reservationId, staff: [] as [] };
      s.amountMinor += c.amount;
      sales.set(key, s);
    }
    const status = (s: string) => (s === 'CHECKED_IN' || s === 'CHECKED_OUT' ? 'CAME' : s === 'NO_SHOW' ? 'NO_SHOW' : s === 'CANCELLED' ? 'CANCELLED' : 'BOOKED') as 'CAME';
    return buildVerticalHome({
      vertical,
      month,
      currency: location.currency ?? '',
      steps: ['BOOKED', 'CAME', 'PAID', 'RETURNED'],
      sales: [...sales.values()],
      visits: reservations.map((r) => ({
        customerId: r.primaryGuestId ?? r.id,
        month: day(r.arrivalDate),
        status: status(r.status),
        paid: r.items.some((i) => (i.folio?.allocations.length ?? 0) > 0),
        source: r.source,
        valueMinor: r.totalAmount,
      })),
      firstCame: new Map(history.flatMap((h) => (h.primaryGuestId && h._min.arrivalDate ? [[h.primaryGuestId, day(h._min.arrivalDate)] as const] : []))),
      lapsed: history.filter((h) => h.primaryGuestId && h._max.arrivalDate && h._max.arrivalDate >= lapseFrom && h._max.arrivalDate < lapseTo).length,
      expenses: expenses.map((e) => ({ month: monthOf(e.occurredAt), amountMinor: e.amount })),
      ratings: [],
      staffNames: new Map(),
      capacity: { days, units: new Map(units.map((u) => [u.accommodationTypeId, u._count._all])) },
      // вместо мастеров категории номеров (владелец 30.10.2026: «в гостиницах как по сотрудникам, давай подумаем»):
      // начисления за проживание, ночи = количество в начислении
      rooms: charges
        .filter((c) => c.kind === 'ACCOMMODATION')
        .map((c) => ({
          typeId: c.folio.reservationItem.accommodationType.id,
          name: c.folio.reservationItem.accommodationType.name,
          month: day(c.serviceDate!),
          nights: Math.max(1, c.quantity),
          reservationId: c.folio.reservationItem.reservationId,
          amountMinor: c.amount,
        })),
    });
  }
}

/** `GET /owner-home?month=YYYY-MM`: единая Главная «B» ресторана и гостиницы (салон: `GET /beauty/owner-home`) */
@Controller('owner-home')
@ScopeAware()
export class OwnerHomeController {
  constructor(@Inject(OwnerHomeService) private readonly service: OwnerHomeService) {}
  @Get()
  @Access('reports')
  read(@Query('month') month?: string) {
    return this.service.read(month);
  }
}
