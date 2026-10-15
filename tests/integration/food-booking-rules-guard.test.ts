import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';

const url = process.env.DATABASE_URL;

/**
 * FOOD-FIX-02 (ADR-182, DATA_MODEL §43): миграция 101 вышла без стражи вертикали и без grants-миграции.
 * №105 добавляет food_booking_guard (локация только FOOD_SERVICE, location_id неизменяем),
 * №106 даёт права по фактическим операциям API: правила без DELETE, закрытые дни без UPDATE.
 */
describe.skipIf(!url)('правила брони столов: стража и права (миграции 105 и 106)', () => {
  let db: Db;
  const org = randomUUID(),
    food = randomUUID(),
    hotel = randomUUID(),
    foodLocation = randomUUID(),
    foodLocation2 = randomUUID(),
    hotelLocation = randomUUID();

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: 'Guard synthetic', status: 'ACTIVE' } });
    await db.business.createMany({
      data: [
        { id: food, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' },
        { id: hotel, organizationId: org, name: 'Synthetic hotel', vertical: 'HOSPITALITY' },
      ],
    });
    await db.location.createMany({
      data: [
        [foodLocation, food],
        [foodLocation2, food],
        [hotelLocation, hotel],
      ].map(([id, businessId]) => ({
        id: id!,
        businessId: businessId!,
        name: 'Synthetic branch',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      })),
    });
  });

  afterAll(async () => {
    await db.foodClosedDay.deleteMany({
      where: { location: { business: { organizationId: org } } },
    });
    await db.foodBookingRules.deleteMany({
      where: { location: { business: { organizationId: org } } },
    });
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.organization.delete({ where: { id: org } });
  });

  it('ресторанному филиалу правила и закрытый день можно, гостиничному нельзя', async () => {
    await db.foodBookingRules.create({ data: { locationId: foodLocation, bufferMinutes: 30 } });
    await db.foodClosedDay.create({
      data: { locationId: foodLocation, day: new Date('2026-12-31T00:00:00Z') },
    });
    await expect(
      db.foodBookingRules.create({ data: { locationId: hotelLocation, bufferMinutes: 10 } }),
    ).rejects.toThrow(/Food location required/);
    await expect(
      db.foodClosedDay.create({
        data: { locationId: hotelLocation, day: new Date('2026-12-30T00:00:00Z') },
      }),
    ).rejects.toThrow(/Food location required/);
  });

  it('родительский филиал неизменяем у правил и закрытых дней', async () => {
    await db.foodBookingRules.upsert({
      where: { locationId: foodLocation },
      create: { locationId: foodLocation, bufferMinutes: 30 },
      update: {},
    });
    const day = await db.foodClosedDay.upsert({
      where: {
        locationId_day: { locationId: foodLocation, day: new Date('2026-12-29T00:00:00Z') },
      },
      create: { locationId: foodLocation, day: new Date('2026-12-29T00:00:00Z') },
      update: {},
    });
    await expect(
      db.$executeRaw`UPDATE food_booking_rules SET location_id=${foodLocation2}::uuid WHERE location_id=${foodLocation}::uuid`,
    ).rejects.toThrow(/Food parent is immutable/);
    await expect(
      db.$executeRaw`UPDATE food_closed_days SET location_id=${foodLocation2}::uuid WHERE id=${day.id}::uuid`,
    ).rejects.toThrow(/Food parent is immutable/);
  });

  it('права по операциям API: правила без DELETE, закрытые дни без UPDATE', async () => {
    const rows = await db.$queryRaw<
      { table: string; privilege: string; granted: boolean }[]
    >`SELECT t.table_name AS table, p.privilege, has_table_privilege('wetop_app', t.qualified, p.privilege) AS granted
      FROM (VALUES
        ('food_booking_rules', format('%I.%I', current_schema(), 'food_booking_rules')),
        ('food_closed_days', format('%I.%I', current_schema(), 'food_closed_days'))
      ) AS t(table_name, qualified)
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(privilege)`;
    const granted = new Map(rows.map((r) => [`${r.table}:${r.privilege}`, r.granted]));
    expect(granted.get('food_booking_rules:SELECT')).toBe(true);
    expect(granted.get('food_booking_rules:INSERT')).toBe(true);
    expect(granted.get('food_booking_rules:UPDATE')).toBe(true);
    expect(granted.get('food_booking_rules:DELETE')).toBe(false);
    expect(granted.get('food_closed_days:SELECT')).toBe(true);
    expect(granted.get('food_closed_days:INSERT')).toBe(true);
    expect(granted.get('food_closed_days:UPDATE')).toBe(false);
    expect(granted.get('food_closed_days:DELETE')).toBe(true);
  });
});
