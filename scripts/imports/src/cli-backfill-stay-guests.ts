/**
 * Backfill гостей на проживании (Q-102) для броней, импортированных до миграции `20260910000007`:
 * `adults` / `children` берутся из снимка карточек Exely по `exelyRoomStayId`. Тариф не трогаем —
 * Универсальный API его на проживании не отдаёт. Идемпотентно, пачками одним UPDATE.
 * Запуск: npx tsx scripts/imports/src/cli-backfill-stay-guests.ts [YYYY-MM-DD]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const day = process.argv[2] ?? '2026-09-08';
const DIR = resolve(ROOT, `project-input/exely/api/${day}/bookings`);

const rows: Array<{ stayId: string; adults: number; children: number }> = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const b = JSON.parse(readFileSync(resolve(DIR, f), 'utf-8')) as {
    roomStays?: Array<{ id: string; guestCountInfo?: { adults?: number; children?: number } }>;
  };
  for (const s of b.roomStays ?? [])
    rows.push({
      stayId: s.id,
      adults: Math.max(1, s.guestCountInfo?.adults ?? 1),
      children: s.guestCountInfo?.children ?? 0,
    });
}
console.log(`проживаний в снимке: ${rows.length}`);

const db = createPrismaClient();
try {
  let updated = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const values = part
      .map((r) => `('${r.stayId.replace(/'/g, "''")}', ${r.adults}, ${r.children})`)
      .join(',');
    const n = await db.$executeRawUnsafe(
      `UPDATE reservation_items AS ri
         SET adults = v.adults, children = v.children
         FROM (VALUES ${values}) AS v(stay_id, adults, children)
        WHERE ri.exely_room_stay_id = v.stay_id
          AND (ri.adults <> v.adults OR ri.children <> v.children)`,
    );
    updated += n;
    console.log(`  пачка ${i / CHUNK + 1}: обновлено ${n}`);
  }
  console.log(`Готово. Обновлено проживаний: ${updated}`);
} finally {
  await db.$disconnect();
}
