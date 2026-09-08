/**
 * Выгрузка всего доступного на чтение из Универсального API Exely PMS в
 * project-input/exely/api/<дата>/ (вне git, закрыто от чтения агентом — ПД).
 * Запуск: npx tsx scripts/imports/src/exely/cli-dump-universal.ts [YYYY-MM-DD]
 * В вывод — только количества и статусы.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
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
const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const OUT = resolve(ROOT, `project-input/exely/api/${today}`);
mkdirSync(resolve(OUT, 'bookings'), { recursive: true });
const save = (name: string, data: unknown) =>
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 1));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const client = new exely.ExelyUniversalClient({ apiKey: key });
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

const rooms = await client.rooms();
save('rooms.json', rooms);
console.log(`rooms: ${rooms.length}`);

const future = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: `${today}T00:00`,
  affectsPeriodTo: `${plusDays(today, 364)}T00:00`,
});
save('booking-numbers-future-active.json', future);
console.log(`future active bookings (affects ${today}..+364d): ${future.length}`);

const augActive = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: '2026-08-01T00:00',
  affectsPeriodTo: '2026-09-01T00:00',
});
const augCancelled = await client.searchBookings({
  state: 'Cancelled',
  affectsPeriodFrom: '2026-08-01T00:00',
  affectsPeriodTo: '2026-09-01T00:00',
});
save('booking-numbers-aug-active.json', augActive);
save('booking-numbers-aug-cancelled.json', augCancelled);
console.log(`august bookings: active ${augActive.length}, cancelled ${augCancelled.length}`);

const all = [...new Set([...future, ...augActive, ...augCancelled])];
console.log(`booking details to fetch: ${all.length}`);
let done = 0,
  failed = 0;
for (const n of all) {
  const f = resolve(OUT, 'bookings', `${n}.json`);
  if (existsSync(f)) {
    done++;
    continue;
  }
  try {
    const b = await client.booking(n);
    writeFileSync(f, JSON.stringify(b, null, 1));
    done++;
  } catch (e) {
    failed++;
    console.log(`  fail ${n}: ${(e as Error).message.slice(0, 80)}`);
  }
  if (done % 100 === 0) console.log(`  … ${done}/${all.length}`);
  await sleep(120);
}
console.log(`booking details: ok ${done}, failed ${failed}`);

for (const kind of [1, 0, 2] as const) {
  const a = await client.analyticsServices({
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    dateKind: kind,
  });
  save(`analytics-services-aug-kind${kind}.json`, a);
  console.log(
    `analytics/services aug kind=${kind}: services ${a.services.length}, reservations ${a.reservations.length}, customers ${a.customers.length}`,
  );
  await sleep(300);
}
try {
  const c = await client.analyticsServices({
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    dateKind: 2,
    cancelled: true,
  });
  save('analytics-services-aug-cancelled.json', c);
  console.log(
    `analytics/services/cancelled aug: services ${c.services.length}, reservations ${c.reservations.length}`,
  );
} catch (e) {
  console.log(`cancelled: ${(e as Error).message.slice(0, 100)}`);
}
const pay = await client.analyticsPayments({
  startDateTime: '202608010000',
  endDateTime: '202608312359',
});
save('analytics-payments-aug.json', pay);
const payments =
  (Object.values((pay as { data?: Record<string, unknown> }).data ?? pay).find((v) =>
    Array.isArray(v),
  ) as unknown[] | undefined) ?? [];
console.log(
  `analytics/payments aug: ${payments.length} записей; ключи: ${Object.keys((pay as { data?: object }).data ?? pay).join(', ')}`,
);
console.log(`saved to ${OUT.replace(ROOT + '/', '')}`);
