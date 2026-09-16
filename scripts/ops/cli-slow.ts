/**
 * Разбор «всё тормозит»: замеряет базу, API, стойку и машину — и печатает, где уходит время.
 *
 * Запуск на машине стойки (нужны `.env` и поднятые службы):
 *   DATABASE_POOL_MAX=1 npx tsx scripts/ops/cli-slow.ts [--passes=3] [--no-db] [--no-desk]
 *
 * Что делает:
 *   1) `SELECT 1` несколько раз — сколько стоит один рейс в базу (она в Сингапуре, стойка в Алматы);
 *   2) те же вызовы API, что делает каждый экран, с числом запросов в базу на вызов (взято из кода);
 *   3) сами экраны стойки — видно, сколько Next добавляет поверх данных;
 *   4) память, своп, загрузка и диск машины.
 * Данных гостей не печатает: только время, коды ответов и размеры.
 * Разовый скрипт — с `DATABASE_POOL_MAX=1`, чтобы не вычерпать пулер Supabase (TESTING.md).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { explainSlowness, median, ms, row, type Measure, type MachineFacts } from './slow-report';

const ROOT = resolve(import.meta.dirname, '../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string, fallback: number) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? Number(found.split('=')[1]) || fallback : fallback;
};
const passes = value('passes', 3);
const api = (process.env.APP_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const desk = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const plus = (days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;

/** Вызовы API по экранам и число запросов в базу на вызов — посчитано по коду 16.09.2026 */
const CALLS: Array<{ name: string; path: string; dbQueries: number }> = [
  { name: 'GET /hotel/settings (оболочка)', path: '/hotel/settings', dbQueries: 3 },
  { name: 'GET /desk/today (стойка)', path: `/desk/today?date=${today}`, dbQueries: 2 },
  {
    name: 'GET /desk/dashboard, месяц (главная)',
    path: `/desk/dashboard?from=${monthStart}&to=${today}`,
    dbQueries: 12,
  },
  { name: 'GET /chessboard, 14 суток', path: `/chessboard?from=${today}&to=${plus(14)}`, dbQueries: 4 },
  { name: 'GET /chessboard, месяц', path: `/chessboard?from=${today}&to=${plus(30)}`, dbQueries: 4 },
  {
    name: 'GET /hotel/reservations (брони)',
    path: `/hotel/reservations?from=${today}&to=${plus(14)}&status=ALL&page=1`,
    dbQueries: 3,
  },
  { name: 'GET /inventory/summary (номера)', path: '/inventory/summary', dbQueries: 2 },
  { name: 'GET /rate-plans (тарифы)', path: '/rate-plans', dbQueries: 2 },
];

const SCREENS = ['/today', '/chessboard', '/reservations', '/rooms'];

async function timeFetch(url: string): Promise<{ ms: number; status: number; bytes: number }> {
  const started = performance.now();
  const res = await fetch(url, { headers: { 'x-wetop-service-key': process.env.SERVICE_API_KEY ?? '' } });
  const body = await res.arrayBuffer();
  return { ms: performance.now() - started, status: res.status, bytes: body.byteLength };
}

async function measureHttp(name: string, url: string, dbQueries?: number): Promise<Measure> {
  const samples: number[] = [];
  let note = '';
  for (let i = 0; i < passes; i += 1) {
    try {
      const r = await timeFetch(url);
      samples.push(r.ms);
      if (r.status >= 400) note = `HTTP ${r.status}`;
    } catch (error) {
      return { name, samples: [], ...(dbQueries ? { dbQueries } : {}), error: String(error) };
    }
  }
  return {
    name: note ? `${name} [${note}]` : name,
    samples,
    ...(dbQueries ? { dbQueries } : {}),
  };
}

