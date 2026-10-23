import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { OwnerSummaryService } from './owner-summary';
import { withSignedInUser } from '../auth/request-context';
const actor = (fn: () => Promise<unknown>, extra = {}) => withSignedInUser({ userId: 'user', organizationId: 'org', role: 'OWNER', scope: 'LOCATION', locationId: 'branch', businessId: 'business', ...extra }, fn);
const location = { id: 'branch', timezone: 'Asia/Almaty', business: { id: 'business', vertical: 'BEAUTY' }, property: null };
type CashWhere = {locationId?:string;kind?:string;status?:string;appointmentId?:null|{not:null};orderId?:null;occurredAt:{gte:Date;lte:Date}};
const fixture = () => {
  const db = { $queryRaw: vi.fn().mockResolvedValue([{id:'hotel-cash',amount:20n,currency:null,occurredAt:new Date()}]), appointment: { findMany: vi.fn().mockResolvedValue([]) }, charge: { findMany: vi.fn().mockResolvedValue([]) }, payment: { findMany: vi.fn().mockResolvedValue([]) }, location: { findFirst: vi.fn().mockResolvedValue(location) }, restaurantCashOperation: { findMany: vi.fn().mockResolvedValue([{ id: 'cash', amount: 40000n, currency: 'KZT' }]) }, cashOperation: { findMany: vi.fn().mockResolvedValue([{ id: 'hotel-cash', amount: 20n }]) } };
  return { db, service: new OwnerSummaryService({ db } as never) };
};
describe('owner summary real cash source', () => {
  it('held settlement guard rejects structurally linked customer refunds', () => {
    const sql = readFileSync('packages/database/prisma/migrations-hold/20261016000114_expense_links/migration.sql','utf8');
    const guard = sql.split('CREATE FUNCTION expense_settlement_guard()')[1]!.split('CREATE TRIGGER expense_settlement_guard')[0];
    expect(guard).toMatch(/appointment_id IS NOT NULL OR order_id IS NOT NULL/);
    expect(guard).toMatch(/RAISE EXCEPTION 'customer refund is not an expense settlement'/);
  });
  it.each(['BEAUTY','FOOD_SERVICE'])('excludes both refund links and VOIDED expenses for %s, current and previous', async vertical => {
    const {db,service} = fixture();
    db.location.findFirst.mockResolvedValue({...location,business:{id:'business',vertical}} as never);
    Object.assign(db,{restaurantOrder:{findMany:vi.fn().mockResolvedValue([])},barSale:{findMany:vi.fn().mockResolvedValue([])},restaurantPayment:{findMany:vi.fn().mockResolvedValue([])}});
    const operations = [
      {id:'expense',amount:40n,kind:'EXPENSE',status:'COMPLETED',appointmentId:null,orderId:null},
      {id:'beauty-refund',amount:9n,kind:'EXPENSE',status:'COMPLETED',appointmentId:'a',orderId:null},
      {id:'food-refund',amount:8n,kind:'EXPENSE',status:'COMPLETED',appointmentId:null,orderId:'o'},
      {id:'void',amount:7n,kind:'EXPENSE',status:'VOIDED',appointmentId:null,orderId:null},
    ];
    db.restaurantCashOperation.findMany.mockImplementation(async ({where}: {where: CashWhere}) => operations.filter(r => r.kind===where.kind && r.status===where.status && (where.appointmentId===undefined || r.appointmentId===where.appointmentId) && (where.orderId===undefined || r.orderId===where.orderId)).map(r=>({...r,currency:'KZT',occurredAt:where.occurredAt.lte})) as never);
    const result = await actor(()=>service.report('today',new Date('2026-10-16T03:00Z'))) as Awaited<ReturnType<typeof service.report>>;
    expect(result.current.paidExpenses.currencies?.[0]?.paidMinor).toBe('40');
    expect(result.previous?.paidExpenses.currencies?.[0]?.paidMinor).toBe('40');
    expect('daily' in result.current.paidExpenses && result.current.paidExpenses.daily.days?.[0]?.currencies).toEqual([{currency:'KZT',amountMinor:'40'}]);
  });
  it('beauty gross ledger keeps currencies and local daily/current/previous cutoffs without refund netting', async () => {
    const {db,service} = fixture();
    const rows = [
      {id:'a',amount:20n,currency:'USD',occurredAt:new Date('2026-10-15T19:30Z')},
      {id:'b',amount:30n,currency:'KZT',occurredAt:new Date('2026-10-16T02:30Z')},
      {id:'previous',amount:11n,currency:'USD',occurredAt:new Date('2026-10-15T02:00Z')},
      {id:'late',amount:999n,currency:'USD',occurredAt:new Date('2026-10-16T04:00Z')},
    ].map(r=>({...r,locationId:'branch',kind:'INCOME',status:'COMPLETED',appointmentId:'appointment',orderId:null}));
    const operations = [...rows,
      {...rows[0]!,id:'void',status:'VOIDED'},
      {...rows[0]!,id:'foreign',locationId:'other'},
      {...rows[0]!,id:'manual',appointmentId:null},
      {...rows[0]!,id:'refund',kind:'EXPENSE',amount:5n},
    ];
    db.restaurantCashOperation.findMany.mockImplementation(async ({where}: {where: CashWhere}) => operations.filter(r=>r.locationId===where.locationId && r.kind===where.kind && r.status===where.status && (where.appointmentId===null ? r.appointmentId===null : where.appointmentId?.not===null ? r.appointmentId!==null : true) && (where.orderId!==null || r.orderId===null) && r.occurredAt>=where.occurredAt.gte && r.occurredAt<=where.occurredAt.lte) as never);
    const result=await actor(()=>service.report('today',new Date('2026-10-16T03:00Z'))) as Awaited<ReturnType<typeof service.report>>;
    expect(result.current.receipts.currencies).toEqual([{currency:'KZT',amountMinor:'30'},{currency:'USD',amountMinor:'20'}]);
    expect(result.previous?.receipts.currencies).toEqual([{currency:'USD',amountMinor:'11'}]);
    expect(result.current.receipts.daily?.days?.[0]).toMatchObject({date:'2026-10-16',currencies:[{currency:'KZT',amountMinor:'30'},{currency:'USD',amountMinor:'20'}]});
    expect(result.current.revenue.currencies).toEqual([]);
  });
  it('feature off never queries absent held tables', async () => {
    const { db, service } = fixture();
    const query = vi.fn(() => { throw new Error('held tables absent'); });
    Object.assign(db, {$queryRaw: query});
    const result = await actor(() => service.report()) as Awaited<ReturnType<typeof service.report>>;
    expect(query).not.toHaveBeenCalled();
    expect(result.classificationState).toBe('UNAVAILABLE');
  });
  it('joins hotel source identity without inventing historical currency', async () => {
    const { db, service } = fixture();
    db.location.findFirst.mockResolvedValue({ ...location, business: {id:'business',vertical:'HOSPITALITY'}, property:{id:'property'} } as never);
    Object.assign(db, {$queryRaw: vi.fn().mockResolvedValueOnce([{id:'hotel-cash',amount:20n,currency:null,occurredAt:new Date()}]).mockResolvedValueOnce([{sourceType:'HOTEL_CASH',sourceId:'hotel-cash',categoryId:'category',categoryName:'Archived'}]).mockResolvedValue([])});
    process.env.EXPENSE_LINKS_ENABLED='1';
    try {
      const result = await actor(() => service.report()) as Awaited<ReturnType<typeof service.report>>;
      expect(result.classificationState).toBe('READY');
      expect(result.classificationReason).toBeNull();
      expect(result.current.paidExpenses.reason).toBe('UNKNOWN_SOURCE_CURRENCY');
      expect(result.current.paidExpenses.currencies).toEqual([]);
    } finally { delete process.env.EXPENSE_LINKS_ENABLED; }
  });
  it('requires a signed-in verified location and never selects the first branch', async () => {
    const { db, service } = fixture();
    await expect(service.report('today')).rejects.toThrow();
    await expect(actor(() => service.report('today'), { locationId: undefined, scope: 'ORGANIZATION' })).rejects.toThrow();
    expect(db.location.findFirst).not.toHaveBeenCalled();
  });
  it('reads only completed branch expense cash within local period, with no budget/receipt addition', async () => {
    const { db, service } = fixture();
    const result = await actor(() => service.report('week', new Date('2026-10-16T03:00:00Z'))) as Awaited<ReturnType<typeof service.report>>;
    expect(result.current.paidExpenses.currencies?.[0]?.paidMinor).toBe('40000');
    expect(result.period.fromUtc).toBe('2026-10-09T19:00:00.000Z');
    expect(result.workload.state).toBe('UNAVAILABLE');
    expect(result.previous?.period).toMatchObject({fromDate:'2026-10-03',toDate:'2026-10-09',toUtc:'2026-10-09T03:00:00.000Z'});
    expect(result.generatedAt).toBe('2026-10-16T03:00:00.000Z');
    expect(db.location.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'branch', business: { organizationId: 'org' } } }));
    expect(db.restaurantCashOperation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { locationId: 'branch', kind: 'EXPENSE', status: 'COMPLETED', appointmentId: null, orderId: null, occurredAt: { gte: new Date('2026-10-09T19:00:00Z'), lte: new Date('2026-10-16T03:00:00Z') } } }));
  });
  it('refuses foreign scope and invalid periods before cash reads', async () => {
    const { db, service } = fixture();
    db.location.findFirst.mockResolvedValueOnce(null);
    await expect(actor(() => service.report('today'))).rejects.toThrow();
    await expect(actor(() => service.report('forever'))).rejects.toThrow();
    expect(db.restaurantCashOperation.findMany).not.toHaveBeenCalled();
  });
  it('does not silently use present property currency for historical hospitality cash', async () => {
    const { db, service } = fixture();
    db.location.findFirst.mockResolvedValue({ ...location, business: { id: 'business', vertical: 'HOSPITALITY' }, property: { id: 'property' } } as never);
    const result = await actor(() => service.report('month')) as Awaited<ReturnType<typeof service.report>>;
    expect(result.current.paidExpenses.reason).toBe('UNKNOWN_SOURCE_CURRENCY');
    expect(result.current.paidExpenses.currencies).toEqual([]);
    expect(db.restaurantCashOperation.findMany).not.toHaveBeenCalled();
  });
  it('«Требуют решения» считаются за сегодня филиала при любом периоде', async () => {
    const { db, service } = fixture();
    Object.assign(db, { barProduct: { findMany: vi.fn().mockResolvedValue([]) }, kitchenProduct: { findMany: vi.fn().mockResolvedValue([]) } });
    const result = await actor(() => service.report('month', new Date('2026-10-16T03:00:00Z'))) as Awaited<ReturnType<typeof service.report>>;
    expect(result.attention).toEqual([{ id: 'all-clear', tone: 'ok', text: 'Срочных дел нет', href: '/today/operations', action: 'Открыть день' }]);
    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { locationId: 'branch', status: 'DONE', startsAt: { gte: new Date('2026-10-15T19:00:00Z'), lt: new Date('2026-10-16T19:00:00Z') } },
    }));
  });
  it('enforces report permission inside the service', async () => {
    const { db, service } = fixture();
    await expect(actor(() => service.report('today'), { role: 'STAFF', scopes: [{ role: 'STAFF', businessId: 'other-business', locationId: null }] })).rejects.toThrow();
    expect(db.restaurantCashOperation.findMany).not.toHaveBeenCalled();
  });
});
