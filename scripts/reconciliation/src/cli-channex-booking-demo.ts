/**
 * Показ «бронь из канала доехала до стойки»: одна бронь создаётся в Channex staging через Booking CRS API
 * ровно тем же вызовом, каким её прислал бы Booking.com, и мы ждём, пока webhook доведёт её до PMS.
 *
 * Отличие от `cli-channex-wetop-cycle.ts`: тот прогоняет весь цикл и в конце сам всё отменяет — смотреть
 * глазами нечего. Здесь бронь остаётся живой, чтобы её открыли на экране, а отмена — отдельной командой,
 * когда насмотрелись. **Пока не отменили, бронь занимает место в боевой базе**, поэтому команда отмены
 * печатается в конце, а всё нужное для неё сохраняется в reports/channex-demo-last.json: если сессия
 * оборвалась, отмену можно дать из любой другой.
 *
 *   npx tsx scripts/reconciliation/src/cli-channex-booking-demo.ts create [categoryCode]
 *   npx tsx scripts/reconciliation/src/cli-channex-booking-demo.ts cancel              # все показанные
 *   npx tsx scripts/reconciliation/src/cli-channex-booking-demo.ts cancel <bookingId>  # одну
 *
 * Только staging (ADR-010, гость вымышленный). Код выхода 1, если бронь не доехала или не отменилась.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const apiKey = process.env.CHANNEX_API_KEY?.trim();
if (!apiKey) throw new Error('CHANNEX_API_KEY пуст');
const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || 'https://staging.channex.io/api/v1';
if (!baseUrl.includes('staging')) throw new Error(`Только staging: ${baseUrl}`);
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const STATE = resolve(ROOT, 'reports/channex-demo-last.json');
/** Запасной путь: в контейнере запись в reports/ отказывала по правам (EACCES, 20.09.2026) */
const STATE_FALLBACK = resolve(tmpdir(), 'channex-demo-last.json');
const OTA_NAME = 'Booking.com';
const client = new channex.ChannexClient({ apiKey, baseUrl });

const get = async <T>(path: string): Promise<T> => {
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Дата через n суток по Алматы (+5) — тот же календарь, что видит стойка */
const plus = (n: number) =>
  new Date(Date.now() + (n * 24 + 5) * 3600 * 1000).toISOString().slice(0, 10);

interface Mapping {
  localAccommodationTypeCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}

/**
 * Всё, что нужно для отмены, переживает конец сессии: отменять придётся в другой раз и, может, не
 * отсюда. Память — список, а не один показ: 21.09.2026 показ запустили дважды, второй запуск затёр
 * память о первом, и первая бронь осталась висеть в боевой базе, держа место. Идентификаторы для неё
 * пришлось доставать из журнала входящих событий и сопоставлений.
 */
interface Shown {
  bookingId: string;
  code: string;
  category: string;
  arrival: string;
  departure: string;
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  number: string | null;
}

/** Номера броней PMS на ночь заезда в категории: и с ячейкой на шахматке, и без ячейки (как в цикле) */
async function numbersOnNight(category: string, night: string): Promise<Set<string>> {
  const b = await get<{
    rows: Array<{
      unit: { accommodationTypeCode: string };
      cells: Array<{ confirmationNumber?: string }>;
    }>;
    unassigned: Array<{ confirmationNumber: string; categoryCode: string }>;
  }>(`/chessboard?from=${night}&to=${night}`);
  const out = new Set<string>();
  for (const r of b.rows)
    if (r.unit.accommodationTypeCode === category)
      for (const c of r.cells) if (c.confirmationNumber) out.add(c.confirmationNumber);
  for (const u of b.unassigned) if (u.categoryCode === category) out.add(u.confirmationNumber);
  return out;
}

/** Свободных мест в категории на ночь заезда — глазами PMS */
async function available(category: string, arrival: string, departure: string): Promise<number> {
  const a = await get<{ byCategory: Record<string, { available: number }> }>(
    `/availability?arrival=${arrival}&departure=${departure}`,
  );
  return a.byCategory[category]?.available ?? NaN;
}

/** Тело ревизии — ровно то, что шлёт канал: Channex не отличает наш вызов от присланного Booking.com */
const bookingBody = (s: Shown, status: 'new' | 'cancelled') => ({
  booking: {
    ...(status === 'new' ? {} : { status }),
    property_id: s.propertyId,
    ota_reservation_code: s.code,
    ota_name: OTA_NAME,
    arrival_date: s.arrival,
    departure_date: s.departure,
    currency: 'KZT',
    payment_collect: 'property',
    payment_type: 'bank_transfer',
    notes: 'показ: бронь канала в PMS',
    customer: {
      name: 'Гость',
      surname: 'Тест-WETOP',
      mail: 'wetop@example.invalid',
      phone: '+70000000019',
      country: 'KZ',
    },
    rooms: [
      {
        room_type_id: s.roomTypeId,
        rate_plan_id: s.ratePlanId,
        days: { [s.arrival]: '9000.00' },
        guests: [{ name: 'Гость', surname: 'Тест-WETOP' }],
        occupancy: { adults: 1, children: 0, infants: 0 },
      },
    ],
  },
});

/**
 * Запоминаем показанную бронь сразу после создания, ещё до ожидания webhook: если прогон оборвётся
 * здесь, отменить её всё равно будет чем. Отказ записи не роняет показ — печатаем и идём дальше.
 */
function readShown(): Shown[] {
  const file = [STATE, STATE_FALLBACK].find((f) => existsSync(f));
  if (!file) return [];
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  // Старый формат (один показ объектом) читаем как список из одного: память прежних прогонов не теряем
  return Array.isArray(raw) ? (raw as Shown[]) : [raw as Shown];
}

function remember(): void {
  const rest = readShown().filter((x) => x.bookingId !== shown.bookingId);
  for (const file of [STATE, STATE_FALLBACK]) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify([...rest, shown], null, 2));
      return;
    } catch {
      // следующий путь
    }
  }
  console.warn(`не удалось записать, чем отменять: отмените id ${shown.bookingId} вручную`);
}

