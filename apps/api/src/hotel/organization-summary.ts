import { filterBeautyLocations } from '../beauty/access';
import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@pms/database';
import { isIsoDate, timeOffWindow, canAt, visibleLocations } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import {
  currentOrganizationId,
  currentRole,
  currentAssignments,
  hasSignedInActor,
} from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';
type Currency = {
  currency: string;
  receiptsMinor: string;
  /** оплаты заказов без продаж бара (ADR-182): основа среднего чека */
  paidMinor?: string;
  expensesMinor: string;
  orders: number;
  averageMinor: string | null;
};
type PaidOrders = { currency: string; orders: bigint; allocated: bigint; orderIds?: string[] };
@Injectable()
export class OrganizationSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async report(from: string, to: string) {
    const organizationId = currentOrganizationId();
    if (!organizationId || !hasSignedInActor())
      throw new ForbiddenException('Войдите в организацию');
    if (
      !isIsoDate(from) ||
      !isIsoDate(to) ||
      from > to ||
      (Date.parse(to) - Date.parse(from)) / 86400000 > 92
    )
      throw new BadRequestException('Выберите период до 93 дней');
    // Include retained history: archiving a location must not remove its past money from reports.
    const locations = await this.prisma.db.location.findMany({
      where: { business: { organizationId } },
      select: {
        id: true,
        name: true,
        currency: true,
        timezone: true,
        business: { select: { id: true, vertical: true } },
        property: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
    const role = currentRole() ?? 'STAFF',
      assignments = currentAssignments();
    const visible = new Set(
      visibleLocations(
        role,
        assignments,
        locations.map((l) => ({ id: l.id, businessId: l.business.id })),
      ).map((l) => l.id),
    );
    const permitted = new Set((await filterBeautyLocations(this.prisma.db, locations.map(location=>({id:location.id,businessId:location.business.id,vertical:location.business.vertical})),{section:'finance',action:'view'})).map(row=>row.id));
    const rows: Array<{
      id: string;
      businessId: string;
      name: string;
      state: 'READY' | 'UNAVAILABLE' | 'ERROR';
      currencies: Currency[];
      orders: number;
    }> = [];
    const allOrders = new Set<string>();
    for (const l of locations.filter(
      (l) =>
        visible.has(l.id) && permitted.has(l.id) &&
        canAt(role, assignments, 'reports', { businessId: l.business.id, locationId: l.id }),
    )) {
      if (
        l.business.vertical === 'BEAUTY' ||
        (l.business.vertical === 'HOSPITALITY' && !l.property)
      ) {
        rows.push({
          id: l.id,
          businessId: l.business.id,
          name: l.name,
          state: 'UNAVAILABLE',
          currencies: [],
          orders: 0,
        });
        continue;
      }
      try {
        const window = timeOffWindow({ dateFrom: from, dateTo: to, timezone: l.timezone });
        const paidAt = { gte: window.fromUtc, lt: window.toUtcExclusive };
        let payments: Array<{ currency: string; _sum: { amount: bigint | null } }>;
        let paidOrders: PaidOrders[];
        const expenses = new Map<string, bigint>();
        const barReceipts = new Map<string, bigint>();
        if (l.business.vertical === 'HOSPITALITY' && l.property) {
          const propertyId = l.property.id;
          const groupedPayments = await this.prisma.db.payment.groupBy({
            by: ['currency'],
            where: { propertyId, status: 'COMPLETED', paidAt },
            _sum: { amount: true },
          });
          payments = groupedPayments;
          const expense = await this.prisma.db.cashOperation.aggregate({
            where: { propertyId, status: 'COMPLETED', kind: 'EXPENSE', occurredAt: paidAt },
            _sum: { amount: true },
          });
          expenses.set(l.currency, expense._sum.amount ?? 0n);
          paidOrders = await this.prisma.db.$queryRaw<PaidOrders[]>(
            Prisma.sql`SELECT p.currency, COUNT(DISTINCT ri.reservation_id)::bigint AS orders, COALESCE(SUM(pa.amount),0)::bigint AS allocated, ARRAY_AGG(DISTINCT ri.reservation_id::text) AS "orderIds" FROM payments p JOIN payment_allocations pa ON pa.payment_id=p.id JOIN folios f ON f.id=pa.folio_id JOIN reservation_items ri ON ri.id=f.reservation_item_id WHERE p.property_id=${propertyId}::uuid AND p.status='COMPLETED' AND p.paid_at>=${window.fromUtc} AND p.paid_at<${window.toUtcExclusive} GROUP BY p.currency`,
          );
        } else {
          const groupedPayments = await this.prisma.db.restaurantPayment.groupBy({
            by: ['currency'],
            where: { locationId: l.id, status: 'COMPLETED', paidAt },
            _sum: { amount: true },
          });
          payments = groupedPayments;
          // продажи бара: деньги пришли в кассу при продаже, но restaurant_payments не создаются;
          // без них поступления занижены, при том что оплаты поставщикам бара в расходах уже есть (ADR-182)
          const barSales = await this.prisma.db.barSale.groupBy({
            by: ['currency'],
            where: { locationId: l.id, status: 'POSTED', createdAt: paidAt },
            _sum: { totalRevenue: true },
          });
          for (const b of barSales) barReceipts.set(b.currency, b._sum.totalRevenue ?? 0n);
          const cost = await this.prisma.db.restaurantCashOperation.groupBy({
            by: ['currency'],
            where: { locationId: l.id, status: 'COMPLETED', kind: 'EXPENSE', occurredAt: paidAt },
            _sum: { amount: true },
          });
          for (const c of cost) expenses.set(c.currency, c._sum.amount ?? 0n);
          paidOrders = await this.prisma.db.$queryRaw<PaidOrders[]>(
            Prisma.sql`SELECT currency, COUNT(DISTINCT order_id)::bigint AS orders, COALESCE(SUM(amount),0)::bigint AS allocated, ARRAY_AGG(DISTINCT order_id::text) AS "orderIds" FROM restaurant_payments WHERE location_id=${l.id}::uuid AND status='COMPLETED' AND paid_at>=${window.fromUtc} AND paid_at<${window.toUtcExclusive} GROUP BY currency`,
          );
        }
        const orderIds = new Set(paidOrders.flatMap((p) => p.orderIds ?? []));
        for (const id of orderIds) allOrders.add(`${l.business.vertical}:${id}`);
        const currencies = new Set([
          ...payments.map((p) => p.currency),
          ...expenses.keys(),
          ...barReceipts.keys(),
        ]);
        if (!currencies.size) currencies.add(l.currency);
        const values = [...currencies].map((currency) => {
          const paid = payments.find((p) => p.currency === currency)?._sum.amount ?? 0n;
          // поступления = оплаты заказов (или гостиничные payments) + продажи бара; средний чек
          // по-прежнему от оплат заказов, бар в него не входит (ADR-182)
          const receipt = paid + (barReceipts.get(currency) ?? 0n);
          const orders = paidOrders.find((p) => p.currency === currency);
          const count = Number(orders?.orders ?? 0n);
          return {
            currency,
            receiptsMinor: receipt.toString(),
            // оплаты заказов без бара: из них считается средний чек, в том числе итоговый
            paidMinor: paid.toString(),
            expensesMinor: (expenses.get(currency) ?? 0n).toString(),
            orders: count,
            averageMinor:
              count > 0 && orders?.allocated === paid ? (paid / BigInt(count)).toString() : null,
          };
        });
        rows.push({
          id: l.id,
          businessId: l.business.id,
          name: l.name,
          state: 'READY',
          currencies: values,
          orders: orderIds.size,
        });
      } catch {
        rows.push({
          id: l.id,
          businessId: l.business.id,
          name: l.name,
          state: 'ERROR',
          currencies: [],
          orders: 0,
        });
      }
    }
    const totals = new Map<
      string,
      { received: bigint; paid: bigint; expenses: bigint; orders: number; averageKnown: boolean }
    >();
    for (const row of rows.filter((r) => r.state === 'READY'))
      for (const c of row.currencies) {
        const total = totals.get(c.currency) ?? {
          received: 0n,
          paid: 0n,
          expenses: 0n,
          orders: 0,
          averageKnown: true,
        };
        const paid = BigInt(c.paidMinor ?? c.receiptsMinor);
        total.received += BigInt(c.receiptsMinor);
        total.paid += paid;
        total.expenses += BigInt(c.expensesMinor);
        total.orders += c.orders;
        // средний чек считается из оплат заказов (ADR-182): бар поступления растит, а чек нет
        total.averageKnown =
          total.averageKnown && (c.orders === 0 ? paid === 0n : c.averageMinor !== null);
        totals.set(c.currency, total);
      }
    return {
      from,
      to,
      complete: rows.every((r) => r.state === 'READY'),
      covered: rows.filter((r) => r.state === 'READY').length,
      total: rows.length,
      orders: allOrders.size,
      rows,
      currencies: [...totals].map(([currency, t]) => ({
        currency,
        receiptsMinor: t.received.toString(),
        expensesMinor: t.expenses.toString(),
        orders: t.orders,
        averageMinor: t.orders && t.averageKnown ? (t.paid / BigInt(t.orders)).toString() : null,
      })),
    };
  }
}
@Controller('branches')
@ScopeAware()
export class OrganizationSummaryController {
  constructor(
    @Inject(OrganizationSummaryService) private readonly service: OrganizationSummaryService,
  ) {}
  @Access('reports') @Get('summary') report(@Query('from') from: string, @Query('to') to: string) {
    return this.service.report(from, to);
  }
}
