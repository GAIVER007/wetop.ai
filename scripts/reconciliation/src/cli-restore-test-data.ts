/**
 * Откат удаления демо-данных (план plans/plan-2026-09-13-live-db-clean.md, шаг A): вставляет строки из копии
 * cli-purge-test-data.ts обратно в порядке зависимостей. Повтор безопасен (skipDuplicates).
 * Запуск: npx tsx scripts/reconciliation/src/cli-restore-test-data.ts <папка копии> [--apply]
 *   без --apply — только числа из копии; с --apply — вставка и контрольный пересчёт.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Prisma, createPrismaClient } from '@pms/database';
import { chunk } from './chunk';
import { PURGE_TABLES, decodeTyped, type PurgeTable } from './test-data-purge-rules';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const dirArg = process.argv[2];
if (!dirArg || dirArg.startsWith('--')) throw new Error('укажите папку копии');
const DIR = resolve(ROOT, dirArg);
const APPLY = process.argv.includes('--apply');

const db = createPrismaClient();
type Row = Record<string, unknown>;
const load = (t: PurgeTable): Row[] => {
  const f = resolve(DIR, `${t}.json`);
  if (!existsSync(f)) throw new Error(`в копии нет ${t}.json`);
  return decodeTyped(JSON.parse(readFileSync(f, 'utf-8'))) as Row[];
};
/** JSON-поля журнала: null в createMany передаётся явным DbNull */
const jsonNulls = (r: Row): Row => ({
  ...r,
  before: r.before ?? Prisma.DbNull,
  after: r.after ?? Prisma.DbNull,
});
const insert: Record<PurgeTable, (rows: Row[]) => Promise<{ count: number }>> = {
  guests: (rows) => db.guest.createMany({ data: rows as never, skipDuplicates: true }),
  guestDocuments: (rows) => db.guestDocument.createMany({ data: rows as never, skipDuplicates: true }),
  reservations: (rows) => db.reservation.createMany({ data: rows as never, skipDuplicates: true }),
  reservationItems: (rows) => db.reservationItem.createMany({ data: rows as never, skipDuplicates: true }),
  allocations: (rows) => db.allocation.createMany({ data: rows as never, skipDuplicates: true }),
  stayGuests: (rows) => db.stayGuest.createMany({ data: rows as never, skipDuplicates: true }),
  folios: (rows) => db.folio.createMany({ data: rows as never, skipDuplicates: true }),
  payments: (rows) => db.payment.createMany({ data: rows as never, skipDuplicates: true }),
  charges: (rows) => db.charge.createMany({ data: rows as never, skipDuplicates: true }),
  paymentAllocations: (rows) => db.paymentAllocation.createMany({ data: rows as never, skipDuplicates: true }),
  refunds: (rows) => db.refund.createMany({ data: rows as never, skipDuplicates: true }),
  housekeepingEvents: (rows) => db.housekeepingEvent.createMany({ data: rows as never, skipDuplicates: true }),
  auditLogs: (rows) => db.auditLog.createMany({ data: rows.map(jsonNulls) as never, skipDuplicates: true }),
};

try {
  const order = [...PURGE_TABLES].reverse();
  const data = Object.fromEntries(order.map((t) => [t, load(t)])) as Record<PurgeTable, Row[]>;
  for (const t of order) console.log(`  ${t.padEnd(20)} ${data[t].length}`);
  if (!APPLY) {
    console.log('\nТолько числа из копии. Восстановить — тот же запуск с --apply.');
  } else {
    for (const t of order) {
      let n = 0;
      for (const part of chunk(data[t], 200)) n += (await insert[t](part)).count;
      console.log(`  вставлено ${t.padEnd(20)} ${n} из ${data[t].length}`);
    }
  }
} finally {
  await db.$disconnect();
}
