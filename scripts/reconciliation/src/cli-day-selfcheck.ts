/**
 * Вечерняя проверка суток без Exely (ADR-052): «Главная» против шахматки против карточек.
 * Запуск: npx tsx scripts/reconciliation/src/cli-day-selfcheck.ts [YYYY-MM-DD]  (по умолчанию сегодня, Алматы)
 * Пишет отчёт в REPORTS_DIR или reports/. Код выхода 1 при расхождении (предупреждения не валят).
 * Ходит в API служебным ключом (SERVICE_API_KEY) — людей и их данные не печатает, только номера броней.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { serviceFetch } from '../../lib/service-api';
import { reportTarget } from '../../lib/desk-page';
import { checkDay, verdict, type BoardSnapshot, type DaySnapshot } from './day-selfcheck';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const DATE = process.argv[2] ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error('дата YYYY-MM-DD');

const get = async <T>(path: string): Promise<T> => {
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

type ApiDay = DaySnapshot;
type ApiBoard = {
  rows: Array<{ cells: Array<{ date: string; stay?: { confirmationNumber: string } | null }>; unit: { code: string } }>;
  byCategory: Record<string, Record<string, { occupied: number }>>;
  unassigned: Array<{ confirmationNumber: string; categoryName: string; arrivalDate: string; departureDate: string }>;
};

const day = await get<ApiDay>(`/desk/today?date=${DATE}`);
const raw = await get<ApiBoard>(`/chessboard?from=${DATE}&to=${DATE}`);

const occupiedByNumber: Record<string, string[]> = {};
for (const r of raw.rows) {
  for (const c of r.cells) {
    if (c.date !== DATE || !c.stay) continue;
    (occupiedByNumber[c.stay.confirmationNumber] ??= []).push(r.unit.code);
  }
}
const board: BoardSnapshot = {
  occupiedByNumber,
  unassigned: raw.unassigned
    .filter((u) => u.arrivalDate <= DATE && DATE < u.departureDate)
    .map((u) => ({ confirmationNumber: u.confirmationNumber, categoryName: u.categoryName })),
  occupiedCells: Object.values(raw.byCategory[DATE] ?? {}).reduce((s, c) => s + c.occupied, 0),
};

const findings = checkDay(day, board);
const line = verdict(findings);
for (const f of findings) console.log(`${f.level === 'fail' ? 'FAIL' : 'ПРЕД'} ${f.what}`);
console.log(line);

const md = [
  `# Сутки внутри PMS — ${DATE}`,
  '',
  `Проверено ${new Date().toISOString()}. Источник: «Главная» (\`/desk/today\`) и шахматка (\`/chessboard\`).`,
  'Exely не участвует (ADR-052): сверяется связность одной системы, а не совпадение двух.',
  '',
  `| Заезды | Выезды | Проживают | Занятых клеток | Без ячейки |`,
  `|---|---|---|---|---|`,
  `| ${day.counts.arrivals} | ${day.counts.departures} | ${day.counts.inHouse} | ${board.occupiedCells} | ${board.unassigned.length} |`,
  '',
  findings.length ? '| Уровень | Что |\n|---|---|' : 'Замечаний нет.',
  ...findings.map((f) => `| ${f.level === 'fail' ? '**FAIL**' : 'предупреждение'} | ${f.what} |`),
  '',
  `**${line}**`,
  '',
].join('\n');
const out = reportTarget(ROOT, process.env, `day-selfcheck-${DATE}.md`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md);
console.log(`→ ${out}`);
process.exit(findings.some((f) => f.level === 'fail') ? 1 : 0);
