/**
 * Проверка метки «WETOP <номер брони PMS>» на одной брони Exely — лист смены, переходный период (ADR-064, шаг 9 плана
 * `plans/transition-exely-sync-2026-09-23.md`): увидит ли досинхронизация, что эту бронь смена завела сама.
 * Только чтение: карточка берётся из Exely, наружу — номер брони и итог, без данных гостя и текста комментария.
 *
 * Запуск на машине, где в .env есть EXELY_API_KEY:
 *   npx tsx scripts/imports/src/cli-exely-marker-check.ts <номер брони Exely>
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { exely } from '@pms/integrations';
import { markerCheckLine } from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const booking = process.argv[2];
if (!booking)
  throw new Error(
    'Укажите номер брони Exely: npx tsx scripts/imports/src/cli-exely-marker-check.ts 20261101-513903-1234567890',
  );
const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст — проверку запускает владелец на машине с ключом Exely');
const client = new exely.ExelyUniversalClient({ apiKey: key });
let card: Awaited<ReturnType<typeof client.booking>>;
try {
  card = await client.booking(booking);
} catch (e) {
  // Exely на несуществующий номер отвечает 400 «Booking does not exists» (23.09.2026)
  if (e instanceof exely.ExelyApiError && (e.status === 404 || /does not exist/i.test(e.message))) {
    console.log(
      `Бронь ${booking} в Exely не найдена — проверьте номер: он в карточке брони Exely, вида 20260923-513903-1234567890.`,
    );
    process.exit(1);
  }
  throw e;
}
console.log(markerCheckLine(booking, card.customerComment));