/** Убрать из памяти отменённое: иначе следующий `cancel` будет отменять уже отменённое */
function forget(bookingId: string): void {
  const rest = readShown().filter((x) => x.bookingId !== bookingId);
  for (const file of [STATE, STATE_FALLBACK]) {
    try {
      if (!existsSync(file)) continue;
      writeFileSync(file, JSON.stringify(rest, null, 2));
      return;
    } catch {
      // следующий путь
    }
  }
}

/** Отменить одну показанную бронь и дождаться, пока PMS это увидит */
async function cancelOne(s: Shown): Promise<boolean> {
  await client.request('PUT', `/bookings/${encodeURIComponent(s.bookingId)}`, {
    ...bookingBody(s, 'cancelled'),
  });
  console.log(`отмена отправлена в Channex: ${s.code}`);
  if (!s.number) {
    console.log('номера брони в PMS не знаем — проверьте «Каналы» и карточку руками');
    forget(s.bookingId);
    return true;
  }
  let status = '';
  for (let i = 0; i < 36 && status !== 'CANCELLED'; i++) {
    await sleep(5000);
    status = (await get<{ status: string }>(`/reservations/${encodeURIComponent(s.number)}`))
      .status;
  }
  const back = await available(s.category, s.arrival, s.departure);
  console.log(
    status === 'CANCELLED'
      ? `ок: бронь ${s.number} отменена, свободно снова ${back}`
      : `НЕ ОТМЕНИЛАСЬ: ${s.number} в статусе ${status} — разберите руками`,
  );
  if (status === 'CANCELLED') forget(s.bookingId);
  return status === 'CANCELLED';
}

const command = process.argv[2] ?? 'create';

if (command === 'cancel') {
  const only = process.argv[3];
  const all = readShown();
  const list = only ? all.filter((x) => x.bookingId === only) : all;
  if (list.length === 0)
    throw new Error(
      only
        ? `Показа с id ${only} в памяти нет: ${STATE} / ${STATE_FALLBACK}`
        : `Нечего отменять: нет ни ${STATE}, ни ${STATE_FALLBACK}`,
    );
  console.log(`отменяю показов: ${list.length}`);
  let bad = 0;
  for (const s of list) if (!(await cancelOne(s))) bad++;
  process.exit(bad ? 1 : 0);
}

if (command !== 'create') throw new Error(`Неизвестная команда: ${command}`);

const category = process.argv[3] ?? 'exely-5074688';
const m = (await get<Mapping[]>('/channels/channex/mapping')).find(
  (x) => x.localAccommodationTypeCode === category && x.providerRoomTypeId && x.providerRatePlanId,
);
if (!m) throw new Error(`Нет сопоставления для категории ${category}`);

const shown: Shown = {
  bookingId: '',
  code: `DEMO-${Date.now().toString(36).toUpperCase()}`,
  category,
  arrival: plus(20),
  departure: plus(21),
  propertyId: m.providerPropertyId,
  roomTypeId: m.providerRoomTypeId!,
  ratePlanId: m.providerRatePlanId!,
  number: null,
};

const availableBefore = await available(category, shown.arrival, shown.departure);
const before = await numbersOnNight(category, shown.arrival);

const t0 = Date.now();
const created = await client.request<{ data: { id: string } }>(
  'POST',
  '/bookings',
  bookingBody(shown, 'new'),
);
shown.bookingId = created.data.id;
remember();
console.log(`Channex принял бронь ${shown.code}, id ${shown.bookingId} — ждём webhook`);

for (let i = 0; i < 36 && !shown.number; i++) {
  await sleep(5000);
  shown.number =
    [...(await numbersOnNight(category, shown.arrival))].find((n) => !before.has(n)) ?? null;
}
remember();

if (!shown.number) {
  console.error('бронь не доехала до PMS за 3 минуты — смотрите «Каналы» → события и webhook');
  console.error('отменить: npx tsx scripts/reconciliation/src/cli-channex-booking-demo.ts cancel');
  process.exit(1);
}

const seconds = Math.round((Date.now() - t0) / 1000);
const card = await get<{
  status: string;
  source: string;
  channel: string | null;
  arrivalDate: string;
  departureDate: string;
  items: Array<{ unitCode: string | null }>;
}>(`/reservations/${encodeURIComponent(shown.number)}`);
const availableAfter = await available(category, shown.arrival, shown.departure);

console.log('');
console.log(`бронь из канала дошла до PMS за ${seconds} с`);
console.log(`  номер брони   ${shown.number}`);
console.log(`  даты          ${card.arrivalDate} → ${card.departureDate}`);
console.log(
  `  статус        ${card.status}, источник ${card.source}, канал ${card.channel ?? OTA_NAME}`,
);
console.log(
  `  место         ${card.items[0]?.unitCode ?? 'без ячейки — место есть, койка не назначена'}`,
);
console.log(`  код канала    ${shown.code}`);
console.log(`  свободно      было ${availableBefore}, стало ${availableAfter}`);
console.log('');
console.log('смотреть на стойке:');
console.log(`  карточка брони   /reservations/${shown.number}`);
console.log(`  шахматка         /chessboard?from=${shown.arrival}&to=${shown.departure}`);
console.log(`  события канала   /channels`);
console.log('');
console.log('бронь ЖИВАЯ и держит место. Когда насмотритесь:');
console.log('  npx tsx scripts/reconciliation/src/cli-channex-booking-demo.ts cancel');
