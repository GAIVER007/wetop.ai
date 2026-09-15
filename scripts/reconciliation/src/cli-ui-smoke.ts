/**
 * Обход всех экранов WETOP на живом API — только чтение (план wetop-live-data, шаг 5).
 * Динамические экраны берутся из живых данных: бронь из «Сегодня», её гость, первая комната и первая койка.
 * Запуск: npx tsx scripts/reconciliation/src/cli-ui-smoke.ts   (стойка WEB_URL, по умолчанию http://127.0.0.1:3000)
 * Пишет reports/ui-smoke-YYYY-MM-DD.md. Код выхода 1, если хоть один экран показал ошибку.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectPage, pageOk, smokeReport, type PageCheck } from './ui-smoke';
import { serviceFetch } from '../../lib/service-api';

const ROOT = resolve(import.meta.dirname, '../../..');
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000';
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';
const TIMEOUT_MS = 120_000;

const json = async <T>(path: string): Promise<T> => {
  const res = await serviceFetch(`${API}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

const STATIC = [
  '/today', '/chessboard', '/guests', '/reservations/new',
  '/rooms', '/rooms/categories', '/rooms/availability', '/inventory', '/rates',
  '/hotel-settings', '/hotel-settings/check-in', '/hotel-settings/penalties', '/hotel-settings/services',
  '/hotel-settings/description', '/hotel-settings/photos', '/hotel-settings/amenities',
  '/management/statistics', '/finance',
  '/channel-manager', '/channels', '/connections', '/analytics', '/analytics/setup',
  '/journal', '/incidents',
  // экраны premium UI (PR #2, ADR-035): справочник броней, сообщения, профиль, вход
  '/reservations', '/profile', '/login',
];

const day = await json<{ arrivals: Array<{ confirmationNumber: string }>; inHouse: Array<{ confirmationNumber: string }> }>('/desk/today');
const number = (day.inHouse[0] ?? day.arrivals[0])?.confirmationNumber;
const card = number
  ? await json<{ primaryGuest: { id: string } | null }>(`/reservations/${encodeURIComponent(number)}`)
  : null;
const units = await json<Array<{ code: string; kind: 'ROOM' | 'BED' }>>('/inventory/units');
const dynamic = [
  number && `/reservations/${encodeURIComponent(number)}`,
  card?.primaryGuest && `/guests/${card.primaryGuest.id}`,
  units.find((u) => u.kind === 'ROOM') && `/units/${units.find((u) => u.kind === 'ROOM')!.code}`,
  units.find((u) => u.kind === 'BED') && `/units/${units.find((u) => u.kind === 'BED')!.code}`,
].filter((r): r is string => typeof r === 'string');

const checks: PageCheck[] = [];
for (const route of [...STATIC, ...dynamic]) {
  const started = Date.now();
  try {
    const res = await fetch(`${WEB}${route}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const html = await res.text();
    checks.push(inspectPage(route, res.status, Date.now() - started, html));
  } catch (e) {
    checks.push({ route, status: 0, ms: Date.now() - started, heading: null, markers: ['NEXT_ERROR'], apiErrors: [(e as Error).message] });
  }
  const c = checks.at(-1)!;
  console.log(`${pageOk(c) ? 'ок  ' : 'FAIL'} ${route} ${c.status} ${(c.ms / 1000).toFixed(1)} с ${c.markers.join(',')}`);
}

const takenAt = new Date();
mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
const out = resolve(ROOT, `reports/ui-smoke-${takenAt.toISOString().slice(0, 10)}.md`);
writeFileSync(out, smokeReport(checks, takenAt, WEB));
console.log(`→ ${out}`);
process.exit(checks.every(pageOk) ? 0 : 1);
