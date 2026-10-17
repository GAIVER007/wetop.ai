import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import type { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const prisma = { db } as PrismaService;
const portal = new EmployeePortalService(prisma, null);
// payroll never uses stock or image storage; exercise the actual legacy service, not a mock oracle.
const legacy = new RestaurantService(prisma, null, {} as StockService);
const month = '2026-09';
const period = new Date(`${month}-01T00:00:00Z`);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const as = <T>(actor: 'ownerA' | 'staffA', locationId: string | null, run: () => Promise<T>) =>
  withSignedInUser({ ...f.actors[actor], ...(locationId ? { scope: 'LOCATION' as const, locationId } : {}) }, run);

describe('Food portal payroll uses an authorized viewing branch, not invented UTC money', () => {
  beforeAll(async () => {
    f = await seedPortalFixture(db, 'FOOD_SERVICE');
    await db.location.update({ where: { id: f.locationA }, data: { timezone: 'Asia/Almaty', currency: 'USD' } });
    await db.location.update({ where: { id: f.locationB }, data: { timezone: 'America/New_York', currency: 'USD' } });
    // Existing stored terms intentionally retain KZT: AVAILABLE must label like the manager's selected branch.
    const orders = [
      [f.locationA, '2026-08-31T18:59:59.999Z', 900000n], // before local start
      [f.locationA, '2026-08-31T19:00:00.000Z', 10001n], // local start inclusive, before UTC September
      [f.locationB, '2026-09-15T12:00:00.000Z', 20002n], // second business branch
      [f.locationA, '2026-09-30T18:59:59.999Z', 30003n], // just before local end
      [f.locationA, '2026-09-30T19:00:00.000Z', 800000n], // local end exclusive, still UTC September
    ] as const;
    for (const [index, [locationId, closedAt, total]] of orders.entries()) {
      await db.restaurantOrder.create({ data: { locationId, number: 100 + index, waiterId: f.employeeA,
        status: 'CLOSED', total, currency: 'USD', openedAt: new Date('2026-08-01T12:00:00Z'),
        closedAt: new Date(closedAt), createdById: f.actors.ownerA.id } });
    }
    await db.restaurantOrder.create({ data: { locationId: f.locationA, number: 200, waiterId: f.employeeB,
      status: 'CLOSED', total: 700000n, currency: 'USD', closedAt: new Date('2026-09-15T12:00:00Z') } });
    for (const [amountMinor, reason] of [[777n, 'September bonus'], [-222n, 'September penalty']] as const) {
      await db.employeePayAdjustment.create({ data: { employeeId: f.employeeA, period, amountMinor, reason, createdById: f.actors.ownerA.id } });
    }
    for (const [locationId, amount] of [[f.locationA, 1000n], [f.locationB, 2000n]] as const) {
      await db.restaurantCashOperation.create({ data: { locationId, employeeId: f.employeeA, period,
        kind: 'EXPENSE', method: 'CASH', amount, currency: 'USD', status: 'COMPLETED', createdById: f.actors.ownerA.id } });
    }
  });
  afterAll(async () => { await db.$disconnect(); });

  for (const actor of ['staffA', 'ownerA'] as const) {
    it(`${actor}: branchless multi-assigned Food keeps profile and terms but no money totals`, async () => {
      const dto = await as(actor, null, () => portal.get(actor === 'staffA' ? null : f.employeeA, { month }));
      expect(dto.location).toBeNull();
      expect(dto.employee.id).toBe(f.employeeA);
      expect(dto.profile.slug).toBeTruthy();
      expect(dto.pay.status).toBe('SELECT_LOCATION');
      expect(dto.pay).toMatchObject({ model: 'FIXED_PLUS_PERCENT', fixedMinor: '150000', percent: 15,
        currency: 'KZT', earnedMinor: null, remainingMinor: null, paidMinor: null, bonusMinor: null, penaltyMinor: null,
        adjustments: [], percentBasis: null, policyRevision: null });
      expect(dto.pay.explanation).toMatch(/Выберите филиал/);
    });
  }

  it('branchless self profile remains editable without fabricating a pay calculation', async () => {
    const before = await as('staffA', null, () => portal.get(null, { month }));
    const after = await as('staffA', null, () => portal.mutate(null, 'profile', {
      headline: 'Synthetic branchless waiter', expectedRevision: before.profile.revision, expectedProfileRevision: before.employee.profileRevision,
    }));
    expect(after.profile.headline).toBe('Synthetic branchless waiter');
    expect(after.pay.status).toBe('SELECT_LOCATION');
    expect(after.pay.earnedMinor).toBeNull();
  });

  it('matches actual manager payroll for the same employee/month in each viewing timezone and every legacy model', async () => {
    for (const model of ['FIXED_PLUS_PERCENT', 'FIXED', 'PERCENT', 'BONUS_ONLY'] as const) {
      await db.employeePaySetting.update({ where: { employeeId: f.employeeA }, data: { model } });
      for (const locationId of [f.locationA, f.locationB]) {
        const manager = await as('ownerA', locationId, () => legacy.payroll({ month }));
        const row = manager.rows.find(r => r.employeeId === f.employeeA)!;
        const dto = await as('staffA', locationId, () => portal.get(null, { month }));
        expect(dto.location?.id).toBe(locationId);
        expect(dto.pay).toMatchObject({ status: 'AVAILABLE', month, model,
          fixedMinor: row.fixedMinor, percent: row.percent,
          earnedMinor: row.totalMinor, remainingMinor: row.remainingMinor,
          bonusMinor: row.bonusMinor, penaltyMinor: row.penaltyMinor, paidMinor: row.paidMinor });
        expect(row.paidMinor).toBe('3000');
        expect(row.bonusMinor).toBe('777');
        expect(row.penaltyMinor).toBe('-222');
        if (locationId === f.locationA) expect(row.salesMinor).toBe('60006');
        expect(dto.pay.adjustments.map(a => a.amountMinor).sort()).toEqual(['-222', '777']);
        expect(dto.pay.currency).toBe(manager.currency);
        expect(dto.pay.currency).toBe('USD');
      }
    }
  });

  it('without stored settings, selected-branch amounts still match the existing manager default', async () => {
    await db.employeePaySetting.delete({ where: { employeeId: f.employeeA } });
    const manager = await as('ownerA', f.locationA, () => legacy.payroll({ month }));
    const row = manager.rows.find(r => r.employeeId === f.employeeA)!;
    const dto = await as('staffA', f.locationA, () => portal.get(null, { month }));
    expect(dto.pay).toMatchObject({ status: 'AVAILABLE', currency: manager.currency,
      earnedMinor: row.totalMinor, remainingMinor: row.remainingMinor, paidMinor: row.paidMinor });
    const branchless = await as('staffA', null, () => portal.get(null, { month }));
    expect(branchless.pay).toMatchObject({ status: 'SELECT_LOCATION', model: null, fixedMinor: null,
      percent: null, earnedMinor: null, paidMinor: null, remainingMinor: null, bonusMinor: null, penaltyMinor: null, adjustments: [] });
  });

  it('finance UI distinguishes branch selection from unsupported Beauty policy', () => {
    const ui = readFileSync('apps/web/src/components/employee-portal/cabinet.tsx', 'utf8');
    expect(ui).toContain("data.pay.status==='SELECT_LOCATION'");
    expect(ui).toContain('Выберите филиал в общем переключателе филиалов');
    expect(ui).toContain('Автоматический расчёт для салона пока недоступен');
  });
});
