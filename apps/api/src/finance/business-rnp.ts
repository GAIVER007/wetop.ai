import 'reflect-metadata';
import { Controller, ForbiddenException, Get, Inject, Injectable, Query } from '@nestjs/common';
import { canAt, localDate, zonedStartOfDay } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { currentAssignments, currentLocationId, currentOrganizationId, currentRole, hasSignedInActor } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';

/**
 * РНП бизнеса клиента, «рука на пульсе» (владелец 30.10.2026: «рнп должна быть у клиентов тоже и заполняться туда
 * каждый день все данные»), как РНП Кабинета WETOP: каждый день месяца строкой и итоги периода. Данные филиала из
 * базы, сами каждый день, ничего вносить руками не нужно:
 *
 * - посетители и заявки: сайт филиала (счётчик WETOP, заявки с сайта);
 * - новые брони: брони столов и гостиницы, созданные в этот день; салон: записи НА этот день (02.11.2026), которые
 *   раскладываются без остатка: пришли + не пришли + отменены + не отмечены;
 * - пришли и выручка: салон выполненные записи, ресторан закрытые чеки и бар, гостиница заезды и начисления по дню;
 * - не пришли: неявки дня; поступления: оплаты дня; расходы: оплаченные расходы кассы; прибыль = выручка − расходы;
 * - средний чек = выручка / пришли, целыми, половина вверх.
 * День по часам филиала. Деньги минорными bigint строкой, проценты целые (AGENTS §12).
 */
export interface BusinessRnpSource {
  month: string;
  /** Сегодня филиала: текущий месяц показывается по сегодня */
  today: string;
  visitors: Array<{ day: string; key: string }>;
  leads: string[];
  bookings: string[];
  visits: Array<{ day: string; amountMinor: bigint }>;
  noShows: string[];
  /** Салон (владелец 02.11.2026 «а где 4?»): записи дня отменены и ещё не отмечены, чтобы записи сходились */
  cancelled?: string[];
  pending?: string[];
  receipts: Array<{ day: string; amountMinor: bigint }>;
  expenses: Array<{ day: string; amountMinor: bigint }>;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);
const avg = (sum: bigint, n: number) => (n ? String(((sum * 2n + BigInt(n) * 100n) / (BigInt(n) * 200n)) * 100n) : null);
const sum = (rows: Array<{ amountMinor: bigint }>) => rows.reduce((n, r) => n + r.amountMinor, 0n);
const lastDay = (m: string) => {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
};

