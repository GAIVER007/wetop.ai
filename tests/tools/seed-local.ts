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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LUXX_APARTS_PROPERTY, importServices, parseExelyServices } from '@pms/imports';

const SERVICES_FIXTURE = '../../scripts/imports/src/exely/__fixtures__/spravochniki.md';

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
/**
 * Пять категорий той же формы и размера, что на объекте (OBJECT.md §6: 4 / 8 / 4 номера, 36 / 36 коек).
 * До 18.09 койки делились на три категории по 24 — и при полном прогоне сквозных места кончались:
 * окна дат спеков подбирались под 36 (TESTING.md §3, помеха 3). Коды и имена — вымышленные.
 */
export const CATEGORIES = [
  {
    code: 'L-WINDOW',
    name: 'Одноместный с окном (стенд)',
    kind: 'PRIVATE_ROOM',
    capacityAdults: 1,
  },
  {
    code: 'L-INNER',
    name: 'Одноместный без окон (стенд)',
    kind: 'PRIVATE_ROOM',
    capacityAdults: 1,
  },
  { code: 'L-DOUBLE', name: 'Двухместный (стенд)', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
  { code: 'L-MALE', name: 'Мужская общая (стенд)', kind: 'DORM_BED', capacityAdults: 1 },
  { code: 'L-FEMALE', name: 'Женская общая (стенд)', kind: 'DORM_BED', capacityAdults: 1 },
] as const;

/**
 * Номер Exely → категория и вид единицы; ничего из номера не выводится, таблица задана явно (ADR-003).
 * Отрезки те же, что у объекта: 1–4 номера, 5–40 койки, 41–48 номера, 49–84 койки, 85–88 номера.
 */
export function unitPlan(): Array<{ number: string; category: string; kind: 'ROOM' | 'BED' }> {
  const plan: Array<{ number: string; category: string; kind: 'ROOM' | 'BED' }> = [];
  const put = (numbers: number[], category: string, kind: 'ROOM' | 'BED') =>
    numbers.forEach((n) => plan.push({ number: String(n), category, kind }));
  put(range(1, 4), 'L-WINDOW', 'ROOM');
  put(range(5, 40), 'L-MALE', 'BED');
  put(range(41, 48), 'L-INNER', 'ROOM');
  put(range(49, 84), 'L-FEMALE', 'BED');
  put(range(85, 88), 'L-DOUBLE', 'ROOM');
  return plan;
}
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Цена за ночь по категориям, тиыны (ADR-008), у всех разная: переселение в другую категорию
 * пересчитывает проживание по её календарю, и спек `desk-tasks` проверяет, что цена изменилась —
 * с одной ценой на все категории это было недоказуемо. Порядок как у объекта (OBJECT.md §6 ADR).
 */
const NIGHT_PRICE_MINOR: Record<(typeof CATEGORIES)[number]['code'], bigint> = {
  'L-WINDOW': 1_200_000n,
  'L-INNER': 900_000n,
  'L-DOUBLE': 1_500_000n,
  'L-MALE': 600_000n,
  'L-FEMALE': 550_000n,
};
/** Календарь цен: год назад и год вперёд — хватает всем окнам дат сквозных тестов */
const RATE_DAYS_BACK = 30;
const RATE_DAYS_AHEAD = 400;

export async function seedLocal(
  db: Db,
): Promise<{ propertyId: string; units: number; rates: number; stays: number }> {
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
        data: {
          floorId: floor.id,
          roomNumber: u.number,
          // у койки комната на 18, у номера — вместимость категории: так сводка даёт 92 гостя, как у объекта
          capacity:
            u.kind === 'BED' ? 18 : CATEGORIES.find((c) => c.code === u.category)!.capacityAdults,
          isDorm: u.kind === 'BED',
        },
        select: { id: true },
      }));
    await db.inventoryUnit.create({
      data: {
        propertyId: property.id,
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
          price: NIGHT_PRICE_MINOR[c.code] * BigInt(occ),
        });
  }
  const rates = await db.dailyRate.createMany({ data: rows, skipDuplicates: true });
  // Услуги — из фикстуры справочника (цены объекта, не ПД): без них форма начисления пуста,
  // а спеки `finance` и `full-day` начисляют «Стирка (1 загрузка)»
  const services = parseExelyServices(
    readFileSync(resolve(import.meta.dirname, SERVICES_FIXTURE), 'utf-8'),
  );
  await db.$transaction((tx) => importServices(tx, services, property.id));
  const stays = await seedStays(db, property.id, plan.id);
  return { propertyId: property.id, units, rates: rates.count, stays };
}

