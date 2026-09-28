/**
 * Сид тестовой схемы без живой базы (plans/tests-without-live-db-2026-09-15.md, шаг 1).
 *
 * Фонд — настоящий: 88 единиц, 5 категорий, 6 тарифов и услуги из аудита Exely 07.09.2026
 * (`project-input/exely/audit-2026-09-07/*.md`, в репозитории, гостей там нет). Нумерация единиц берётся из
 * файла, из номера ничего не выводится (CLAUDE.md §5). Цены и брони — вымышленные: календарь на 15 месяцев,
 * ~300 броней с придуманными гостями (ADR-010), заезды/выезды/проживающие вокруг «сегодня» в Алматы, несколько
 * броней без ячейки, отмены и незаезды. Всё идёт через тот же импорт, что и настоящие брони Exely
 * (`adaptUniBooking` → `normalizeExelyReservation` → `importReservations`): номера в формате Exely, счета и
 * платежи создаются боевым кодом, уборка автотестов такие брони не трогает.
 *
 * Сид детерминирован: одно зерно — одни и те же брони, суммы и номера на любой машине.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrismaClient, type DbTx } from '@pms/database';
import type { exely } from '@pms/integrations';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  buildInventoryImportPlan,
  buildRatePlanImportPlan,
  importInventoryPlan,
  importPriceCalendar,
  importRatePlans,
  importReservations,
  importServices,
  normalizeExelyReservation,
  parseExelyAccommodationTypes,
  parseExelyInventory,
  parseExelyPriceCalendar,
  parseExelyRatePlans,
  parseExelyServices,
} from '@pms/imports';

const ROOT = resolve(import.meta.dirname, '../..');
const AUDIT = resolve(ROOT, 'project-input/exely/audit-2026-09-07');

export interface SeedReport {
  units: number;
  ratePlans: number;
  dailyRates: number;
  reservations: number;
  unassigned: number;
  today: string;
}

/** Сегодняшняя дата объекта (Asia/Almaty), YYYY-MM-DD */
export function almatyToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
}
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const plus = (day: string, n: number) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY));

/** Детерминированный генератор (mulberry32): одно зерно — одна последовательность на любой машине */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)]!,
  };
}

/** Цена ночи по категории, ₸ (вымышленная; структура тарифов — как у объекта: ОТА +35 %, Островок −10 %) */
const BASE_PRICE: Record<string, Record<number, number>> = {
  '5074312': { 1: 12_000 }, // одноместная с окном
  '5074686': { 1: 10_000 }, // одноместная без окон
  '5074687': { 1: 14_000, 2: 16_000 }, // двухместная
  '5074688': { 1: 4_000 }, // койка, мужская
  '5074689': { 1: 4_000 }, // койка, женская
};
const TARIFF_FACTOR: Record<string, number> = {
  '10157482': 1, // Базовый
  '10158310': 1.35, // ОТА +35 %
  '10159064': 1.35, // ОТА в USD (в сиде — KZT, тариф без продаж)
  '10162781': 1, // Стандартный Островок
  '10162782': 0.9, // Невозвратный Островок −10 %
  '10162783': 1, // B2B Островок
};
const roundHundred = (v: number) => Math.round(v / 100) * 100;

/** Календарь цен в формате снимка Exely (RLE), чтобы пройти через тот же parseExelyPriceCalendar */
function syntheticCalendar(
  tariffs: Array<{ exelyId: string; name: string }>,
  types: Array<{ exelyId: string; name: string }>,
  from: string,
  days: number,
) {
  return {
    source: 'СИД автотестов — вымышленные цены, настоящие тарифы и категории',
    capturedAt: from,
    startDate: from,
    daysCount: days,
    rleFormat: '[value|null, days]',
    tariffs: tariffs.map((t) => ({
      exelyId: t.exelyId,
      name: t.name,
      parentExelyId: null,
      currency: 'KZT',
      roomTypes: types.map((rt) => ({
        exelyId: rt.exelyId,
        name: rt.name,
        placements: Object.entries(BASE_PRICE[rt.exelyId] ?? { 1: 8_000 }).map(([occ, price]) => ({
          id: `0-${occ}-${rt.exelyId}`,
          name: `${occ} осн.`,
          prices: [[String(roundHundred(price * (TARIFF_FACTOR[t.exelyId] ?? 1))), days]],
        })),
        restrictions: {},
      })),
    })),
  };
}

