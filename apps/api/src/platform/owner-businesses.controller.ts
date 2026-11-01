import 'reflect-metadata';
import { Controller, ForbiddenException, Get, Header, Inject, Query, UseInterceptors } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { actorIsPlatformAdmin, currentOrganizationId, currentUserId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { readOwnerAttention } from '../finance/owner-attention';
import { buildOwnerBusinesses, type OwnerBusinessesSource } from '../finance/owner-businesses';
import { MONEY_REPOSITORY, type MoneyRepository } from './money.repository';
import { readDailyRates } from './exchange-rates';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const sixMonths = (month: string) =>
  Array.from({ length: 6 }, (_, i) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(y, m - 1 - (5 - i), 1)).toISOString().slice(0, 7);
  });
/** День операции в поясе филиала: по нему курс Нацбанка (владелец 01.11.2026) и месяц строки */
const dayIn = (at: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/**
 * «Кабинет владельца: все бизнесы», вариант C (владелец 30.10.2026). Человек видит филиалы всех организаций, где он
 * владелец (роль OWNER, действующее членство, организация не приостановлена), и деньги каждого за шесть месяцев:
 * выручка как на Главной (салон: выполненные записи; ресторан: закрытые заказы и продажи бара; гостиница:
 * начисления), расходы кассы филиала. Главному администратору ещё строка WETOP из «Денег» компании (USD).
 *
 * Читает служебной ролью базы: организации разные, а RLS пускает только в организацию сессии (§17.2). Право даёт
 * только членство OWNER этого человека, номер организации из запроса не принимается.
 */
@Access('self')
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('owner')
export class OwnerBusinessesController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MONEY_REPOSITORY) private readonly money: MoneyRepository,
  ) {}

  @Get('businesses')
  @Header('Cache-Control', 'no-store')
  async businesses(@Query('month') rawMonth?: string) {
    const userId = currentUserId();
    if (!userId) throw new ForbiddenException('Войдите в систему');
    const now = new Date();
    const month = typeof rawMonth === 'string' && MONTH.test(rawMonth) ? rawMonth : now.toISOString().slice(0, 7);
    const months = sixMonths(month);
    const db = this.prisma.db;
    const owned = await db.membership.findMany({
      where: { userId, role: 'OWNER', status: 'ACTIVE', organization: { status: { not: 'SUSPENDED' } } },
      select: { organizationId: true, organization: { select: { name: true } } },
    });
    const orgIds = owned.map((o) => o.organizationId);
    const locations = await db.location.findMany({
      where: { status: 'ACTIVE', business: { status: 'ACTIVE', organizationId: { in: orgIds } } },
      orderBy: [{ business: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        property: { select: { id: true } },
        business: { select: { id: true, name: true, vertical: true, organizationId: true } },
      },
    });
    // окно шести месяцев с запасом в сутки на пояс филиала; месяц каждой строки считается в поясе филиала
    const from = new Date(Date.parse(`${months[0]}-01T00:00:00Z`) - 86_400_000);
    const [ny, nm] = month.split('-').map(Number) as [number, number];
    const to = new Date(Date.UTC(ny, nm, 1) + 86_400_000);
    const own = currentOrganizationId();
    const names = new Map(owned.map((o) => [o.organizationId, o.organization.name]));
    const branches: OwnerBusinessesSource['branches'] = [];
    for (const l of locations) {
      const rev = new Map<string, bigint>();
      const exp = new Map<string, bigint>();
      const add = (map: Map<string, bigint>, d: string, v: bigint) => map.set(d, (map.get(d) ?? 0n) + v);
      const v = l.business.vertical;
      if (v === 'BEAUTY') {
        const rows = await db.appointment.findMany({
          where: { locationId: l.id, status: 'DONE', startsAt: { gte: from, lt: to } },
          select: { price: true, startsAt: true },
        });
        for (const r of rows) add(rev, dayIn(r.startsAt, l.timezone), r.price);
      } else if (v === 'FOOD_SERVICE') {
        const [orders, bar] = await Promise.all([
          db.restaurantOrder.findMany({
            where: { locationId: l.id, status: 'CLOSED', closedAt: { gte: from, lt: to } },
            select: { total: true, closedAt: true },
          }),
          db.barSale.findMany({
            where: { locationId: l.id, status: 'POSTED', createdAt: { gte: from, lt: to } },
            select: { totalRevenue: true, createdAt: true },
          }),
        ]);
        for (const r of orders) add(rev, dayIn(r.closedAt!, l.timezone), r.total);
        for (const r of bar) add(rev, dayIn(r.createdAt, l.timezone), r.totalRevenue);
      } else if (v === 'HOSPITALITY' && l.property) {
        const charges = await db.charge.findMany({
          where: {
            voidedAt: null,
            serviceDate: { gte: new Date(`${months[0]}-01T00:00:00Z`), lt: new Date(Date.UTC(ny, nm, 1)) },
            folio: { reservationItem: { reservation: { propertyId: l.property.id } } },
          },
          select: { amount: true, serviceDate: true },
        });
        for (const r of charges) add(rev, r.serviceDate!.toISOString().slice(0, 10), r.amount);
      }
      if (v === 'BEAUTY' || v === 'FOOD_SERVICE') {
        const rows = await db.restaurantCashOperation.findMany({
          where: { locationId: l.id, kind: 'EXPENSE', status: 'COMPLETED', appointmentId: null, orderId: null, occurredAt: { gte: from, lt: to } },
          select: { amount: true, occurredAt: true },
        });
        for (const r of rows) add(exp, dayIn(r.occurredAt, l.timezone), r.amount);
      } else if (v === 'HOSPITALITY' && l.property) {
        const rows = await db.$queryRaw<Array<{ amount: bigint; occurredAt: Date }>>(
          Prisma.sql`SELECT c.amount, c.occurred_at AS "occurredAt" FROM cash_operations c
            WHERE c.property_id = ${l.property.id}::uuid AND c.status = 'COMPLETED' AND c.kind = 'EXPENSE'
              AND c.occurred_at >= ${from} AND c.occurred_at < ${to}`,
        );
        for (const r of rows) add(exp, dayIn(r.occurredAt, l.timezone), r.amount);
      }
      // дела «Требуют решения» сегодня; сбой одного филиала не ломает список
      const attention = await readOwnerAttention(db, {
        locationId: l.id,
        organizationId: l.business.organizationId,
        businessId: l.business.id,
        vertical: v,
        timezone: l.timezone,
        propertyId: l.property?.id ?? null,
        now,
      })
        .then((items) => items.filter((i) => i.tone === 'warn').length)
        .catch(() => 0);
      branches.push({
        organizationId: l.business.organizationId,
        organizationName: names.get(l.business.organizationId) ?? '',
        current: l.business.organizationId === own,
        businessName: l.business.name,
        vertical: v,
        locationId: l.id,
        locationName: l.name,
        currency: l.currency,
        days: [...new Set([...rev.keys(), ...exp.keys()])]
          .filter((d) => months.includes(d.slice(0, 7)))
          .sort()
          .map((d) => ({ date: d, revenueMinor: rev.get(d) ?? 0n, expensesMinor: exp.get(d) ?? 0n })),
        attention,
      });
    }
    let platform: OwnerBusinessesSource['platform'] = null;
    if (actorIsPlatformAdmin() && (await this.money.ready())) {
      const src = await this.money.source();
      const byDay = new Map<string, { revenueMinor: bigint; expensesMinor: bigint }>();
      const put = (day: string, rev: bigint, exp: bigint) => {
        if (!months.includes(day.slice(0, 7))) return;
        const d = byDay.get(day) ?? { revenueMinor: 0n, expensesMinor: 0n };
        d.revenueMinor += rev;
        d.expensesMinor += exp;
        byDay.set(day, d);
      };
      for (const p of src.payments) if (!p.voided) put(p.paidOn, p.amountCents, 0n);
      for (const e of src.expenses) if (!e.voided) put(e.spentOn, 0n, e.amountCents);
      platform = { days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d })) };
    }
    // всё в валюте компании текущей сессии по курсу Нацбанка РК на день операции (владелец 01.11.2026)
    const company = own
      ? (await db.organization.findUnique({ where: { id: own }, select: { reportingCurrency: true } }))?.reportingCurrency
      : null;
    const currency = company ?? 'KZT';
    const rates = await readDailyRates(
      db,
      [currency, ...branches.map((b) => b.currency), ...(platform ? ['USD'] : [])],
      `${months[0]}-01`,
      now.toISOString().slice(0, 10),
    );
    return buildOwnerBusinesses({ month, months, branches, platform, fx: rates ? { currency, rates } : null });
  }
}
