// Прибавить одну сумму к каждой цене объекта (например, +1 000 ₸: 6 000 → 7 000).
// Идёт через API (`POST /rates/bulk`), как экран «Тарифы и цены»: журнал и очередь каналов пишутся сами,
// новые цены уходят в Channex. Прямой UPDATE в базе для этого не годится: каналы его не увидели бы.
//
// Два шага:
//   1) план (ничего не меняет):
//      WETOP_EMAIL=… WETOP_PASSWORD=… node scripts/ops/rates-shift.mjs --add 1000 --out plan.json
//   2) применение того же плана:
//      WETOP_EMAIL=… WETOP_PASSWORD=… node scripts/ops/rates-shift.mjs --apply plan.json
//
// Применение сверяет каждую строку плана с текущей ценой: «было» — отправит, уже «стало» — пропустит
// (повторный запуск не прибавит второй раз), что-то третье — остановится до отправки чего-либо.
// Даты — с сегодняшнего дня объекта (или --from) на --days дней вперёд (по умолчанию 366).
// Брони, их счета и производные тарифы (у них нет своих цен) не трогаются.
import process from 'node:process';
import console from 'node:console';
import { readFileSync, writeFileSync } from 'node:fs';
/* global fetch, AbortSignal, URLSearchParams */

const BULK_LIMIT = 200; // предел API на одну массовую правку (rates.service.ts)
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function minorToMajor(minor) {
  const v = BigInt(minor);
  return `${v / 100n}.${String(v % 100n).padStart(2, '0')}`;
}

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Календари «категория × тариф» → строки плана: отрезки подряд идущих дат с одной ценой на вместимость. */
export function buildPlan(calendars, addMinor) {
  const plan = [];
  for (const cal of calendars) {
    const occupancies = [
      ...new Set(cal.days.flatMap((d) => Object.keys(d.prices).map(Number))),
    ].sort((a, b) => a - b);
    for (const occupancy of occupancies) {
      let run = null;
      for (const d of cal.days) {
        const price = d.prices[String(occupancy)];
        if (run && price === run.beforeMinor && d.date === nextDay(run.dateTo)) {
          run.dateTo = d.date;
          continue;
        }
        if (run) plan.push(run);
        run =
          price === undefined
            ? null
            : {
                accommodationTypeCode: cal.accommodationTypeCode,
                ratePlanCode: cal.ratePlanCode,
                occupancy,
                dateFrom: d.date,
                dateTo: d.date,
                beforeMinor: price,
                afterMinor: (BigInt(price) + addMinor).toString(),
              };
      }
      if (run) plan.push(run);
    }
  }
  return plan;
}

