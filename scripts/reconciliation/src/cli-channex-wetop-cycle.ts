/**
 * Живой цикл Channex staging через экраны WETOP (план wetop-live-data, шаг 3): бронь канала создаётся и отменяется
 * через Booking CRS API (booking-crs-api.md: Create Booking, Update Booking), PMS получает ревизии webhook'ом.
 * После каждого шага: бронь и её статус в PMS, карточка брони, шахматка и «Менеджер каналов» в WETOP, остаток
 * категории в PMS и в Channex на ночи брони. Только staging; гость вымышленный (ADR-010); бронь в конце отменяется.
 * Запуск: npx tsx scripts/reconciliation/src/cli-channex-wetop-cycle.ts [categoryCode]
 * Пишет reports/wetop-channex-staging-YYYY-MM-DD.md. Код выхода 1, если хоть одна проверка не прошла.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000';
const category = process.argv[2] ?? 'exely-5074688';
const OTA_NAME = 'Booking.com';

const get = async <T>(path: string): Promise<T> => {
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};
const page = async (path: string) => {
  const res = await fetch(`${WEB}${path}`, { signal: AbortSignal.timeout(120_000) });
  return { status: res.status, html: await res.text() };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plus = (n: number) => new Date(Date.now() + (n * 24 + 5) * 3600 * 1000).toISOString().slice(0, 10);

type Mapping = {
  localAccommodationTypeCode: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
};
const m = (await get<Mapping[]>('/channels/channex/mapping')).find(
  (x) => x.localAccommodationTypeCode === category && x.providerRoomTypeId && x.providerRatePlanId,
);
if (!m) throw new Error(`Нет маппинга для ${category}`);
const client = new channex.ChannexClient({ apiKey, baseUrl });

const ARRIVAL = plus(20);
const DEPARTURE = plus(21);
const code = `WETOP-${Date.now().toString(36).toUpperCase()}`;
const bookingBody = (status: 'new' | 'cancelled') => ({
  booking: {
    ...(status === 'cancelled' ? { status } : {}),
    property_id: m.providerPropertyId,
    ota_reservation_code: code,
    ota_name: OTA_NAME,
    arrival_date: ARRIVAL,
    departure_date: DEPARTURE,
    currency: 'KZT',
    payment_collect: 'property',
    payment_type: 'bank_transfer',
    notes: 'проверка WETOP на живом API',
    customer: { name: 'Гость', surname: 'Тест-WETOP', mail: 'wetop@example.invalid', phone: '+70000000019', country: 'KZ' },
    rooms: [
      {
        room_type_id: m.providerRoomTypeId,
        rate_plan_id: m.providerRatePlanId,
        days: { [ARRIVAL]: '9000.00' },
        guests: [{ name: 'Гость', surname: 'Тест-WETOP' }],
        occupancy: { adults: 1, children: 0, infants: 0 },
      },
    ],
  },
});

/** Номера броней PMS на ночь заезда в категории: и с ячейкой на шахматке, и без ячейки */
async function numbersOnNight(): Promise<Set<string>> {
  const b = await get<{
    rows: Array<{ unit: { accommodationTypeCode: string }; cells: Array<{ confirmationNumber?: string }> }>;
    unassigned: Array<{ confirmationNumber: string; categoryCode: string }>;
  }>(`/chessboard?from=${ARRIVAL}&to=${ARRIVAL}`);
  const out = new Set<string>();
  for (const r of b.rows)
    if (r.unit.accommodationTypeCode === category)
      for (const c of r.cells) if (c.confirmationNumber) out.add(c.confirmationNumber);
  for (const u of b.unassigned) if (u.categoryCode === category) out.add(u.confirmationNumber);
  return out;
}
const pmsAvailable = async () =>
  (await get<{ byCategory: Record<string, { available: number }> }>(
    `/availability?arrival=${ARRIVAL}&departure=${DEPARTURE}`,
  )).byCategory[category]?.available ?? NaN;
const channexAvailable = async () =>
  (await client.getAvailability(m.providerPropertyId, ARRIVAL, ARRIVAL))[m.providerRoomTypeId!]?.[ARRIVAL] ?? NaN;
/** Остаток в Channex догоняет очередь ARI за секунды; ждём совпадения до 90 с */
async function availabilityMatches(): Promise<{ pms: number; channex: number; seconds: number }> {
  const t0 = Date.now();
  for (;;) {
    const [pms, ch] = await Promise.all([pmsAvailable(), channexAvailable()]);
    if (pms === ch || Date.now() - t0 > 90_000) return { pms, channex: ch, seconds: Math.round((Date.now() - t0) / 1000) };
    await sleep(5000);
  }
}

const checks: Array<{ step: string; ok: boolean; detail: string }> = [];
const check = (step: string, ok: boolean, detail: string) => {
  checks.push({ step, ok, detail });
  console.log(`${ok ? 'ок  ' : 'FAIL'} ${step}: ${detail}`);
};