const FIRST_NAMES = ['Айгерим', 'Данияр', 'Мария', 'Алексей', 'Жанна', 'Тимур', 'Елена', 'Нурлан', 'Ольга', 'Арман'];
const LAST_NAMES = ['Тестова', 'Примеров', 'Вымышленная', 'Сидов', 'Условная', 'Образцов', 'Пробная', 'Черновиков'];
const OTA = ['booking.com', 'agoda', 'expedia', 'hostelworld', 'ostrovok', 'trip.com'];
const DESK_SOURCES = ['От стойки', 'От стойки', 'Телефон', 'WhatsApp', 'Walk-in'];

interface Occupancy {
  unit: string | null; // «№ комнаты в Exely»; null — без ячейки
  typeExelyId: string;
  from: string;
  to: string;
}

/** Брони по единицам без пересечений: у каждой ячейки своя цепочка проживаний с промежутками */
function planStays(
  units: Array<{ exelyRoomNumber: string; typeExelyId: string }>,
  today: string,
  r: ReturnType<typeof rng>,
): Occupancy[] {
  const start = -10;
  // Последняя занятая ночь — +2: с +3 начинаются окна сквозных спеков (tests/README.md), им нужны свободные ячейки
  const end = 3;
  const out: Occupancy[] = [];
  for (const u of units) {
    let cursor = start;
    while (cursor < end) {
      cursor += r.int(0, 3); // промежуток — свободные ночи
      if (cursor >= end) break;
      if (r.next() < 0.3) {
        cursor += 1; // ячейка стоит пустой ещё ночь — загрузка около 60–70 %
        continue;
      }
      const nights = Math.min(r.int(1, 4), end - cursor);
      out.push({ unit: u.exelyRoomNumber, typeExelyId: u.typeExelyId, from: plus(today, cursor), to: plus(today, cursor + nights) });
      cursor += nights;
    }
  }
  // Три брони без ячейки (паритет с «Без номера» Exely, Q-107): сегодня и завтра, в общих комнатах есть запас мест
  for (let i = 0; i < 3; i++)
    out.push({ unit: null, typeExelyId: i % 2 ? '5074688' : '5074689', from: plus(today, i % 2), to: plus(today, 2) });
  return out;
}

function buildBookings(stays: Occupancy[], today: string, r: ReturnType<typeof rng>): exely.UniBooking[] {
  return stays.map((s, i) => {
    const seq = 1260000000 + i;
    const nights = Math.round((Date.parse(s.to) - Date.parse(s.from)) / DAY);
    const isOta = r.next() < 0.55;
    const priceNight = roundHundred((BASE_PRICE[s.typeExelyId]?.[1] ?? 8_000) * (isOta ? 1.35 : 1));
    const amount = priceNight * nights;
    const past = s.to <= today;
    const inHouse = s.from < today && s.to > today;
    let status: string = 'New';
    let bookingStatus: string = 'Confirmed';
    if (past) status = 'CheckedOut';
    else if (inHouse) status = r.next() < 0.85 ? 'CheckedIn' : 'New';
    const roll = r.next();
    if (s.unit && roll < 0.05) {
      status = 'Cancelled';
      bookingStatus = 'Cancelled';
    } else if (s.unit && past && roll < 0.08) status = 'NoShow';
    const paid = status === 'CheckedOut' || status === 'CheckedIn' ? amount : isOta && r.next() < 0.5 ? amount : 0;
    const created = plus(s.from, -r.int(1, 30));
    const guest = `G-${seq}`;
    return {
      id: `B-${seq}`,
      number: `${created.replaceAll('-', '')}-513903-${seq}`,
      currencyId: 'KZT',
      customerComment: null,
      customer: {
        id: guest,
        lastName: r.pick(LAST_NAMES),
        firstName: r.pick(FIRST_NAMES),
        middleName: null,
        birthDate: `19${r.int(60, 99)}-0${r.int(1, 9)}-1${r.int(0, 9)}`,
        citizenshipCode: r.next() < 0.8 ? 'KAZ' : r.pick(['RUS', 'UZB', 'KGZ']),
        emails: [`${guest.toLowerCase()}@example.invalid`],
        phones: [`+7000${String(seq).slice(-7)}`],
        gender: r.pick(['Male', 'Female', 'Unknown']),
      },
      source: isOta ? { key: '2', value: 'Из канала продаж' } : { key: '1', value: r.pick(DESK_SOURCES) },
      sourceChannelName: isOta ? r.pick(OTA) : null,
      roomStays: [
        {
          id: `S-${seq}`,
          bookingId: `B-${seq}`,
          roomId: s.unit ? `R-${s.unit}` : null,
          roomTypeId: s.typeExelyId,
          checkInDateTime: `${s.from}T14:00`,
          checkOutDateTime: `${s.to}T12:00`,
          actualCheckInDateTime: status === 'CheckedIn' || status === 'CheckedOut' ? `${s.from}T15:00` : null,
          actualCheckOutDateTime: status === 'CheckedOut' ? `${s.to}T11:00` : null,
          status,
          bookingStatus,
          guestCountInfo: { adults: 1, children: 0 },
          guestsIds: [guest],
          totalPrice: { amount, toPayAmount: amount - paid, toRefundAmount: 0 },
        },
      ],
    };
  });
}

