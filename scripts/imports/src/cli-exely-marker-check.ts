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
const card = await client.booking(booking);
console.log(markerCheckLine(booking, card.customerComment));
