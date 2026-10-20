import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const beauty = new BeautyScheduleService({ db } as never);
const food = new RestaurantService({ db } as never, null, null as never);
const portal = new EmployeePortalService({ db } as never, null);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const run = <T>(fn: () => Promise<T>, vertical: 'BEAUTY' | 'FOOD_SERVICE' = 'BEAUTY') => withSignedInUser({ ...f.actors.ownerA, vertical, scope: 'LOCATION', locationId: f.locationA }, fn);
const hours = [{ weekday: 1, timeFrom: '09:00', timeTo: '12:00' }, { weekday: 1, timeFrom: '14:00', timeTo: '18:00' }];
const stored = () => db.workingHours.findMany({ where: { employeeId: f.employeeA }, orderBy: { id: 'asc' } });

describe('TZ2.1 D real PostgreSQL consumers and CAS', () => {
  beforeAll(async () => { f = await seedPortalFixture(db); });
  afterAll(async () => { vi.useRealTimers(); await db.$disconnect(); });
  it('Beauty missing original version is refused without changing rows', async () => {
    const before = await stored();
    await expect(run(() => beauty.setWorkingHours(f.employeeA, { intervals: hours }))).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });
  it('Beauty two writers with the same original version yield one success and unchanged refused write', async () => {
    const state = await run(() => beauty.overview(f.employeeA));
    const results = await Promise.allSettled([hours, []].map(intervals => run(() => beauty.setWorkingHours(f.employeeA, { intervals, expectedRevision: state.weekRevision }))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const before = await stored();
    await expect(run(() => beauty.setWorkingHours(f.employeeA, { intervals: hours, expectedRevision: state.weekRevision }))).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });
  it('portal and Beauty expose one source revision and reject a stale cross-writer save', async () => {
    const a = await run(() => beauty.overview(f.employeeA));
    const b = await run(() => portal.get(f.employeeA, {}));
    expect(b.weekRevision).toBe(a.weekRevision);
    const original = await stored();
    await expect(run(() => portal.mutate(f.employeeA, 'week', { intervals: hours }))).rejects.toThrow();
    expect(await stored()).toEqual(original);
    await run(() => portal.mutate(f.employeeA, 'week', { intervals: hours, expectedRevision: b.weekRevision }));
    const before = await stored();
    await expect(run(() => beauty.setWorkingHours(f.employeeA, { intervals: [], expectedRevision: a.weekRevision }))).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });
  for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
    const read = async () => vertical === 'BEAUTY'
      ? run(() => beauty.overview(f.employeeA), vertical)
      : { ...(await run(() => food.shifts(), vertical)).employees.find(e => e.id === f.employeeA)! };
    const save = (intervals: typeof hours, expectedRevision: string | null) => run(() => vertical === 'BEAUTY'
      ? beauty.setWorkingHours(f.employeeA, { intervals, expectedRevision })
      : food.setShifts(f.employeeA, { intervals, expectedRevision }), vertical);
    it(`${vertical}: two empty saves from one empty source accept exactly one`, async () => {
      await db.business.update({ where: { id: f.businessA }, data: { vertical } });
      await save([], (await read()).weekRevision);
      const original = (await read()).weekRevision;
      expect((await run(() => portal.get(f.employeeA, {}), vertical)).weekRevision).toBe(original);
      const results = await Promise.allSettled([save([], original), save([], original)]);
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
      expect((await read()).weekRevision).not.toBe(original);
      expect(await stored()).toEqual([]);
    });
    it(`${vertical}: empty -> populated -> empty cannot resurrect the original token`, async () => {
      await db.business.update({ where: { id: f.businessA }, data: { vertical } });
      await save([], (await read()).weekRevision);
      const original = (await read()).weekRevision;
      const populated = await save(hours, original);
      const cleared = await save([], populated.weekRevision);
      expect(cleared.weekRevision).not.toBe(original);
      await expect(save(hours, original)).rejects.toThrow();
      expect(await stored()).toEqual([]);
    });
    it(`${vertical}: portal response is its committed week, not a post-commit writer token`, async () => {
      await db.business.update({ where: { id: f.businessA }, data: { vertical } });
      const original = await run(() => portal.get(f.employeeA, {}), vertical);
      const realGet = portal.get.bind(portal);
      let writerRevision: string | null = null;
      // mutate calls get only after COMMIT: inject a real second PostgreSQL writer
      // at that exact seam, before the response read, without timing or sleeps.
      const seam = vi.spyOn(portal, 'get').mockImplementationOnce(async (employeeId, query) => {
        const committed = await run(() => realGet(employeeId, query), vertical);
        writerRevision = (await save([], committed.weekRevision)).weekRevision;
        return run(() => realGet(employeeId, query), vertical);
      });
      try {
        const response = await run(() => portal.mutate(f.employeeA, 'week', { intervals: hours, expectedRevision: original.weekRevision }), vertical);
        expect(seam).toHaveBeenCalledTimes(1);
        expect(response.week.filter(d => d.intervals.length).length).toBe(1);
        expect(response.weekRevision).not.toBe(writerRevision);
        await expect(run(() => portal.mutate(f.employeeA, 'week', { intervals: hours, expectedRevision: response.weekRevision }), vertical)).rejects.toThrow();
        expect(await stored()).toEqual([]);
      } finally { seam.mockRestore(); }
    });
  }
  it('absence counts branch-local dates and preserves existing accepted appointment IDs', async () => {
    await db.business.update({ where: { id: f.businessA }, data: { vertical: 'BEAUTY' } });
    await db.location.update({ where: { id: f.locationB }, data: { timezone: 'Pacific/Honolulu' } });
    const customer = await db.customer.create({ data: { organizationId: f.organizationA, firstName: 'Synthetic D customer' } });
    const ids: string[] = [];
    for (const [locationId, startsAt] of [[f.locationA, '2035-01-08T05:00Z'], [f.locationB, '2035-01-09T05:00Z']] as const) {
      ids.push((await db.appointment.create({ data: { locationId, employeeId: f.employeeA, serviceId: f.serviceId!, customerId: customer.id, startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 1800000), price: 100n, currency: 'KZT', status: 'CONFIRMED' } })).id);
    }
    const before = await db.appointment.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    const saved = await run(() => beauty.addTimeOff(f.employeeA, { dateFrom: '2035-01-08', dateTo: '2035-01-08' }));
    expect(saved.affected).toBe(2);
    expect(saved.timeOffs.find(t => t.dateFrom === '2035-01-08')?.appointments).toBe(2);
    const state = await run(() => beauty.overview(f.employeeA));
    await run(() => beauty.setWorkingHours(f.employeeA, { intervals: [], expectedRevision: state.weekRevision }));
    expect(await db.appointment.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })).toEqual(before);
  });
  it('Food missing revision is refused, two writers cannot overwrite one original week', async () => {
    await db.business.update({ where: { id: f.businessA }, data: { vertical: 'FOOD_SERVICE' } });
    const before = await stored();
    await expect(run(() => food.setShifts(f.employeeA, { intervals: hours }), 'FOOD_SERVICE')).rejects.toThrow();
    expect(await stored()).toEqual(before);
    const state = await run(() => food.shifts(), 'FOOD_SERVICE');
    const revision = state.employees.find(e => e.id === f.employeeA)!.weekRevision;
    expect(revision).toMatch(/^[a-f0-9]{64}$/);
    const results = await Promise.allSettled([hours, []].map(intervals => run(() => food.setShifts(f.employeeA, { intervals, expectedRevision: revision }), 'FOOD_SERVICE')));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const after = await stored();
    await expect(run(() => food.setShifts(f.employeeA, { intervals: [], expectedRevision: revision }), 'FOOD_SERVICE')).rejects.toThrow();
    expect(await stored()).toEqual(after);
  });
  it('Food real employee consumer uses both intervals, absence, assignment and status', async () => {
    await db.timeOff.deleteMany({ where: { employeeId: f.employeeA } });
    await db.location.update({ where: { id: f.locationA }, data: { timezone: 'UTC' } });
    const state = await run(() => food.shifts(), 'FOOD_SERVICE');
    await run(() => food.setShifts(f.employeeA, { intervals: [...hours].reverse(), expectedRevision: state.employees.find(e => e.id === f.employeeA)!.weekRevision }), 'FOOD_SERVICE');
    const onShift = async () => (await run(() => food.employees({}), 'FOOD_SERVICE')).items.find(e => e.id === f.employeeA)!.onShift;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2035-01-08T15:00Z')); expect(await onShift()).toBe(true);
    vi.setSystemTime(new Date('2035-01-08T13:00Z')); expect(await onShift()).toBe(false);
    vi.setSystemTime(new Date('2035-01-08T15:00Z'));
    await db.timeOff.create({ data: { employeeId: f.employeeA, dateFrom: new Date('2035-01-08Z'), dateTo: new Date('2035-01-08Z') } });
    expect(await onShift()).toBe(false);
    await db.timeOff.deleteMany({ where: { employeeId: f.employeeA } });
    await db.employee.update({ where: { id: f.employeeA }, data: { status: 'ARCHIVED' } }); expect(await onShift()).toBe(false);
    await db.employee.update({ where: { id: f.employeeA }, data: { status: 'ACTIVE' } });
    await db.employeeLocation.deleteMany({ where: { employeeId: f.employeeA, locationId: f.locationA } }); expect(await onShift()).toBe(false);
    vi.useRealTimers();
  });
});
