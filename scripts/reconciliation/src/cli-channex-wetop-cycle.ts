/**
 * Живой цикл Channex staging через экраны WETOP (план wetop-live-data, шаг 3): бронь канала создаётся и отменяется
 * через Booking CRS API (booking-crs-api.md: Create Booking, Update Booking), PMS получает ревизии webhook'ом.
 * После каждого шага: бронь и её статус в PMS, карточка брони, шахматка и «Менеджер каналов» в WETOP, остаток
 * категории в PMS и в Channex на ночи брони. Только staging; гость вымышленный (ADR-010); бронь в конце отменяется.
 * Запуск: npx tsx scripts/reconciliation/src/cli-channex-wetop-cycle.ts [categoryCode]
 * Пишет reports/wetop-channex-staging-YYYY-MM-DD.md. Код выхода 1, если хоть одна проверка не прошла.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { channex } from '@pms/integrations';
import { serviceFetch } from '../../lib/service-api';
import { deskHeaders, judgeDeskPage, reportTarget, writeReport } from '../../lib/desk-page';

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
// Стойка за замком (ADR-053): сессию даёт WEB_SESSION_COOKIE, без неё экранная проверка помечается пропущенной
/**
 * Страница стойки. Недоступная стойка — это пропуск проверки, а не падение прогона: 20.09.2026 цикл
 * запустили внутри контейнера API, где `127.0.0.1:3000` — сам контейнер, и `ECONNREFUSED` убил прогон
 * после создания брони. Бронь осталась в боевой базе живой, а сценарий 11 — незакрытым.
 */