export function buildBusinessRnp(src: BusinessRnpSource) {
  const end = src.today.slice(0, 7) === src.month ? src.today : lastDay(src.month);
  const days: string[] = [];
  for (let d = `${src.month}-01`; d <= end; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days.push(d);
  const inMonth = (d: string) => d.slice(0, 7) === src.month && d <= end;
  const row = (pick: (d: string) => boolean) => {
    const visits = src.visits.filter((v) => pick(v.day));
    const revenue = sum(visits);
    const spent = sum(src.expenses.filter((e) => pick(e.day)));
    return {
      visitors: new Set(src.visitors.filter((v) => pick(v.day)).map((v) => v.key)).size,
      leads: src.leads.filter(pick).length,
      bookings: src.bookings.filter(pick).length,
      visits: visits.length,
      noShows: src.noShows.filter(pick).length,
      cancelled: (src.cancelled ?? []).filter(pick).length,
      pending: (src.pending ?? []).filter(pick).length,
      revenueMinor: String(revenue),
      receiptsMinor: String(sum(src.receipts.filter((r) => pick(r.day)))),
      expensesMinor: String(spent),
      profitMinor: String(revenue - spent),
      averageMinor: avg(revenue, visits.length),
    };
  };
  const total = row(inMonth);
  return {
    month: src.month,
    days: days.map((day) => ({ day, ...row((d) => d === day) })),
    // пришли из записей без отменённых (салон); где отмен и «не отмечены» нет: из пришли + не пришли, как раньше
    total: {
      ...total,
      visitorToLead: pct(total.leads, total.visitors),
      cameRate: src.cancelled
        ? pct(total.visits, total.bookings - total.cancelled)
        : pct(total.visits, total.visits + total.noShows),
    },
  };
}

@Injectable()
export class BusinessRnpService {
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
    const tz = location.timezone;
    const today = localDate(now, tz);
    const month = typeof rawMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today.slice(0, 7);
    const from = zonedStartOfDay(`${month}-01`, tz);
    const next = new Date(Date.parse(`${lastDay(month)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const until = zonedStartOfDay(next, tz);
    const at = { gte: from, lt: until };
    const day = (d: Date) => localDate(d, tz);
    const stay = { gte: new Date(`${month}-01T00:00Z`), lte: new Date(`${lastDay(month)}T00:00Z`) };
    const vertical = location.business.vertical;
    const propertyId = location.property?.id ?? null;

    // сайт филиала: счётчик и заявки (у гостиницы сайт может быть привязан к объекту)
    const site = { OR: [{ locationId }, ...(propertyId ? [{ propertyId }] : [])] };
    const [sessions, leads] = await Promise.all([
      db.webSession.findMany({ where: { startedAt: at, site }, select: { startedAt: true, visitorKey: true } }),
      db.siteLead.findMany({ where: { locationId, createdAt: at }, select: { createdAt: true } }),
    ]);
    const base = {
      month,
      today,
      visitors: sessions.map((s) => ({ day: day(s.startedAt), key: s.visitorKey })),
      leads: leads.map((l) => day(l.createdAt)),
    };
    const cash = async () =>
      (
        await db.restaurantCashOperation.findMany({
          where: { locationId, kind: 'EXPENSE', status: 'COMPLETED', appointmentId: null, orderId: null, occurredAt: at },
          select: { amount: true, occurredAt: true },
        })
      ).map((e) => ({ day: day(e.occurredAt), amountMinor: e.amount }));

    let source: BusinessRnpSource;
    if (vertical === 'BEAUTY') {
      // владелец 02.11.2026 («записей 14, пришли 10, не пришли 0, а где 4?»): все записи дня по времени визита и
      // каждая в одной колонке: пришли (выполнена) + не пришли + отменены + не отмечены (ждут, в работе) = записи
      const [booked, done, paid, expenses] = await Promise.all([
        db.appointment.findMany({ where: { locationId, startsAt: at }, select: { startsAt: true, status: true } }),
        db.appointment.findMany({ where: { locationId, status: 'DONE', startsAt: at }, select: { startsAt: true, price: true } }),
        db.restaurantCashOperation.findMany({
          where: { locationId, kind: 'INCOME', status: 'COMPLETED', appointmentId: { not: null }, occurredAt: at },
          select: { amount: true, occurredAt: true },
        }),
        cash(),
      ]);
      source = {
        ...base,
        bookings: booked.map((a) => day(a.startsAt)),
        visits: done.map((a) => ({ day: day(a.startsAt), amountMinor: a.price })),
        noShows: booked.filter((a) => a.status === 'NO_SHOW').map((a) => day(a.startsAt)),
        cancelled: booked.filter((a) => a.status === 'CANCELLED').map((a) => day(a.startsAt)),
        pending: booked.filter((a) => a.status === 'BOOKED' || a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS').map((a) => day(a.startsAt)),
        receipts: paid.map((p) => ({ day: day(p.occurredAt), amountMinor: p.amount })),
        expenses,
      };
    } else if (vertical === 'FOOD_SERVICE') {
      const [created, noShow, orders, bar, paid, expenses] = await Promise.all([
        db.restaurantReservation.findMany({ where: { locationId, createdAt: at }, select: { createdAt: true } }),
        db.restaurantReservation.findMany({ where: { locationId, status: 'NO_SHOW', startsAt: at }, select: { startsAt: true } }),
        db.restaurantOrder.findMany({ where: { locationId, status: 'CLOSED', closedAt: at }, select: { closedAt: true, total: true } }),
        db.barSale.findMany({ where: { locationId, status: 'POSTED', createdAt: at }, select: { createdAt: true, totalRevenue: true } }),
        db.restaurantPayment.findMany({ where: { locationId, status: 'COMPLETED', paidAt: at }, select: { paidAt: true, amount: true } }),
        cash(),
      ]);
      source = {
        ...base,
        bookings: created.map((r) => day(r.createdAt)),
        visits: [
          ...orders.map((o) => ({ day: day(o.closedAt!), amountMinor: o.total })),
          ...bar.map((b) => ({ day: day(b.createdAt), amountMinor: b.totalRevenue })),
        ],
        noShows: noShow.map((r) => day(r.startsAt)),
        receipts: [...paid.map((p) => ({ day: day(p.paidAt), amountMinor: p.amount })), ...bar.map((b) => ({ day: day(b.createdAt), amountMinor: b.totalRevenue }))],
        expenses,
      };
    } else if (vertical === 'HOSPITALITY' && propertyId) {
      const property = { id: propertyId, locationId, organizationId };
      const [created, arrivals, charges, paid, expenses] = await Promise.all([
        db.reservation.findMany({ where: { property, createdAt: at }, select: { createdAt: true } }),
        db.reservation.findMany({ where: { property, arrivalDate: stay, status: { in: ['CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'] } }, select: { arrivalDate: true, status: true } }),
        db.charge.findMany({ where: { voidedAt: null, serviceDate: stay, folio: { reservationItem: { reservation: { property } } } }, select: { serviceDate: true, amount: true } }),
        db.payment.findMany({ where: { property, status: 'COMPLETED', paidAt: at }, select: { paidAt: true, amount: true } }),
        db.$queryRaw<Array<{ amount: bigint; occurredAt: Date }>>`SELECT c.amount, c.occurred_at AS "occurredAt" FROM cash_operations c JOIN properties p ON p.id=c.property_id WHERE c.property_id=${propertyId}::uuid AND p.location_id=${locationId}::uuid AND p.organization_id=${organizationId}::uuid AND c.status='COMPLETED' AND c.kind='EXPENSE' AND c.occurred_at>=${from} AND c.occurred_at<${until}`,
      ]);
      // гостиница: «пришли» = заезды дня, выручка = начисления по дню услуги (дата проживания без часового пояса, §13)
      const date = (d: Date) => d.toISOString().slice(0, 10);
      const came = arrivals.filter((r) => r.status !== 'NO_SHOW');
      const revenueByDay = new Map<string, bigint>();
      for (const c of charges) revenueByDay.set(date(c.serviceDate!), (revenueByDay.get(date(c.serviceDate!)) ?? 0n) + c.amount);
      const visitsByDay = new Map<string, number>();
      for (const r of came) visitsByDay.set(date(r.arrivalDate), (visitsByDay.get(date(r.arrivalDate)) ?? 0) + 1);
      // выручку дня кладём первой строкой заезда дня; день без заезда с выручкой добавляется отдельно (`withLoneRevenue`)
      const visits: BusinessRnpSource['visits'] = [];
      for (const [d, n] of visitsByDay) for (let i = 0; i < n; i++) visits.push({ day: d, amountMinor: i === 0 ? (revenueByDay.get(d) ?? 0n) : 0n });
      const lone = [...revenueByDay].filter(([d]) => !visitsByDay.has(d)).map(([d, m]) => ({ day: d, amountMinor: m }));
      source = {
        ...base,
        bookings: created.map((r) => day(r.createdAt)),
        visits,
        noShows: arrivals.filter((r) => r.status === 'NO_SHOW').map((r) => date(r.arrivalDate)),
        receipts: paid.map((p) => ({ day: day(p.paidAt), amountMinor: p.amount })),
        expenses: expenses.map((e) => ({ day: day(e.occurredAt), amountMinor: e.amount })),
      };
      const view = buildBusinessRnp(source);
      return { ...withLoneRevenue(view, lone), currency: location.currency ?? '', vertical };
    } else {
      source = { ...base, bookings: [], visits: [], noShows: [], receipts: [], expenses: [] };
    }
    return { ...buildBusinessRnp(source), currency: location.currency ?? '', vertical };
  }
}

/** Гостиница: выручка дня без заезда (продолжение проживания) прибавляется к выручке и прибыли дня и итога */
export function withLoneRevenue(view: ReturnType<typeof buildBusinessRnp>, lone: Array<{ day: string; amountMinor: bigint }>) {
  if (!lone.length) return view;
  const add = (r: { revenueMinor: string; profitMinor: string }, m: bigint) => ({
    ...r,
    revenueMinor: String(BigInt(r.revenueMinor) + m),
    profitMinor: String(BigInt(r.profitMinor) + m),
  });
  const extra = new Map(lone.map((l) => [l.day, l.amountMinor]));
  const days = view.days.map((d) => (extra.has(d.day) ? add(d, extra.get(d.day)!) : d));
  const inMonth = lone.filter((l) => view.days.some((d) => d.day === l.day)).reduce((n, l) => n + l.amountMinor, 0n);
  return { ...view, days, total: add(view.total, inMonth) };
}

/** `GET /business-rnp?month=YYYY-MM`: РНП выбранного филиала (право `reports`) */
@Controller('business-rnp')
@ScopeAware()
export class BusinessRnpController {
  constructor(@Inject(BusinessRnpService) private readonly service: BusinessRnpService) {}
  @Get()
  @Access('reports')
  read(@Query('month') month?: string) {
    return this.service.read(month);
  }
}