async function measureDb(): Promise<Measure> {
  const db = createPrismaClient();
  try {
    const samples: number[] = [];
    // первый запрос ставит соединение — его в медиану не берём
    await db.$queryRaw`select 1`;
    for (let i = 0; i < Math.max(passes, 5); i += 1) {
      const started = performance.now();
      await db.$queryRaw`select 1`;
      samples.push(performance.now() - started);
    }
    return { name: 'SELECT 1 (один рейс в базу)', samples };
  } catch (error) {
    return { name: 'SELECT 1 (один рейс в базу)', samples: [], error: String(error) };
  } finally {
    await db.$disconnect();
  }
}

function machine(): MachineFacts {
  const facts: MachineFacts = { platform: process.platform };
  const sh = (cmd: string, cmdArgs: string[]): string => {
    try {
      return execFileSync(cmd, cmdArgs, { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  };
  if (process.platform === 'darwin') {
    const mem = Number(sh('sysctl', ['-n', 'hw.memsize']));
    if (mem) facts.memoryGb = mem / 1024 ** 3;
    const cores = Number(sh('sysctl', ['-n', 'hw.ncpu']));
    if (cores) facts.cores = cores;
    const load = /load averages?: ([\d.]+)/.exec(sh('uptime', []))?.[1];
    if (load) facts.load1 = Number(load);
    // vm_stat печатает страницы; своп — в sysctl vm.swapusage
    const swap = /used = ([\d.]+)([MG])/.exec(sh('sysctl', ['-n', 'vm.swapusage']));
    if (swap) facts.swapUsedGb = Number(swap[1]) / (swap[2] === 'M' ? 1024 : 1);
    const disk = sh('df', ['-g', '/']).split('\n').at(-1)?.split(/\s+/)[3];
    if (disk) facts.freeDiskGb = Number(disk);
  }
  return facts;
}

const dbMeasure = flag('no-db') ? undefined : await measureDb();
const apiMeasures: Measure[] = [];
for (const c of CALLS) apiMeasures.push(await measureHttp(c.name, `${api}${c.path}`, c.dbQueries));
const deskMeasures: Measure[] = [];
if (!flag('no-desk'))
  for (const s of SCREENS) deskMeasures.push(await measureHttp(`${s}`, `${desk}${s}`));
const facts = machine();
const dbMedian = dbMeasure && !dbMeasure.error ? median(dbMeasure.samples) : Number.NaN;

console.log(`# Разбор «всё тормозит» · ${new Date().toISOString()} · проходов ${passes}`);
console.log(`# API ${api} · стойка ${desk}`);
console.log('\n## База');
console.log(dbMeasure ? row(dbMeasure, Number.NaN) : 'пропущено (--no-db)');
console.log('\n## API (в скобках — разброс; сеть до базы посчитана по числу запросов из кода)');
for (const m of apiMeasures) console.log(row(m, dbMedian));
console.log('\n## Экраны стойки');
for (const m of deskMeasures) console.log(row(m, Number.NaN));
console.log('\n## Машина');
console.log(
  `платформа ${facts.platform}` +
    (facts.memoryGb ? ` · память ${facts.memoryGb.toFixed(0)} ГБ` : '') +
    (facts.swapUsedGb !== undefined ? ` · своп ${facts.swapUsedGb.toFixed(1)} ГБ` : '') +
    (facts.load1 !== undefined ? ` · загрузка ${facts.load1.toFixed(1)} при ${facts.cores ?? '?'} ядрах` : '') +
    (facts.freeDiskGb !== undefined ? ` · диск свободно ${facts.freeDiskGb.toFixed(0)} ГБ` : ''),
);

const findings = explainSlowness({
  ...(dbMeasure ? { db: dbMeasure } : {}),
  api: apiMeasures,
  desk: deskMeasures,
  machine: facts,
});
console.log('\n## Где уходит время');
if (findings.length === 0) console.log('Ничего заметного: все замеры в норме.');
for (const f of findings) {
  console.log(`\n${f.rank}. ${f.title}`);
  console.log(`   ${f.detail}`);
  console.log(`   → ${f.advice}`);
}
console.log(`\nВремя одного рейса в базу: ${ms(dbMedian)}. Числа запросов на вызов — из кода, раздел CALLS.`);
