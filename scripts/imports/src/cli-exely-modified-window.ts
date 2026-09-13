/**
 * В каком часовом поясе Exely понимает `modifiedFrom` / `modifiedTo` поиска броней (ADR-032).
 * Документация (universal-pms-api-1.5.0.md, «Поиск бронирований») пояс для поиска не называет,
 * а `lastModified` в карточке брони — UTC. Сравниваем: одно и то же окно «последние 90 минут»
 * записано в UTC и во времени Алматы; чьи карточки лежат внутри окна по `lastModified` — тот и пояс.
 * Только чтение Exely, без персональных данных: печатаются номера окон, счётчики и метки времени.
 * Запуск: npx tsx scripts/imports/src/cli-exely-modified-window.ts
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { exely } from '@pms/integrations';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст');
const client = new exely.ExelyUniversalClient({ apiKey: key });

const now = Date.now();
const LOOKBACK_MIN = 90;
/** yyyy-MM-ddTHH:mm для момента со сдвигом offsetMin от UTC */
const fmt = (ms: number, offsetMin: number) =>
  new Date(ms + offsetMin * 60_000).toISOString().slice(0, 16);

for (const [name, offset] of [
  ['UTC', 0],
  ['Алматы (UTC+5)', 300],
] as const) {
  const from = fmt(now - LOOKBACK_MIN * 60_000, offset);
  const to = fmt(now + 5 * 60_000, offset);
  const numbers = new Set<string>();
  for (const state of ['Active', 'Cancelled'] as const)
    for (const n of await client.searchBookings({ state, modifiedFrom: from, modifiedTo: to }))
      numbers.add(n);
  const ages: number[] = [];
  for (const n of [...numbers].slice(0, 8)) {
    const card = await client.booking(n);
    if (card.lastModified) ages.push(Math.round((now - Date.parse(card.lastModified)) / 60_000));
  }
  ages.sort((a, b) => a - b);
  const inside = ages.filter((a) => a >= -5 && a <= LOOKBACK_MIN).length;
  console.log(
    `окно как ${name}: ${from} → ${to} · броней ${numbers.size} · проверено ${ages.length} · ` +
      `lastModified внутри последних ${LOOKBACK_MIN} мин: ${inside} · возраст, мин: ${ages.join(', ') || '—'}`,
  );
}
console.log(
  '\nВывод: пояс поиска тот, у чьего окна карточки лежат внутри последних 90 минут. ' +
    'Если броней в окне нет, повторить позже.',
);
