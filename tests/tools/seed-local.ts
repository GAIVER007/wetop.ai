/**
 * Данные для локальной базы: минимальный вымышленный объект, на котором идут интеграционные тесты.
 *
 * Интеграционные тесты писались под dev-БД, где схема `pms_test` получает копию рабочих данных
 * (ADR-042). На пустой локальной базе часть из них падает не по коду, а потому что нет ни объекта,
 * ни единицы «1». Здесь ровно это и создаётся — вымышленное (ADR-010), без единого настоящего гостя.
 *
 * Запускается только против локальной базы: проверка адреса ниже не даёт задеть dev или боевую.
 */
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';

/** Локальный стенд — только `localhost` и `127.0.0.1`: чужую базу этим скриптом не тронуть */
export function isLocalDatabase(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

export const LOCAL_PROPERTY = {
  // Имя — из константы: код ищет объект по нему (`findFirst({ where: { name } })`), и на dev-БД
  // схема `pms_test` получает копию настоящего объекта. Здесь это пустая коробка с тем же именем:
  // ни гостей, ни броней, ни денег — только объект, категория и пять единиц.
  name: LUXX_APARTS_PROPERTY.name,
  legalName: 'ИП «Локальный стенд»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

/**
 * Форма объекта повторяет настоящую (CLAUDE.md §6): 88 единиц продажи — 16 отдельных номеров и
 * 72 койко-места, пять категорий, нумерация Exely не сплошная (1–4 номера, 5–40 койки, 41–48 номера,
 * 49–84 койки, 85–88 номера). Совпадает только форма: ни одного настоящего гостя, брони или тарифа.
 */
const CATEGORIES = [
  { code: 'L-SINGLE', name: 'Одноместный (стенд)', kind: 'PRIVATE_ROOM', capacityAdults: 1 },
  { code: 'L-DOUBLE', name: 'Двухместный (стенд)', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
  { code: 'L-MALE', name: 'Мужская общая (стенд)', kind: 'DORM_BED', capacityAdults: 1 },
  { code: 'L-FEMALE', name: 'Женская общая (стенд)', kind: 'DORM_BED', capacityAdults: 1 },
  { code: 'L-MIXED', name: 'Общая смешанная (стенд)', kind: 'DORM_BED', capacityAdults: 1 },
] as const;

/** Номер Exely → категория и вид единицы; ничего из номера не выводится, таблица задана явно (ADR-003) */
function unitPlan(): Array<{ number: string; category: string; kind: 'ROOM' | 'BED' }> {
  const rooms = [...range(1, 4), ...range(41, 48), ...range(85, 88)];
  const beds = [...range(5, 40), ...range(49, 84)];
  const plan: Array<{ number: string; category: string; kind: 'ROOM' | 'BED' }> = [];
  rooms.forEach((n, i) =>
    plan.push({ number: String(n), category: i % 3 === 0 ? 'L-DOUBLE' : 'L-SINGLE', kind: 'ROOM' }),
  );
  beds.forEach((n, i) =>
    plan.push({
      number: String(n),
      category: (['L-MALE', 'L-FEMALE', 'L-MIXED'] as const)[i % 3]!,
      kind: 'BED',
    }),
  );
  return plan;
}
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Цена за ночь на стенде: одна на все категории, целая (ADR-008 — тиыны) */
const NIGHT_PRICE_MINOR = 1_200_000n;
/** Календарь цен: год назад и год вперёд — хватает всем окнам дат сквозных тестов */
const RATE_DAYS_BACK = 30;
const RATE_DAYS_AHEAD = 400;

export async function seedLocal(
  db: Db,
): Promise<{ propertyId: string; units: number; rates: number }> {
  const property =
    (await db.property.findFirst({ where: { name: LOCAL_PROPERTY.name }, select: { id: true } })) ??
    (await db.property.create({ data: LOCAL_PROPERTY, select: { id: true } }));

  const typeIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const existing = await db.accommodationType.findFirst({
      where: { propertyId: property.id, code: c.code },
      select: { id: true },
    });
    typeIds.set(
      c.code,
      existing?.id ??
        (
          await db.accommodationType.create({
            data: {
              propertyId: property.id,
              code: c.code,
              name: c.name,
              kind: c.kind,
              capacityAdults: c.capacityAdults,
              capacityChildren: 0,
            },
            select: { id: true },
          })
        ).id,
    );
  }

  // Единица живёт в комнате, комната на этаже, этаж в корпусе (DATA_MODEL §1) — заводим всю цепочку
  const building =
    (await db.building.findFirst({
      where: { propertyId: property.id, name: 'Стенд' },
      select: { id: true },
    })) ??
    (await db.building.create({
      data: { propertyId: property.id, name: 'Стенд' },
      select: { id: true },
    }));
  const floor =
    (await db.floor.findFirst({
      where: { buildingId: building.id, name: '1' },
      select: { id: true },
    })) ??
    (await db.floor.create({ data: { buildingId: building.id, name: '1' }, select: { id: true } }));

  let units = 0;
  for (const u of unitPlan()) {
    const exists = await db.inventoryUnit.findFirst({
      where: { exelyRoomNumber: u.number },
      select: { id: true },
    });
    if (exists) continue;
    const room =
      (await db.physicalRoom.findFirst({
        where: { floorId: floor.id, roomNumber: u.number },
        select: { id: true },
      })) ??
      (await db.physicalRoom.create({
        data: { floorId: floor.id, roomNumber: u.number, capacity: u.kind === 'BED' ? 18 : 2, isDorm: u.kind === 'BED' },
        select: { id: true },
      }));
    await db.inventoryUnit.create({
      data: {
        physicalRoomId: room.id,
        accommodationTypeId: typeIds.get(u.category)!,
        code: `L${u.number}`,
        exelyRoomNumber: u.number,
        kind: u.kind,
        active: true,
      },
    });
    units += 1;
  }

  // Тариф и календарь цен: без цены на дату бронь со стойки не создаётся
  const plan =
    (await db.ratePlan.findFirst({
      where: { propertyId: property.id, code: 'L-BASE' },
      select: { id: true },
    })) ??
    (await db.ratePlan.create({
      data: {
        propertyId: property.id,
        code: 'L-BASE',
        name: 'Базовый тариф (стенд)',
        currency: 'KZT',
        active: true,
      },
      select: { id: true },
    }));
  for (const id of typeIds.values())
    await db.ratePlanAccommodationType.upsert({
      where: { ratePlanId_accommodationTypeId: { ratePlanId: plan.id, accommodationTypeId: id } },
      create: { ratePlanId: plan.id, accommodationTypeId: id },
      update: {},
    });

  const day = 86_400_000;
  const start = Date.now() - RATE_DAYS_BACK * day;
  const rows: Array<{
    date: Date;
    accommodationTypeId: string;
    ratePlanId: string;
    occupancy: number;
    price: bigint;
  }> = [];
  for (let i = 0; i < RATE_DAYS_BACK + RATE_DAYS_AHEAD; i++) {
    const date = new Date(new Date(start + i * day).toISOString().slice(0, 10));
    for (const c of CATEGORIES)
      for (let occ = 1; occ <= c.capacityAdults; occ++)
        rows.push({
          date,
          accommodationTypeId: typeIds.get(c.code)!,
          ratePlanId: plan.id,
          occupancy: occ,
          price: NIGHT_PRICE_MINOR * BigInt(occ),
        });
  }
  const rates = await db.dailyRate.createMany({ data: rows, skipDuplicates: true });
  return { propertyId: property.id, units, rates: rates.count };
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) {
    console.error('seed-local: DATABASE_URL должен указывать на localhost — чужую базу не трогаем');
    process.exit(2);
  }
  const db = createPrismaClient(url, process.env.DATABASE_SCHEMA ?? '');
  const r = await seedLocal(db);
  console.log(`объект ${r.propertyId}, новых единиц ${r.units}, новых цен ${r.rates}`);
  await db.$disconnect();
}
