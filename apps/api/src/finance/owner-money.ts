import type { Db } from '@pms/database';
import { projectDailyMoney, type DatedMoneySource } from '../../../../packages/domain/src/owner-summary/daily';
type Scope = { locationId: string; organizationId: string; vertical: string; propertyId: string | null; from: Date; now: Date; fromDate: string; toDate: string; timezone?: string };
const unavailable = (reason: string) => ({ state: 'UNAVAILABLE' as const, reason, currencies: null, daily: { state: 'UNAVAILABLE' as const, reason, currencies: null, days: null } });
/** Called only after location authorization. No singleton property or current-currency fallback. */
export async function readOwnerMoney(db: Db, s: Scope) {
  const summarizeOwnerMoney = (rows: DatedMoneySource[]) => {
    const daily = projectDailyMoney(rows, {...s, timezone:s.timezone ?? 'UTC'});
    const {state, reason, unresolvedSources, currencies} = daily;
    return {state, reason, unresolvedSources, currencies, daily};
  };
  const time = { gte: s.from, lte: s.now };
  if (s.vertical === 'BEAUTY') {
    const rows = await db.appointment.findMany({ where: { locationId: s.locationId, status: 'DONE', startsAt: time, createdAt: { lte: s.now } }, select: { id: true, price: true, currency: true, startsAt: true } });
    const payments = await db.restaurantCashOperation.findMany({ where: { locationId: s.locationId, kind: 'INCOME', status: 'COMPLETED', appointmentId: { not: null }, occurredAt: time }, select: { id: true, amount: true, currency: true, occurredAt: true } });
    return { revenue: summarizeOwnerMoney(rows.map(r => ({sourceType:'APPOINTMENT',sourceId:r.id,amountMinor:r.price,currency:r.currency,occurredAt:r.startsAt}))), receipts: summarizeOwnerMoney(payments.map(r => ({sourceType:'APPOINTMENT_PAYMENT',sourceId:r.id,amountMinor:r.amount,currency:r.currency,occurredAt:r.occurredAt}))) };
  }
  if (s.vertical === 'FOOD_SERVICE') {
    const orders = await db.restaurantOrder.findMany({where:{locationId:s.locationId,status:'CLOSED',closedAt:time},select:{id:true,total:true,currency:true,closedAt:true}});
    const sales = await db.barSale.findMany({where:{locationId:s.locationId,status:'POSTED',createdAt:time},select:{id:true,totalRevenue:true,currency:true,createdAt:true}});
    const payments = await db.restaurantPayment.findMany({where:{locationId:s.locationId,status:'COMPLETED',paidAt:time},select:{id:true,amount:true,currency:true,paidAt:true}});
    const bar = sales.map(r => ({sourceType:'BAR_SALE',sourceId:r.id,amountMinor:r.totalRevenue,currency:r.currency,occurredAt:r.createdAt}));
    return { revenue:summarizeOwnerMoney([...orders.map(r => ({sourceType:'ORDER',sourceId:r.id,amountMinor:r.total,currency:r.currency,occurredAt:r.closedAt!})),...bar]), receipts:summarizeOwnerMoney([...payments.map(r => ({sourceType:'RESTAURANT_PAYMENT',sourceId:r.id,amountMinor:r.amount,currency:r.currency,occurredAt:r.paidAt})),...bar]) };
  }
  if (s.vertical === 'HOSPITALITY' && s.propertyId) {
    const property = { locationId:s.locationId, organizationId:s.organizationId };
    const charges = await db.charge.findMany({where:{voidedAt:null,serviceDate:{gte:new Date(`${s.fromDate}T00:00Z`),lte:new Date(`${s.toDate}T00:00Z`)},createdAt:{lte:s.now},folio:{reservationItem:{reservation:{propertyId:s.propertyId,property}}}},select:{id:true,amount:true,serviceDate:true,folio:{select:{currency:true}}}});
    const payments = await db.payment.findMany({where:{propertyId:s.propertyId,property,status:'COMPLETED',paidAt:time},select:{id:true,amount:true,currency:true,paidAt:true}});
    // §21: manual INCOME is additional to guest payments, never transfers/refunds.
    // Legacy CashOperation has no proven historical currency in the active Prisma schema.
    const cash = await db.$queryRaw<Array<{id:string;amount:bigint;occurredAt:Date;currency:string|null}>>`SELECT c.id,c.amount,c.occurred_at AS "occurredAt", CASE WHEN ${process.env.EXPENSE_LINKS_ENABLED === '1'} THEN to_jsonb(c)->>'currency_snapshot' ELSE NULL END AS currency FROM cash_operations c JOIN properties p ON p.id=c.property_id WHERE c.property_id=${s.propertyId}::uuid AND p.location_id=${s.locationId}::uuid AND p.organization_id=${s.organizationId}::uuid AND c.status='COMPLETED' AND c.kind='INCOME' AND c.occurred_at>=${s.from} AND c.occurred_at<=${s.now}`;
    return { revenue:summarizeOwnerMoney(charges.map(r => ({sourceType:'CHARGE',sourceId:r.id,amountMinor:r.amount,currency:r.folio.currency,serviceDate:r.serviceDate!.toISOString().slice(0,10)}))),receipts:summarizeOwnerMoney([...payments.map(r => ({sourceType:'PAYMENT',sourceId:r.id,amountMinor:r.amount,currency:r.currency,occurredAt:r.paidAt})),...cash.map(r => ({sourceType:'HOTEL_INCOME',sourceId:r.id,amountMinor:r.amount,currency:r.currency,occurredAt:r.occurredAt}))]) };
  }
  return { revenue:unavailable('UNSUPPORTED_SOURCE'),receipts:unavailable('UNSUPPORTED_SOURCE') };
}
