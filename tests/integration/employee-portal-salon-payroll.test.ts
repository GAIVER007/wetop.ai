import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import type { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

/**
 * S1 (владелец 21.10.2026): мастер салона видит в кабинете ту же сумму, что руководитель в «Зарплате» (/payroll):
 * выполненные строки записей мастера за месяц × условия + корректировки − выплаты. Вымышленные данные.
 */
const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const prisma = { db } as PrismaService;
const portal = new EmployeePortalService(prisma, null);
const legacy = new RestaurantService(prisma, null, {} as StockService);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
let month = '';
const as = <T>(actor: 'ownerA' | 'staffA' | 'staffB' | 'ownerB', locationId: string | null, run: () => Promise<T>) =>
  withSignedInUser({ ...f.actors[actor], ...(locationId ? { scope: 'LOCATION' as const, locationId } : {}) }, run);

describe('кабинет мастера: зарплата салона как в /payroll руководителя', () => {
  beforeAll(async () => {
    f = await seedPortalFixture(db, 'BEAUTY');
    month = f.month;
    const period = new Date(`${month}-01T00:00:00Z`);
    await db.employeePaySetting.create({ data: { employeeId: f.employeeA, model: 'FIXED_PLUS_PERCENT', fixedMinor: 100000n, percent: 20, currency: 'KZT', updatedById: f.actors.ownerA.id } });
    await db.employeePaySetting.create({ data: { employeeId: f.employeeB, model: 'PERCENT', fixedMinor: 0n, percent: 50, currency: 'KZT', updatedById: f.actors.ownerA.id } });
    await db.employeePayAdjustment.create({ data: { employeeId: f.employeeA, period, amountMinor: 3000n, reason: 'Synthetic bonus', createdById: f.actors.ownerA.id } });
    await db.employeePayAdjustment.create({ data: { employeeId: f.employeeA, period, amountMinor: -500n, reason: 'Synthetic penalty', createdById: f.actors.ownerA.id } });
    await db.employeePayAdjustment.create({ data: { employeeId: f.employeeB, period, amountMinor: 99000n, reason: 'Other master bonus', createdById: f.actors.ownerA.id } });
    await db.restaurantCashOperation.create({ data: { locationId: f.locationB, kind: 'EXPENSE', method: 'CASH', amount: 7000n, currency: 'KZT', employeeId: f.employeeA, period, createdById: f.actors.ownerA.id } });
  });
  afterAll(async () => { await db.$disconnect(); });

  it('сумма, бонусы, удержания, выплачено и остаток совпадают со строкой мастера в /payroll', async () => {
    for (const locationId of [f.locationA, f.locationB]) {
      const manager = await as('ownerA', locationId, () => legacy.payroll({ month }));
      const row = manager.rows.find((r) => r.employeeId === f.employeeA)!;
      expect(row.salesMinor).toBe('6500');
      const dto = await as('staffA', locationId, () => portal.get(null, { month }));
      expect(dto.pay).toMatchObject({
        status: 'AVAILABLE', month, currency: manager.currency, model: row.model, fixedMinor: row.fixedMinor, percent: row.percent,
        earnedMinor: row.totalMinor, bonusMinor: row.bonusMinor, penaltyMinor: row.penaltyMinor,
        paidMinor: row.paidMinor, remainingMinor: row.remainingMinor,
      });
      expect(dto.pay.earnedMinor).toBe(String(100000 + 1300 + 3000 - 500));
      expect(dto.pay.remainingMinor).toBe(String(100000 + 1300 + 3000 - 500 - 7000));
      expect(dto.pay.adjustments.map((a) => a.reason).sort()).toEqual(['Synthetic bonus', 'Synthetic penalty']);
    }
  });

  it('выбранная руководителем база процента не прячет сумму: кабинет и /payroll совпадают', async () => {
    await as('ownerA', f.locationA, () => portal.setPolicy({ percentBasis: 'PAID_COMPLETED_SERVICES' }));
    const manager = await as('ownerA', f.locationA, () => legacy.payroll({ month }));
    const row = manager.rows.find((r) => r.employeeId === f.employeeA)!;
    const dto = await as('staffA', f.locationA, () => portal.get(null, { month }));
    expect(dto.pay.status).toBe('AVAILABLE');
    expect(dto.pay.earnedMinor).toBe(row.totalMinor);
    expect(dto.pay.explanation).not.toMatch(/пока недоступен/);
  });

  it('чужие данные не видны: второй мастер видит своё, а чужой кабинет закрыт', async () => {
    const own = await as('staffA', f.locationA, () => portal.get(null, { month }));
    expect(JSON.stringify(own.pay)).not.toContain('Other master bonus');
    const other = await as('staffB', f.locationA, () => portal.get(null, { month }));
    const manager = await as('ownerA', f.locationA, () => legacy.payroll({ month }));
    const rowB = manager.rows.find((r) => r.employeeId === f.employeeB)!;
    expect(other.employee.id).toBe(f.employeeB);
    expect(other.pay.earnedMinor).toBe(rowB.totalMinor);
    expect(other.pay.earnedMinor).toBe(String(3250 + 99000));
    await expect(as('staffA', f.locationA, () => portal.get(f.employeeB, { month }))).rejects.toThrow();
    await expect(as('ownerB', null, () => portal.get(f.employeeA, { month }))).rejects.toThrow();
  });

  it('без выбранного филиала у мастера с двумя филиалами сумма не выдумывается', async () => {
    const dto = await as('staffA', null, () => portal.get(null, { month }));
    expect(dto.location).toBeNull();
    expect(dto.pay).toMatchObject({ status: 'SELECT_LOCATION', earnedMinor: null, remainingMinor: null });
  });
});
