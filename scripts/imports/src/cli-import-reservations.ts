/**
 * Импорт броней Exely в БД: из скачанных карточек (project-input/exely/api/<дата>/bookings) либо живьём.
 * Запуск: npx tsx scripts/imports/src/exely/cli-import-reservations.ts 2026-09-08 [--set=future|all]
 * Гости анонимизируются (ADR-018): соль ANONYMIZE_SALT из .env либо dev-умолчание. Без анонимизации — запрещено.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import type { exely } from '@pms/integrations';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  importReservations,
  normalizeExelyReservation,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const set = (process.argv.find((a) => a.startsWith('--set='))?.split('=')[1] ?? 'future') as
  'future' | 'all';
const DIR = resolve(ROOT, `project-input/exely/api/${day}`);
const salt = process.env.ANONYMIZE_SALT || 'dev-salt-luxx-2026';

const rooms = JSON.parse(readFileSync(resolve(DIR, 'rooms.json'), 'utf-8')) as exely.UniRoom[];
const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
const typeMap = new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`]));
const wanted =
  set === 'future'
    ? new Set(
        JSON.parse(
          readFileSync(resolve(DIR, 'booking-numbers-future-active.json'), 'utf-8'),
        ) as string[],
      )
    : null;
const files = readdirSync(resolve(DIR, 'bookings')).filter(
  (f) => f.endsWith('.json') && (!wanted || wanted.has(f.slice(0, -5))),
);
const records = files.map((f) =>
  normalizeExelyReservation(
    adaptUniBooking(
      JSON.parse(readFileSync(resolve(DIR, 'bookings', f), 'utf-8')) as exely.UniBooking,
    ),
    { roomMap, typeMap },
  ),
);
console.log(
  `набор ${set}: карточек ${files.length}, проживаний ${records.reduce((a, r) => a + r.items.length, 0)}; анонимизация: да`,
);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const report = await db.$transaction(
    (tx) => importReservations(tx, records, { propertyId: property.id, anonymizeSalt: salt }),
    { timeout: 600_000, maxWait: 30_000 },
  );
  console.log('Импорт завершён. Создано / обновлено:');
  for (const k of ['reservations', 'items', 'guests', 'allocations'] as const)
    console.log(`  ${k.padEnd(14)} ${report[k].created} / ${report[k].updated}`);
  console.log(
    `  связей гость↔проживание: ${report.stayGuests.linked}; проживаний без единицы: ${report.unassigned}`,
  );
} finally {
  await db.$disconnect();
}
