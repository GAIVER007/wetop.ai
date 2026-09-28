/**
 * Самодостаточный vendor-neutral сид тестовой схемы.
 *
 * Использует только вымышленные локальные данные из seed-local и не зависит от
 * экспортов внешней PMS или от production-базы.
 */
import { createPrismaClient } from '@pms/database';
import { seedLocal } from './seed-local';

export interface SeedReport {
  units: number;
  ratePlans: number;
  dailyRates: number;
  reservations: number;
  unassigned: number;
  today: string;
}

/** Сегодняшняя дата объекта (Asia/Almaty), YYYY-MM-DD. */
export function almatyToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
}

export async function seedTestData(
  url: string,
  schema: string,
  log: (line: string) => void = () => undefined,
): Promise<SeedReport> {
  const db = createPrismaClient(url, schema);
  try {
    const seeded = await seedLocal(db);
    const [ratePlans, dailyRates, reservations, unassigned] = await Promise.all([
      db.ratePlan.count({ where: { propertyId: seeded.propertyId } }),
      db.dailyRate.count({ where: { ratePlan: { propertyId: seeded.propertyId } } }),
      db.reservation.count({ where: { propertyId: seeded.propertyId } }),
      db.reservationItem.count({
        where: {
          reservation: { propertyId: seeded.propertyId },
          allocations: { none: {} },
        },
      }),
    ]);
    const report: SeedReport = {
      units: await db.inventoryUnit.count({ where: { propertyId: seeded.propertyId } }),
      ratePlans,
      dailyRates,
      reservations,
      unassigned,
      today: almatyToday(),
    };
    log(
      `сид: единиц ${report.units}, тарифов ${report.ratePlans}, цен ${report.dailyRates}, ` +
        `броней ${report.reservations} (без ячейки ${report.unassigned}), сегодня ${report.today}`,
    );
    return report;
  } finally {
    await db.$disconnect();
  }
}
