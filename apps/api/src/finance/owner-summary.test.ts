import { describe, expect, it, vi } from 'vitest';
import { OwnerSummaryService } from './owner-summary';
import { withSignedInUser } from '../auth/request-context';
const actor = (fn: () => Promise<unknown>, extra = {}) => withSignedInUser({ userId: 'user', organizationId: 'org', role: 'OWNER', scope: 'LOCATION', locationId: 'branch', businessId: 'business', ...extra }, fn);
const location = { id: 'branch', timezone: 'Asia/Almaty', business: { id: 'business', vertical: 'BEAUTY' }, property: null };
const fixture = () => {
  const db = { $queryRaw: vi.fn().mockResolvedValue([{id:'hotel-cash',amount:20n,currency:null,occurredAt:new Date()}]), appointment: { findMany: vi.fn().mockResolvedValue([]) }, charge: { findMany: vi.fn().mockResolvedValue([]) }, payment: { findMany: vi.fn().mockResolvedValue([]) }, location: { findFirst: vi.fn().mockResolvedValue(location) }, restaurantCashOperation: { findMany: vi.fn().mockResolvedValue([{ id: 'cash', amount: 40000n, currency: 'KZT' }]) }, cashOperation: { findMany: vi.fn().mockResolvedValue([{ id: 'hotel-cash', amount: 20n }]) } };
  return { db, service: new OwnerSummaryService({ db } as never) };
};
describe('owner summary real cash source', () => {
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
    expect(db.restaurantCashOperation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { locationId: 'branch', kind: 'EXPENSE', status: 'COMPLETED', occurredAt: { gte: new Date('2026-10-09T19:00:00Z'), lte: new Date('2026-10-16T03:00:00Z') } } }));
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
  it('enforces report permission inside the service', async () => {
    const { db, service } = fixture();
    await expect(actor(() => service.report('today'), { role: 'STAFF', scopes: [{ role: 'STAFF', businessId: 'other-business', locationId: null }] })).rejects.toThrow();
    expect(db.restaurantCashOperation.findMany).not.toHaveBeenCalled();
  });
});