/**
 * Заселённые вымышленные проживания: на объекте всегда кто-то живёт, а пустой стенд валил спеки,
 * которые на это рассчитывают (`chessboard.spec.ts` ждёт `occupied > 0` на 2026-09-08 — дата в нём
 * зашита; TESTING.md §3, помеха 1). Шесть выселенных на 06–10.09.2026 и четыре живущих сегодня.
 * Гости выдуманные (ADR-010). Номера `STAND-…` не похожи на номера автотестов (`OWN_NUMBER`), и
 * уборка после прогона их не трогает. Будущие окна спеков начинаются с «сегодня + 4» — не задеты.
 */
export const STAND_PAST = {
  from: '2026-09-06',
  to: '2026-09-10',
  units: ['5', '6', '7', '49', '50', '1'],
};
export const STAND_LIVING_UNITS = ['8', '51', '41', '85'];
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
async function seedStays(db: Db, propertyId: string, ratePlanId: string): Promise<number> {
  const today = Date.now();
  const living = { from: iso(today - 86_400_000), to: iso(today + 2 * 86_400_000) };
  const wanted = [
    ...STAND_PAST.units.map((u, i) => ({
      number: `STAND-${String(i + 1).padStart(4, '0')}`,
      unit: u,
      ...STAND_PAST,
      status: 'CHECKED_OUT' as const,
    })),
    ...STAND_LIVING_UNITS.map((u, i) => ({
      number: `STAND-${String(i + 7).padStart(4, '0')}`,
      unit: u,
      ...living,
      status: 'CHECKED_IN' as const,
    })),
  ];
  let created = 0;
  for (const w of wanted) {
    const exists = await db.reservation.findFirst({
      where: { propertyId, confirmationNumber: w.number },
      select: { id: true },
    });
    if (exists) continue;
    const unit = await db.inventoryUnit.findFirstOrThrow({
      where: { exelyRoomNumber: w.unit },
      select: { id: true, accommodationTypeId: true },
    });
    const nights = BigInt(Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000));
    const nightPrice =
      NIGHT_PRICE_MINOR[
        unitPlan().find((x) => x.number === w.unit)!.category as keyof typeof NIGHT_PRICE_MINOR
      ];
    const price = nightPrice * nights;
    const at = (d: string) => new Date(`${d}T00:00:00Z`);
    const guest = await db.guest.create({
      data: { firstName: `Гость ${w.number.slice(-2)}`, lastName: 'Стендовый', citizenship: 'KAZ' },
      select: { id: true },
    });
    const reservation = await db.reservation.create({
      data: {
        propertyId,
        confirmationNumber: w.number,
        source: 'DESK',
        status: w.status,
        arrivalDate: at(w.from),
        departureDate: at(w.to),
        adults: 1,
        currency: 'KZT',
        totalAmount: price,
        primaryGuestId: guest.id,
        notes: 'вымышленное проживание стенда',
      },
      select: { id: true },
    });
    const item = await db.reservationItem.create({
      data: {
        reservationId: reservation.id,
        accommodationTypeId: unit.accommodationTypeId,
        arrivalDate: at(w.from),
        departureDate: at(w.to),
        price,
        status: w.status,
        ratePlanId,
        adults: 1,
      },
      select: { id: true },
    });
    await db.allocation.create({
      data: {
        reservationItemId: item.id,
        inventoryUnitId: unit.id,
        startDate: at(w.from),
        endDate: at(w.to),
      },
    });
    await db.stayGuest.create({
      data: { reservationItemId: item.id, guestId: guest.id, isPrimary: true },
    });
    const folio = await db.folio.create({
      data: { reservationItemId: item.id, currency: 'KZT' },
      select: { id: true },
    });
    await db.charge.create({
      data: {
        folioId: folio.id,
        kind: 'ACCOMMODATION',
        description: `Проживание ${w.from} → ${w.to}`,
        unitPrice: nightPrice,
        quantity: Number(nights),
        amount: price,
      },
    });
    created += 1;
  }
  return created;
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) {
    console.error('seed-local: DATABASE_URL должен указывать на localhost — чужую базу не трогаем');
    process.exit(2);
  }
  const db = createPrismaClient(url, process.env.DATABASE_SCHEMA ?? '');
  const r = await seedLocal(db);
  console.log(
    `объект ${r.propertyId}, новых единиц ${r.units}, новых цен ${r.rates}, новых проживаний ${r.stays}`,
  );
  await db.$disconnect();
}
