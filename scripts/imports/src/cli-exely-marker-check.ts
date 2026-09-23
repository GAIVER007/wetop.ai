/**
 * Проверка метки «WETOP <номер брони PMS>» в Exely — лист смены, переходный период (ADR-064, шаг 9 плана
 * `plans/transition-exely-sync-2026-09-23.md`): увидит ли досинхронизация, что эту бронь смена завела сама.
 * Только чтение: карточки берутся из Exely, наружу — номера броней и итог, без данных гостя и текста комментария.
 *
 * Запуск на машине, где в .env есть EXELY_API_KEY:
 *   npx tsx scripts/imports/src/cli-exely-marker-check.ts          — найти метку среди броней, изменённых за сутки
 *   npx tsx scripts/imports/src/cli-exely-marker-check.ts <номер>  — проверить одну бронь
 * Номер не нужен: вписали метку в любую бронь — она изменена сегодня, и поиск её найдёт.
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { exely } from '@pms/integrations';
import {
  EXELY_BOOKING_NUMBER,
  markerFieldLine,
  markerSearchSummary,
  pathsWithText,
  wetopMarker,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст — проверку запускает владелец на машине с ключом Exely');
const client = new exely.ExelyUniversalClient({ apiKey: key });
const arg = process.argv[2];

if (arg && EXELY_BOOKING_NUMBER.test(arg)) {
  let card: Awaited<ReturnType<typeof client.booking>>;
  try {
    card = await client.booking(arg);
  } catch (e) {
    // Exely на несуществующий номер отвечает 400 «Booking does not exists» (23.09.2026)
    if (e instanceof exely.ExelyApiError && (e.status === 404 || /does not exist/i.test(e.message))) {
      console.log(
        `Бронь ${arg} в Exely не найдена — проверьте номер: он в карточке брони Exely, вида 20260923-513903-1234567890.`,
      );
      process.exit(1);
    }
    throw e;
  }
  console.log(markerFieldLine(arg, pathsWithText(card, /wetop/i), card.customerComment));
} else {
  if (arg) console.log(`«${arg}» не похоже на номер брони Exely — ищу метку среди броней, изменённых за сутки.`);
  // Exely понимает окно изменений во времени объекта (Алматы, UTC+5) — как досинхронизация (auto-sync.ts)
  const local = (ms: number) => new Date(ms + 5 * 3_600_000).toISOString().slice(0, 16);
  const now = Date.now();
  const window = { modifiedFrom: local(now - 24 * 3_600_000), modifiedTo: local(now + 5 * 60_000) };
  const numbers = new Set<string>();
  for (const state of ['Active', 'Cancelled'] as const)
    for (const n of await client.searchBookings({ state, ...window })) numbers.add(n);
  let found = 0;
  let elsewhere = 0;
  for (const n of numbers) {
    const card = await client.booking(n);
    // «WETOP» в любом поле карточки: так видно, куда форма Exely кладёт то, что вписала смена
    const paths = pathsWithText(card, /wetop/i);
    if (paths.length === 0) continue;
    if (wetopMarker(card.customerComment)) found += 1;
    else elsewhere += 1;
    console.log(markerFieldLine(n, paths, card.customerComment));
  }
  console.log(markerSearchSummary(numbers.size, found, elsewhere));
}
