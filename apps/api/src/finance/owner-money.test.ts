import { describe, expect, it, vi } from 'vitest';
import { readOwnerMoney } from './owner-money';
const now = new Date('2026-10-16T03:00Z'), from = new Date('2026-10-15T19:00Z');
const scope = { locationId: 'branch', organizationId: 'org', vertical: 'FOOD_SERVICE', propertyId: null, from, now, fromDate: '2026-10-16', toDate: '2026-10-16' };
const model = (rows: unknown[] = []) => ({ findMany: vi.fn().mockResolvedValue(rows.map(row=>({startsAt:now,closedAt:now,createdAt:now,paidAt:now,occurredAt:now,serviceDate:new Date('2026-10-16T00:00Z'),...(row as object)}))) });
describe('owner source adapters', () => {
 it('keeps CLOSED order revenue, bar sales and payments distinct; no cash duplicate', async () => {
  const db = { restaurantOrder: model([{id:'o',total:100n,currency:'KZT'}]), barSale: model([{id:'b',totalRevenue:30n,currency:'KZT'}]), restaurantPayment: model([{id:'p',amount:40n,currency:'KZT'}]) };
  const r = await readOwnerMoney(db as never, scope);
  expect(r.revenue.currencies?.[0]?.amountMinor).toBe('130');
  expect(r.receipts.currencies?.[0]?.amountMinor).toBe('70');
  expect(db.restaurantOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{locationId:'branch',status:'CLOSED',closedAt:{gte:from,lte:now}}}));
 });
 it('beauty DONE snapshots are revenue, not payments', async () => {
  const db = { appointment: model([{id:'a',price:50n,currency:'USD'}]), restaurantCashOperation: model([{id:'partial',amount:20n,currency:'USD'}]) };
  const r = await readOwnerMoney(db as never, {...scope,vertical:'BEAUTY'});
  expect(r.revenue.currencies).toEqual([{currency:'USD',amountMinor:'50'}]);
  expect(r.receipts.currencies).toEqual([{currency:'USD',amountMinor:'20'}]);
  expect(db.restaurantCashOperation.findMany).toHaveBeenCalledWith({where:{locationId:'branch',kind:'INCOME',status:'COMPLETED',appointmentId:{not:null},occurredAt:{gte:from,lte:now}},select:{id:true,amount:true,currency:true,occurredAt:true}});
 });
 it('hotel uses verified property, service dates and payment dates, with unknown cash explicit', async () => {
  const db = {charge:model([{id:'c',amount:60n,folio:{currency:'USD'}}]),payment:model([{id:'p',amount:20n,currency:'USD'}]),$queryRaw:vi.fn().mockResolvedValue([{id:'cash',amount:5n,currency:null,occurredAt:now}])};
  const r = await readOwnerMoney(db as never,{...scope,vertical:'HOSPITALITY',propertyId:'hotel'});
  expect(r.revenue.currencies).toEqual([{currency:'USD',amountMinor:'60'}]);
  expect(r.receipts.state).toBe('PARTIAL');
  expect(r.receipts.currencies).toEqual([{currency:'USD',amountMinor:'20'}]);
  expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{propertyId:'hotel',property:{locationId:'branch',organizationId:'org'},status:'COMPLETED',paidAt:{gte:from,lte:now}}}));
 });
});
