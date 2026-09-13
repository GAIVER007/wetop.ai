/**
 * Выгрузка периода из Универсального API Exely PMS (только чтение) в project-input/exely/api/<дир>/
 * (вне git, закрыто от чтения агентом — ПД). В вывод — только количества и статусы.
 *
 * Запуск: npx tsx scripts/imports/src/exely/cli-dump-period.ts --from=2026-09-01 --to=2026-09-30
 *   По умолчанию — текущий месяц по часам объекта. Папка: <сегодня>-period-<from>_<to>; повторный запуск в тот же день
 *   докачивает недостающие карточки (обрыв, 429), уже скачанные не трогает.
 *
 * Что берётся (docs/exely/universal-pms-api-1.5.0.md):
 *   - номера броней, затрагивающих период, активные и отменённые;
 *   - номера броней, изменённых с начала периода (минус сутки — пояс modifiedFrom в документации не назван):
 *     сюда попадают и брони, созданные в периоде на более поздние даты;
 *   - карточки всех этих броней (проживания, статусы, суммы, оплачено);
 *   - начисления по дням: по пребыванию, по выезду, по созданию, отменённые по пребыванию;
 *   - журнал платежей с начала периода до «сейчас» (будущее API не принимает), без и с внешними предоплатами.
 * Не выгружается API вовсе: платежи из депозита (так в документации).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { exely } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const key = process.env.EXELY_API_KEY ?? '';
if (!key) {
  console.log('EXELY_API_KEY пуст');
  process.exit(2);
}

const HOUR = 3600 * 1000;
const almatyNow = () => new Date(Date.now() + 5 * HOUR); // UTC+5, поля getUTC* = часы объекта
const today = almatyNow().toISOString().slice(0, 10);
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const monthStart = `${today.slice(0, 7)}-01`;
const FROM = arg('from') ?? monthStart;
const TO = arg('to') ?? plusDays(`${plusDays(monthStart, 32).slice(0, 7)}-01`, -1); // последний день месяца
for (const [n, v] of [
  ['from', FROM],
  ['to', TO],
] as const)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--${n}=YYYY-MM-DD`);
if (TO < FROM) throw new Error('--to раньше --from');
const days = (Date.parse(`${TO}T00:00:00Z`) - Date.parse(`${FROM}T00:00:00Z`)) / (24 * HOUR) + 1;
if (days > 31) throw new Error('период не больше 31 дня: у платежей Exely окно ≤31 дня');

const DIR_NAME = `${today}-period-${FROM}_${TO}`;
const OUT = resolve(ROOT, `project-input/exely/api/${DIR_NAME}`);
mkdirSync(resolve(OUT, 'bookings'), { recursive: true });
const save = (name: string, data: unknown) =>
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 1));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const client = new exely.ExelyUniversalClient({ apiKey: key });
const manifest: Record<string, unknown> = {
  period: { from: FROM, to: TO },
  startedAt: new Date().toISOString(),
  source: 'Exely Universal PMS API 1.5.0',
};

const rooms = await client.rooms();
save('rooms.json', rooms);
console.log(`единиц фонда: ${rooms.length}`);

// ── номера броней ──
const lists: Record<string, string[]> = {};
for (const state of ['Active', 'Cancelled'] as const) {
  lists[`affects-${state.toLowerCase()}`] = await client.searchBookings({
    state,
    affectsPeriodFrom: `${FROM}T00:00`,
    affectsPeriodTo: `${plusDays(TO, 1)}T00:00`,
  });
  lists[`modified-${state.toLowerCase()}`] = await client.searchBookings({
    state,
    modifiedFrom: `${plusDays(FROM, -1)}T00:00`,
    modifiedTo: `${plusDays(today, 1)}T00:00`,
  });
}
for (const [name, numbers] of Object.entries(lists)) {
  save(`booking-numbers-${name}.json`, numbers);
  console.log(`брони ${name}: ${numbers.length}`);
}
manifest.bookingNumbers = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]));

// ── карточки ──
const all = [...new Set(Object.values(lists).flat())];
console.log(`карточек к выгрузке: ${all.length}`);
let fetched = 0,
  cached = 0,
  failed = 0;
const failedNumbers: string[] = [];
for (const [i, n] of all.entries()) {
  const f = resolve(OUT, 'bookings', `${n}.json`);
  if (existsSync(f)) {
    cached++;
  } else {
    try {
      writeFileSync(f, JSON.stringify(await client.booking(n), null, 1));
      fetched++;
    } catch (e) {
      failed++;
      failedNumbers.push(n);
      console.log(`  не получена ${n}: ${(e as Error).message.slice(0, 80)}`);
    }
    await sleep(120);
  }
  if ((i + 1) % 100 === 0) console.log(`  … ${i + 1}/${all.length}`);
}
console.log(`карточки: скачано ${fetched}, уже были ${cached}, не получено ${failed}`);
manifest.cards = { total: all.length, fetched, cached, failed, failedNumbers };

// ── начисления по дням ──
const servicesEnd = TO;
const createdEnd = TO < today ? TO : today;
const services: Array<[string, Parameters<typeof client.analyticsServices>[0]]> = [
  ['analytics-services-kind1.json', { startDate: FROM, endDate: servicesEnd, dateKind: 1 }],
  ['analytics-services-kind0.json', { startDate: FROM, endDate: servicesEnd, dateKind: 0 }],
  ['analytics-services-kind2.json', { startDate: FROM, endDate: createdEnd, dateKind: 2 }],
  [
    'analytics-services-cancelled-kind1.json',
    { startDate: FROM, endDate: servicesEnd, dateKind: 1, cancelled: true },
  ],
];
const servicesCounts: Record<string, unknown> = {};
for (const [file, p] of services) {
  try {
    const a = await client.analyticsServices(p);
    save(file, a);
    servicesCounts[file] = { services: a.services.length, reservations: a.reservations.length };
    console.log(`${file}: начислений ${a.services.length}, проживаний ${a.reservations.length}`);
  } catch (e) {
    servicesCounts[file] = { error: (e as Error).message.slice(0, 160) };
    console.log(`${file}: ОШИБКА ${(e as Error).message.slice(0, 160)}`);
  }
  await sleep(300);
}
manifest.services = servicesCounts;

// ── платежи ──
// «Запросы на будущие даты не допускаются», а пояс времени в документации не назван: начинаем с часов объекта
// и отступаем назад, пока API не примет конец окна. Какой конец принят — в manifest.
const fmt = (d: Date) =>
  d
    .toISOString()
    .slice(0, 16)
    .replace(/[-T:]/g, '');
const periodEnd = new Date(`${plusDays(TO, 1)}T00:00:00Z`); // полночь после периода, часы объекта
const paymentsStart = `${FROM.replace(/-/g, '')}0000`;
let paymentsEnd: string | null = null;
const paymentsCounts: Record<string, unknown> = {};
for (const back of [0, 2, 5, 8]) {
  const now = new Date(almatyNow().getTime() - back * HOUR - 60_000);
  const end = fmt(now < periodEnd ? now : new Date(periodEnd.getTime() - 60_000));
  try {
    const plain = await client.analyticsPayments({ startDateTime: paymentsStart, endDateTime: end });
    save('analytics-payments.json', plain);
    paymentsEnd = end;
    paymentsCounts.plain = countArrays(plain);
    break;
  } catch (e) {
    console.log(`платежи до ${end}: ${(e as Error).message.slice(0, 120)} — отступаю`);
  }
}
if (paymentsEnd) {
  const withExternal = await client.analyticsPayments({
    startDateTime: paymentsStart,
    endDateTime: paymentsEnd,
    includeExternalPayments: true,
  });
  save('analytics-payments-with-external.json', withExternal);
  paymentsCounts.withExternal = countArrays(withExternal);
  console.log(
    `платежи ${paymentsStart}–${paymentsEnd}: ${JSON.stringify(paymentsCounts.plain)}; с внешними: ${JSON.stringify(paymentsCounts.withExternal)}`,
  );
} else {
  console.log('платежи: API не принял ни одного конца окна — см. сообщения выше');
}
manifest.payments = { start: paymentsStart, end: paymentsEnd, counts: paymentsCounts };
manifest.finishedAt = new Date().toISOString();
save('manifest.json', manifest);
console.log(`\nсохранено: project-input/exely/api/${DIR_NAME}`);

/** Длины массивов ответа { data: {...} } — без содержимого (ПД). */
function countArrays(r: Record<string, unknown>): Record<string, number> {
  const d = (r.data ?? r) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length]),
  );
}