const page = async (path: string) => {
  try {
    const res = await fetch(`${WEB}${path}`, {
      headers: deskHeaders(),
      signal: AbortSignal.timeout(120_000),
    });
    return { status: res.status, url: res.url, html: await res.text() };
  } catch (e) {
    return { status: 0, url: `${WEB}${path}`, html: '', unreachable: (e as Error).message };
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plus = (n: number) =>
  new Date(Date.now() + (n * 24 + 5) * 3600 * 1000).toISOString().slice(0, 10);

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
// Перенос на сутки вперёд — «изменение брони» глазами канала
const MOVED_ARRIVAL = plus(21);
const MOVED_DEPARTURE = plus(22);
const code = `WETOP-${Date.now().toString(36).toUpperCase()}`;
/**
 * Тело ревизии. `modified` — тот же Update Booking, но с другими датами: Channex заводит ревизию
 * со статусом `modified`, и именно её просит сценарий 11 сертификации (новая, изменённая, отменённая).
 */
const bookingBody = (status: 'new' | 'modified' | 'cancelled') => ({
  booking: {
    ...(status === 'new' ? {} : { status }),
    property_id: m.providerPropertyId,
    ota_reservation_code: code,
    ota_name: OTA_NAME,
    arrival_date: status === 'modified' ? MOVED_ARRIVAL : ARRIVAL,
    departure_date: status === 'modified' ? MOVED_DEPARTURE : DEPARTURE,
    currency: 'KZT',
    payment_collect: 'property',
    payment_type: 'bank_transfer',
    notes: 'проверка WETOP на живом API',
    customer: {
      name: 'Гость',
      surname: 'Тест-WETOP',
      mail: 'wetop@example.invalid',
      phone: '+70000000019',
      country: 'KZ',
    },
    rooms: [
      {
        room_type_id: m.providerRoomTypeId,
        rate_plan_id: m.providerRatePlanId,
        days: { [status === 'modified' ? MOVED_ARRIVAL : ARRIVAL]: '9000.00' },
        guests: [{ name: 'Гость', surname: 'Тест-WETOP' }],
        occupancy: { adults: 1, children: 0, infants: 0 },
      },
    ],
  },
});

/** Номера броней PMS на ночь заезда в категории: и с ячейкой на шахматке, и без ячейки */
async function numbersOnNight(): Promise<Set<string>> {
  const b = await get<{
    rows: Array<{
      unit: { accommodationTypeCode: string };
      cells: Array<{ confirmationNumber?: string }>;
    }>;
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
  (
    await get<{ byCategory: Record<string, { available: number }> }>(
      `/availability?arrival=${ARRIVAL}&departure=${DEPARTURE}`,
    )
  ).byCategory[category]?.available ?? NaN;
const channexAvailable = async () =>
  (await client.getAvailability(m.providerPropertyId, ARRIVAL, ARRIVAL))[m.providerRoomTypeId!]?.[
    ARRIVAL
  ] ?? NaN;
/** Остаток в Channex догоняет очередь ARI за секунды; ждём совпадения до 90 с */
async function availabilityMatches(): Promise<{ pms: number; channex: number; seconds: number }> {
  const t0 = Date.now();
  for (;;) {
    const [pms, ch] = await Promise.all([pmsAvailable(), channexAvailable()]);
    if (pms === ch || Date.now() - t0 > 90_000)
      return { pms, channex: ch, seconds: Math.round((Date.now() - t0) / 1000) };
    await sleep(5000);
  }
}

const checks: Array<{ step: string; ok: boolean | null; detail: string }> = [];
const check = (step: string, ok: boolean, detail: string) => {
  checks.push({ step, ok, detail });
  console.log(`${ok ? 'ок  ' : 'FAIL'} ${step}: ${detail}`);
};
// Экран стойки: ок / FAIL / пропущено (замок без сессии) — третий исход не красный и не зелёный
const checkPage = (
  step: string,
  p: { status: number; url: string; html: string },
  expected: (html: string) => boolean,
) => {
  const v = judgeDeskPage(p, expected);
  checks.push({ step, ok: v.verdict === 'locked' ? null : v.verdict === 'ok', detail: v.detail });
  console.log(
    `${v.verdict === 'ok' ? 'ок  ' : v.verdict === 'locked' ? 'проп' : 'FAIL'} ${step}: ${v.detail}`,
  );
};

// 0. До брони
const before = await numbersOnNight();
const availBefore = await availabilityMatches();
check(
  'до брони: остаток PMS = Channex',
  availBefore.pms === availBefore.channex,
  `PMS ${availBefore.pms}, Channex ${availBefore.channex}`,
);

// 1. Бронь канала через Booking CRS
const t1 = Date.now();
const created = await client.request<{ data: { id: string; attributes: Record<string, unknown> } }>(
  'POST',
  '/bookings',
  bookingBody('new'),
);
const bookingId = created.data.id;
console.log(
  `создана бронь ${OTA_NAME} ${code}: booking ${bookingId}, ${ARRIVAL} → ${DEPARTURE}, ${category}`,
);
let number: string | undefined;
for (let i = 0; i < 36 && !number; i++) {
  await sleep(5000);
  number = [...(await numbersOnNight())].find((n) => !before.has(n));
}
check(
  'бронь канала пришла в PMS',
  !!number,
  number ? `${number} за ${Math.round((Date.now() - t1) / 1000)} с` : 'за 180 с не появилась',
);

if (number) {
  const card = await get<{
    source: string;
    channel: string | null;
    status: string;
    items: Array<{ unitCode: string | null }>;
  }>(`/reservations/${encodeURIComponent(number)}`);
  check(
    'карточка в API: канал и статус',
    card.source === 'OTA' && card.status === 'CONFIRMED',
    `source ${card.source}, channel ${card.channel}, status ${card.status}, ячейка ${card.items[0]?.unitCode ?? 'без ячейки'}`,
  );
  const n = number;
  checkPage(
    'WETOP: карточка брони',
    await page(`/reservations/${encodeURIComponent(n)}`),
    (h) => h.includes(n) && !h.includes('Не удалось загрузить данные'),
  );
  checkPage(
    'WETOP: бронь на шахматке',
    await page(`/chessboard?from=${ARRIVAL}&to=${ARRIVAL}`),
    (h) => h.includes(encodeURIComponent(n)) || h.includes(n),
  );
  checkPage(
    'WETOP: «Менеджер каналов» видит канал',
    await page(`/channel-manager?from=${ARRIVAL}&to=${ARRIVAL}&status=ALL`),
    (h) => h.includes(card.channel ?? OTA_NAME),
  );
  const afterCreate = await availabilityMatches();
  check(
    'после брони: остаток PMS = Channex, на 1 меньше',
    afterCreate.pms === afterCreate.channex && afterCreate.pms === availBefore.pms - 1,
    `PMS ${afterCreate.pms}, Channex ${afterCreate.channex}, за ${afterCreate.seconds} с`,
  );
}

/**
 * Дальше бронь живёт в боевой базе, поэтому шаги идут под `try`, а отмена — в `finally`:
 * 20.09.2026 прогон упал между созданием и отменой, и в базе осталась живая бронь канала,
 * занимающая место. Отмена обязана случиться, чем бы ни кончились проверки.
 */
let cancelled = false;
try {
  // 2. Изменение из канала: даты на сутки вперёд (сценарий 11 сертификации — ревизия `modified`)
  const tMod = Date.now();
  await client.request(
    'PUT',
    `/bookings/${encodeURIComponent(bookingId)}`,
    bookingBody('modified'),
  );
  if (number) {
    let arrival = '';
    for (let i = 0; i < 36 && arrival !== MOVED_ARRIVAL; i++) {
      await sleep(5000);
      arrival = (await get<{ arrivalDate: string }>(`/reservations/${encodeURIComponent(number)}`))
        .arrivalDate;
    }
    check(
      'изменение из канала дошло до PMS',
      arrival === MOVED_ARRIVAL,
      `заезд ${arrival || '—'} (ждали ${MOVED_ARRIVAL}) за ${Math.round((Date.now() - tMod) / 1000)} с`,
    );
  }

  // 3. Отмена из канала — тот же Update Booking со статусом cancelled
  const t2 = Date.now();
  await client.request(
    'PUT',
    `/bookings/${encodeURIComponent(bookingId)}`,
    bookingBody('cancelled'),
  );
  cancelled = true;
  if (number) {
    let status = '';
    for (let i = 0; i < 36 && status !== 'CANCELLED'; i++) {
      await sleep(5000);
      status = (await get<{ status: string }>(`/reservations/${encodeURIComponent(number)}`))
        .status;
    }
    check(
      'отмена из канала дошла до PMS',
      status === 'CANCELLED',
      `статус ${status} за ${Math.round((Date.now() - t2) / 1000)} с`,
    );
    const afterCancel = await availabilityMatches();
    check(
      'после отмены: остаток вернулся, PMS = Channex',
      afterCancel.pms === afterCancel.channex && afterCancel.pms === availBefore.pms,
      `PMS ${afterCancel.pms}, Channex ${afterCancel.channex}, за ${afterCancel.seconds} с`,
    );
  }
} finally {
  if (!cancelled) {
    // Сюда попадаем, если проверки упали раньше отмены. Бронь тестовая, её место должно вернуться.
    try {
      await client.request(
        'PUT',
        `/bookings/${encodeURIComponent(bookingId)}`,
        bookingBody('cancelled'),
      );
      console.log(`бронь ${code} отменена в finally: прогон оборвался, место возвращено`);
    } catch (e) {
      console.error(`ОТМЕНИТЬ БРОНЬ ${code} (${bookingId}) РУКАМИ: ${(e as Error).message}`);
    }
  }
}

/**
 * Для формы сертификации (сценарий 11) нужны идентификаторы самого Channex, а не наши номера броней:
 * id брони и по одной ревизии на каждый статус. Печатаем их отдельным блоком, чтобы владельцу было
 * что перенести в форму, не заходя в кабинет.
 */
try {
  const revisions = await client.request<{
    data: Array<{ id: string; attributes: { status?: string; inserted_at?: string } }>;
  }>('GET', `/booking_revisions?filter[booking_id]=${encodeURIComponent(bookingId)}`);
  console.log('\nДля формы сертификации, сценарий 11:');
  console.log(`  Booking ID: ${bookingId}`);
  for (const r of revisions.data ?? []) {
    console.log(
      `  Revision ${r.attributes?.status ?? '—'}: ${r.id}  (${r.attributes?.inserted_at ?? ''})`,
    );
  }
} catch (e) {
  console.log(
    `\nСписок ревизий не прочитался: ${(e as Error).message}. Идентификаторы есть в кабинете Channex.`,
  );
}

const at = new Date();
const failed = checks.filter((c) => c.ok === false);
const skipped = checks.filter((c) => c.ok === null);
const md = [
  `# WETOP + Channex staging: живой цикл брони канала (${at.toISOString().slice(0, 10)})`,
  '',
  `Снято ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC. Канал ${OTA_NAME} (Booking CRS API, staging), категория \`${category}\`,`,
  `ночь ${ARRIVAL}, код ${code}${number ? `, бронь PMS \`${number}\`` : ''}. Гость вымышленный, бронь отменена в конце цикла.`,
  '',
  failed.length === 0
    ? `**RESULT: OK** — бронь канала прошла через PMS${skipped.length ? '' : ' и экраны WETOP'} туда и обратно, остаток сходится.${skipped.length ? ` Экранных проверок пропущено: ${skipped.length} (стойка за замком, задайте WEB_SESSION_COOKIE).` : ''}`
    : `**RESULT: FAIL** — не прошло проверок: ${failed.length}.`,
  '',
  '| Шаг | Итог | Подробности |',
  '|---|---|---|',
  ...checks.map(
    (c) =>
      `| ${c.step} | ${c.ok === null ? 'пропущено' : c.ok ? 'ок' : '**FAIL**'} | ${c.detail} |`,
  ),
  '',
].join('\n');
// В образе папка проекта только для чтения — отчёт идёт в REPORTS_DIR, если он задан
const out = reportTarget(
  ROOT,
  process.env,
  `wetop-channex-staging-${at.toISOString().slice(0, 10)}.md`,
);
console.log(`→ ${writeReport(out, md)}`);
process.exit(failed.length ? 1 : 0);