// 0. До брони
const before = await numbersOnNight();
const availBefore = await availabilityMatches();
check('до брони: остаток PMS = Channex', availBefore.pms === availBefore.channex, `PMS ${availBefore.pms}, Channex ${availBefore.channex}`);

// 1. Бронь канала через Booking CRS
const t1 = Date.now();
const created = await client.request<{ data: { id: string; attributes: Record<string, unknown> } }>('POST', '/bookings', bookingBody('new'));
const bookingId = created.data.id;
console.log(`создана бронь ${OTA_NAME} ${code}: booking ${bookingId}, ${ARRIVAL} → ${DEPARTURE}, ${category}`);
let number: string | undefined;
for (let i = 0; i < 36 && !number; i++) {
  await sleep(5000);
  number = [...(await numbersOnNight())].find((n) => !before.has(n));
}
check('бронь канала пришла в PMS', !!number, number ? `${number} за ${Math.round((Date.now() - t1) / 1000)} с` : 'за 180 с не появилась');

if (number) {
  const card = await get<{ source: string; channel: string | null; status: string; items: Array<{ unitCode: string | null }> }>(
    `/reservations/${encodeURIComponent(number)}`,
  );
  check('карточка в API: канал и статус', card.source === 'OTA' && card.status === 'CONFIRMED', `source ${card.source}, channel ${card.channel}, status ${card.status}, ячейка ${card.items[0]?.unitCode ?? 'без ячейки'}`);
  const cardPage = await page(`/reservations/${encodeURIComponent(number)}`);
  check('WETOP: карточка брони', cardPage.status === 200 && cardPage.html.includes(number) && !cardPage.html.includes('Не удалось загрузить данные'), `HTTP ${cardPage.status}`);
  const board = await page(`/chessboard?from=${ARRIVAL}&to=${ARRIVAL}`);
  check('WETOP: бронь на шахматке', board.html.includes(encodeURIComponent(number)) || board.html.includes(number), `HTTP ${board.status}`);
  const report = await page(`/channel-manager?from=${ARRIVAL}&to=${ARRIVAL}&status=ALL`);
  check('WETOP: «Менеджер каналов» видит канал', report.status === 200 && report.html.includes(card.channel ?? OTA_NAME), `HTTP ${report.status}`);
  const afterCreate = await availabilityMatches();
  check('после брони: остаток PMS = Channex, на 1 меньше', afterCreate.pms === afterCreate.channex && afterCreate.pms === availBefore.pms - 1, `PMS ${afterCreate.pms}, Channex ${afterCreate.channex}, за ${afterCreate.seconds} с`);
}

// 2. Отмена из канала — тот же Update Booking со статусом cancelled
const t2 = Date.now();
await client.request('PUT', `/bookings/${encodeURIComponent(bookingId)}`, bookingBody('cancelled'));
if (number) {
  let status = '';
  for (let i = 0; i < 36 && status !== 'CANCELLED'; i++) {
    await sleep(5000);
    status = (await get<{ status: string }>(`/reservations/${encodeURIComponent(number)}`)).status;
  }
  check('отмена из канала дошла до PMS', status === 'CANCELLED', `статус ${status} за ${Math.round((Date.now() - t2) / 1000)} с`);
  const afterCancel = await availabilityMatches();
  check('после отмены: остаток вернулся, PMS = Channex', afterCancel.pms === afterCancel.channex && afterCancel.pms === availBefore.pms, `PMS ${afterCancel.pms}, Channex ${afterCancel.channex}, за ${afterCancel.seconds} с`);
}

const at = new Date();
const failed = checks.filter((c) => !c.ok);
const md = [
  `# WETOP + Channex staging: живой цикл брони канала (${at.toISOString().slice(0, 10)})`,
  '',
  `Снято ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC. Канал ${OTA_NAME} (Booking CRS API, staging), категория \`${category}\`,`,
  `ночь ${ARRIVAL}, код ${code}${number ? `, бронь PMS \`${number}\`` : ''}. Гость вымышленный, бронь отменена в конце цикла.`,
  '',
  failed.length === 0 ? '**RESULT: OK** — бронь канала прошла через PMS и экраны WETOP туда и обратно, остаток сходится.' : `**RESULT: FAIL** — не прошло проверок: ${failed.length}.`,
  '',
  '| Шаг | Итог | Подробности |',
  '|---|---|---|',
  ...checks.map((c) => `| ${c.step} | ${c.ok ? 'ок' : '**FAIL**'} | ${c.detail} |`),
  '',
].join('\n');
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/wetop-channex-staging-${at.toISOString().slice(0, 10)}.md`);
writeFileSync(out, md);
console.log(`→ ${out}`);
process.exit(failed.length ? 1 : 0);