/** Объект без Location получает Business HOSPITALITY своей организации и свою Location — как backfill …030 */
async function linkPlatformChain(tx: DbTx, propertyId: string): Promise<void> {
  const p = await tx.property.findUniqueOrThrow({
    where: { id: propertyId },
    select: { name: true, organizationId: true, locationId: true, timezone: true, currency: true },
  });
  if (p.locationId) return;
  const business =
    (await tx.business.findFirst({
      where: { organizationId: p.organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) ??
    (await tx.business.create({
      data: { organizationId: p.organizationId, name: p.name, vertical: 'HOSPITALITY' },
      select: { id: true },
    }));
  const location = await tx.location.create({
    data: { businessId: business.id, name: p.name, timezone: p.timezone, currency: p.currency },
    select: { id: true },
  });
  await tx.property.update({ where: { id: propertyId }, data: { locationId: location.id } });
}

/** Фонд, тарифы, календарь, услуги и брони — одной транзакцией в схему `schema` */
export async function seedTestData(url: string, schema: string, log: (line: string) => void = () => undefined): Promise<SeedReport> {
  const inventoryMd = readFileSync(resolve(AUDIT, 'inventory.md'), 'utf-8');
  const spravochniki = readFileSync(resolve(AUDIT, 'spravochniki.md'), 'utf-8');
  const types = parseExelyAccommodationTypes(spravochniki);
  const plan = buildInventoryImportPlan(parseExelyInventory(inventoryMd), types);
  const tariffs = parseExelyRatePlans(spravochniki);
  const today = almatyToday();
  // Календарь на 15 месяцев вперёд: у объекта цены загружены до конца следующего года, спеки берут и фиксированные даты
  const calendar = parseExelyPriceCalendar(syntheticCalendar(tariffs, types, plus(today, -30), 480));
  const typeIdByCode = new Map(plan.accommodationTypes.map((t) => [t.code, t.exelyId!]));
  const units = plan.units
    .filter((u) => u.exelyRoomNumber)
    .map((u) => ({ exelyRoomNumber: u.exelyRoomNumber!, typeExelyId: typeIdByCode.get(u.accommodationTypeCode)! }));
  const r = rng(20260915);
  const stays = planStays(units, today, r);
  const ctx = {
    roomMap: new Map(units.map((u) => [`R-${u.exelyRoomNumber}`, u.exelyRoomNumber])),
    typeMap: new Map(types.map((t) => [t.exelyId, `exely-${t.exelyId}`])),
  };
  const records = buildBookings(stays, today, r).map((b) => normalizeExelyReservation(adaptUniBooking(b), ctx));

  const db = createPrismaClient(url, schema);
  try {
    return await db.$transaction(
      async (tx: DbTx) => {
        const inv = await importInventoryPlan(tx, plan, { ...LUXX_APARTS_PROPERTY });
        // Platform P1 (ADR-104 §18): сид идёт ПОСЛЕ миграций, и backfill 20260927000030 этот объект не видел —
        // цепочку Organization → Business → Location строим так же, как seed-local (иначе свежий стенд без location_id)
        await linkPlatformChain(tx, inv.propertyId);
        const rp = await importRatePlans(
          tx,
          buildRatePlanImportPlan(tariffs, plan.accommodationTypes.map((t) => t.code), 'KZT'),
          inv.propertyId,
        );
        const cal = await importPriceCalendar(tx, calendar, inv.propertyId);
        await importServices(tx, parseExelyServices(spravochniki), inv.propertyId);
        const res = await importReservations(tx, records, { propertyId: inv.propertyId, anonymizeSalt: 'test-seed', today });
        if (res.conflicts.length) throw new Error(`сид построен с пересечениями: ${res.conflicts.length}`);
        const report = {
          units: inv.unitsInDb,
          ratePlans: rp.ratePlans.created + rp.ratePlans.updated,
          dailyRates: cal.dailyRates.created + cal.dailyRates.updated + cal.dailyRates.unchanged,
          reservations: res.reservations.created + res.reservations.updated,
          unassigned: res.unassigned,
          today,
        };
        log(`сид: единиц ${report.units}, тарифов ${report.ratePlans}, цен ${report.dailyRates}, броней ${report.reservations} (без ячейки ${report.unassigned}), сегодня ${today}`);
        return report;
      },
      { timeout: 180_000, maxWait: 30_000 },
    );
  } finally {
    await db.$disconnect();
  }
}