/** Текущие цены отрезка против плана: send — всё «было», skip — всё уже «стало», иначе conflict. */
export function changeState(change, currentPrices) {
  if (currentPrices.every((p) => p === change.beforeMinor)) return 'send';
  if (currentPrices.every((p) => p === change.afterMinor)) return 'skip';
  return 'conflict';
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function api(base, token, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-wetop-session': token } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function signIn(base) {
  if (process.env.WETOP_SESSION) return process.env.WETOP_SESSION;
  const email = process.env.WETOP_EMAIL;
  const password = process.env.WETOP_PASSWORD;
  if (!email || !password) throw new Error('Нужны WETOP_EMAIL и WETOP_PASSWORD (или WETOP_SESSION)');
  const r = await api(base, null, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return r.token;
}

async function hotelToday(base, token) {
  try {
    const s = await api(base, token, '/hotel/settings');
    const tz = s?.timezone ?? s?.property?.timezone ?? 'Asia/Almaty';
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  }
}

async function readCalendars(base, token, from, to) {
  const options = await api(base, token, '/rates/options');
  const calendars = [];
  for (const c of options.categories)
    for (const p of options.ratePlans) {
      const q = new URLSearchParams({
        accommodationTypeCode: c.code,
        ratePlanCode: p.code,
        from,
        to,
      });
      const cal = await api(base, token, `/rates?${q}`);
      calendars.push({
        accommodationTypeCode: c.code,
        ratePlanCode: p.code,
        currency: cal.currency,
        days: cal.days.map((d) => ({ date: d.date, prices: d.prices ?? {} })),
      });
    }
  return calendars;
}

function pricesIn(calendars, change) {
  const cal = calendars.find(
    (c) =>
      c.accommodationTypeCode === change.accommodationTypeCode &&
      c.ratePlanCode === change.ratePlanCode,
  );
  const out = [];
  for (let d = change.dateFrom; d <= change.dateTo; d = nextDay(d))
    out.push(cal?.days.find((x) => x.date === d)?.prices[String(change.occupancy)]);
  return out;
}

function summary(plan) {
  const rows = new Map();
  for (const c of plan) {
    const key = `${c.accommodationTypeCode} / ${c.ratePlanCode} / мест ${c.occupancy}`;
    const r = rows.get(key) ?? { dates: 0, examples: new Set() };
    for (let d = c.dateFrom; d <= c.dateTo; d = nextDay(d)) r.dates++;
    r.examples.add(`${minorToMajor(c.beforeMinor)} → ${minorToMajor(c.afterMinor)}`);
    rows.set(key, r);
  }
  for (const [k, r] of rows)
    console.log(`${k}: ${r.dates} дат; ${[...r.examples].slice(0, 4).join(', ')}${r.examples.size > 4 ? ', …' : ''}`);
}

async function main() {
  const base = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
  const token = await signIn(base);
  const applyPath = arg('--apply');

  if (!applyPath) {
    const add = arg('--add');
    if (!/^\d+$/.test(add ?? '') || add === '0')
      throw new Error('--add <сумма в тенге>, целое больше нуля, например --add 1000');
    const days = Number(arg('--days') ?? 366);
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('--days 1…366');
    const from = arg('--from') ?? (await hotelToday(base, token));
    if (!ISO.test(from)) throw new Error('--from YYYY-MM-DD');
    let to = from;
    for (let i = 1; i < days; i++) to = nextDay(to);
    const calendars = await readCalendars(base, token, from, to);
    const currencies = new Set(calendars.filter((c) => c.days.length).map((c) => c.currency));
    const plan = buildPlan(calendars, BigInt(add) * 100n);
    const out = arg('--out') ?? 'rates-shift-plan.json';
    writeFileSync(out, JSON.stringify({ add, from, to, createdAt: new Date().toISOString(), plan }, null, 2));
    summary(plan);
    console.log(
      `\nПлан: +${add} (${[...currencies].join(', ')}) с ${from} по ${to}, ${plan.length} строк. Ничего не изменено.\nФайл: ${out}\nПрименить: node scripts/ops/rates-shift.mjs --apply ${out}`,
    );
    return;
  }

  const { plan, from, to } = JSON.parse(readFileSync(applyPath, 'utf8'));
  const calendars = await readCalendars(base, token, from, to);
  const toSend = [];
  let skipped = 0;
  const conflicts = [];
  for (const c of plan) {
    const state = changeState(c, pricesIn(calendars, c));
    if (state === 'send') toSend.push(c);
    else if (state === 'skip') skipped++;
    else conflicts.push(c);
  }
  if (conflicts.length) {
    for (const c of conflicts.slice(0, 20))
      console.log(`Цена изменилась после плана: ${c.accommodationTypeCode}/${c.ratePlanCode}/мест ${c.occupancy} ${c.dateFrom}…${c.dateTo}`);
    throw new Error(`${conflicts.length} строк плана не совпадают с текущими ценами. Ничего не отправлено; составьте план заново.`);
  }
  let queued = 0;
  for (let i = 0; i < toSend.length; i += BULK_LIMIT) {
    const batch = toSend.slice(i, i + BULK_LIMIT);
    const r = await api(base, token, '/rates/bulk', {
      method: 'POST',
      body: JSON.stringify({
        changes: batch.map((c) => ({
          accommodationTypeCode: c.accommodationTypeCode,
          ratePlanCode: c.ratePlanCode,
          dateFrom: c.dateFrom,
          dateTo: c.dateTo,
          occupancy: c.occupancy,
          price: minorToMajor(c.afterMinor),
        })),
      }),
    });
    queued += r?.queued ?? 0;
    console.log(`Отправлено ${Math.min(i + BULK_LIMIT, toSend.length)} из ${toSend.length}`);
  }
  console.log(`Готово: изменено ${toSend.length} строк, уже было применено ${skipped}, в очередь каналов ${queued}.`);
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
