/**
 * Удаление демо-данных из рабочей базы (план plans/plan-2026-09-13-live-db-clean.md, шаг A; решение владельца 13.09.2026):
 * брони автотестов, проверок стойки и тестового Channex staging со счетами, платежами, гостями и документами, события
 * уборки проверок и записи журнала действий об удалённом. Брони Exely, витринные брони Channex (-SHOW-), тарифы, цены,
 * фонд, входящие события Channex и очередь в каналы не трогаются. Правила — test-data-purge-rules.ts.
 *
 * Запуск:
 *   npx tsx scripts/reconciliation/src/cli-purge-test-data.ts                 пробный прогон: только числа
 *   npx tsx scripts/reconciliation/src/cli-purge-test-data.ts --apply         копия → удаление → контрольный пересчёт
 *   npx tsx scripts/reconciliation/src/cli-purge-test-data.ts --apply --from-backup=<папка>   продолжить прерванное
 * Копия: project-input/exely/backups/<дата>-test-data/ (вне git). Восстановление — cli-restore-test-data.ts <папка>.
 * В вывод — только счётчики и номера броней, без гостей.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { chunk } from './chunk';
import {
  PURGE_MIN_AGE_MINUTES,
  PURGE_TABLES as TABLES,
  encodeTyped,
  guestsToDelete,
  paymentsToDelete,
  planPurge,
  type PurgeTable as Table,
} from './test-data-purge-rules';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const APPLY = process.argv.includes('--apply');
const FROM_BACKUP = process.argv.find((a) => a.startsWith('--from-backup='))?.split('=')[1];
const now = new Date();
const almatyToday = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/** Новая копия не затирает прежнюю: второй запуск за день пишет в <дата>-test-data-2 и дальше */
const freshBackupDir = () => {
  const base = `project-input/exely/backups/${almatyToday}-test-data`;
  let dir = base;
  for (let n = 2; existsSync(resolve(ROOT, dir, 'manifest.json')); n += 1) dir = `${base}-${n}`;
  return dir;
};
const BACKUP_DIR = resolve(ROOT, FROM_BACKUP ?? freshBackupDir());

type Ids = Record<Table, string[]>;

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const collected: Ids | null = FROM_BACKUP ? readIds() : await collect(property.id);
  if (!collected) {
    process.exitCode = 1;
  } else await run(property.id, collected);
} finally {
  await db.$disconnect();
}

async function run(propertyId: string, ids: Ids): Promise<void> {
  const counts = Object.fromEntries(TABLES.map((t) => [t, ids[t].length])) as Record<Table, number>;
  console.log('\nК удалению:');
  for (const t of TABLES) console.log(`  ${t.padEnd(20)} ${counts[t]}`);
  if (!APPLY) {
    console.log('\nПробный прогон: ничего не удалено. Удалить — тот же запуск с --apply.');
  } else {
    if (!FROM_BACKUP) await backup(ids);
    await purge(ids);
    const left = await remaining(ids);
    const leftTotal = Object.values(left).reduce((a, b) => a + b, 0);
    console.log(`\nКонтрольный пересчёт — осталось строк из копии: ${leftTotal}`);
    for (const t of TABLES) if (left[t]) console.log(`  ${t}: ${left[t]}`);
    if (leftTotal === 0)
      await db.auditLog.create({
        data: {
          entityType: 'Property',
          entityId: propertyId,
          action: 'test-data.purge',
          after: { counts, backup: BACKUP_DIR.replace(`${ROOT}/`, ''), plan: 'plans/plan-2026-09-13-live-db-clean.md' },
        },
      });
    process.exitCode = leftTotal === 0 ? 0 : 1;
  }
}

/** Отбор по правилам и связям; при любой стоп-причине — null, ничего не записывается. */
async function collect(propertyId: string): Promise<Ids | null> {
  const rows = await db.reservation.findMany({
    where: { propertyId },
    select: {
      id: true,
      confirmationNumber: true,
      source: true,
      notes: true,
      createdAt: true,
      items: { select: { id: true, status: true, exelyRoomStayId: true, _count: { select: { allocations: true } } } },
    },
  });
  const pendingChannexEvents = await db.externalEvent.count({
    where: { provider: 'channex', status: { not: 'PROCESSED' } },
  });
  const plan = planPurge(
    rows.map((r) => ({
      ...r,
      items: r.items.map((i) => ({
        id: i.id,
        status: i.status,
        exelyRoomStayId: i.exelyRoomStayId,
        allocations: i._count.allocations,
      })),
    })),
    now,
    { propertyLive: process.env.GUARD_PROPERTY_LIVE === 'true', pendingChannexEvents },
  );
  console.log(
    `броней в базе ${rows.length}; тестовых к удалению ${plan.candidates.length} (автотесты ${plan.byKind.e2e}, номер PMS ${plan.byKind['pms-number']}, тестовый канал ${plan.byKind['channel-test']})`,
  );
  if (plan.skippedFresh.length)
    console.log(`пропущены как свежие (моложе ${PURGE_MIN_AGE_MINUTES} мин): ${plan.skippedFresh.join(', ')}`);
  if (plan.unclassified.length) console.log(`не из Exely, но без признаков теста — остаются: ${plan.unclassified.join(', ')}`);

  const reservationIds = plan.candidates.map((r) => r.id);
  const reservationSet = new Set(reservationIds);
  const itemIds = plan.candidates.flatMap((r) => r.items.map((i) => i.id));
  const folios = await db.folio.findMany({ where: { reservationItemId: { in: itemIds } }, select: { id: true } });
  const folioIds = folios.map((f) => f.id);
  const folioSet = new Set(folioIds);
  const touchedPayments = await db.payment.findMany({
    where: { OR: [{ allocations: { some: { folioId: { in: folioIds } } } }, { refunds: { some: { folioId: { in: folioIds } } } }] },
    select: { id: true, allocations: { select: { folioId: true } }, refunds: { select: { folioId: true } } },
  });
  const pay = paymentsToDelete({
    folioIds: folioSet,
    payments: touchedPayments.map((p) => ({
      id: p.id,
      allocationFolioIds: p.allocations.map((a) => a.folioId),
      refundFolioIds: p.refunds.map((r) => r.folioId),
    })),
  });
  const guestLinks = await db.guest.findMany({
    where: { OR: [{ primaryReservations: { some: { id: { in: reservationIds } } } }, { stays: { some: { reservationItemId: { in: itemIds } } } }] },
    select: {
      id: true,
      exelyPersonId: true,
      primaryReservations: { select: { id: true } },
      stays: { select: { reservationItem: { select: { reservationId: true } } } },
    },
  });
  const guestIds = guestsToDelete({
    reservationIds: reservationSet,
    guests: guestLinks.map((g) => ({
      id: g.id,
      exelyPersonId: g.exelyPersonId,
      reservationIds: [...g.primaryReservations.map((r) => r.id), ...g.stays.map((s) => s.reservationItem.reservationId)],
    })),
  });
  const webSessions = await db.webSession.count({ where: { reservationId: { in: reservationIds } } });
  const blockers = [...plan.blockers, ...pay.blockers];
  if (webSessions) blockers.push(`сессий сайта со ссылкой на удаляемые брони: ${webSessions}`);
  if (blockers.length) {
    console.log(`\nСТОП — удаление не выполняется (${blockers.length}):`);
    for (const b of blockers.slice(0, 40)) console.log(`  - ${b}`);
    return null;
  }

  const [refunds, paymentAllocations, charges, stayGuests, allocations, guestDocuments, housekeepingEvents] =
    await Promise.all([
      db.refund.findMany({ where: { folioId: { in: folioIds } }, select: { id: true } }),
      db.paymentAllocation.findMany({ where: { folioId: { in: folioIds } }, select: { paymentId: true, folioId: true } }),
      db.charge.findMany({ where: { folioId: { in: folioIds } }, select: { id: true } }),
      db.stayGuest.findMany({ where: { reservationItemId: { in: itemIds } }, select: { reservationItemId: true, guestId: true } }),
      db.allocation.findMany({ where: { reservationItemId: { in: itemIds } }, select: { id: true } }),
      db.guestDocument.findMany({ where: { guestId: { in: guestIds } }, select: { id: true } }),
      // события уборки до переключения каналов делали только проверки стойки: живых смен ещё не было
      db.housekeepingEvent.findMany({
        where: { createdAt: { lt: new Date(now.getTime() - PURGE_MIN_AGE_MINUTES * 60_000) } },
        select: { id: true },
      }),
    ]);
  // Журнал: записи о сущностях, которых после удаления не будет (удаляемые сейчас и уже удалённые раньше, например сайты автотестов)
  const doomed: Record<string, Set<string>> = {
    Reservation: reservationSet,
    Guest: new Set(guestIds),
    Folio: folioSet,
    Payment: new Set(pay.paymentIds),
  };
  const [existingSites, audit] = await Promise.all([
    db.trackedSite.findMany({ select: { id: true } }),
    db.auditLog.findMany({
      where: { entityType: { in: ['Reservation', 'Guest', 'Folio', 'Payment', 'TrackedSite'] } },
      select: { id: true, entityType: true, entityId: true },
    }),
  ]);
  const siteSet = new Set(existingSites.map((s) => s.id));
  const existing = {
    Reservation: new Set((await db.reservation.findMany({ select: { id: true } })).map((r) => r.id)),
    Guest: new Set((await db.guest.findMany({ select: { id: true } })).map((g) => g.id)),
    Folio: new Set((await db.folio.findMany({ select: { id: true } })).map((f) => f.id)),
    Payment: new Set((await db.payment.findMany({ select: { id: true } })).map((p) => p.id)),
  };
  const auditIds = audit
    .filter((a) =>
      a.entityType === 'TrackedSite'
        ? !siteSet.has(a.entityId)
        : doomed[a.entityType]!.has(a.entityId) || !existing[a.entityType as keyof typeof existing].has(a.entityId),
    )
    .map((a) => a.id);

  return {
    refunds: refunds.map((r) => r.id),
    paymentAllocations: paymentAllocations.map((p) => `${p.paymentId}|${p.folioId}`),
    charges: charges.map((c) => c.id),
    payments: pay.paymentIds,
    folios: folioIds,
    stayGuests: stayGuests.map((s) => `${s.reservationItemId}|${s.guestId}`),
    allocations: allocations.map((a) => a.id),
    reservationItems: itemIds,
    reservations: reservationIds,
    guestDocuments: guestDocuments.map((d) => d.id),
    guests: guestIds,
    housekeepingEvents: housekeepingEvents.map((h) => h.id),
    auditLogs: auditIds,
  };
}

/** Полные строки всех удаляемых записей — до удаления; без копии удаление не начинается. */
async function backup(ids: Ids): Promise<void> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const pairs = (list: string[]) => list.map((k) => k.split('|') as [string, string]);
  const rows: Record<Table, unknown[]> = {
    refunds: await many(ids.refunds, (part) => db.refund.findMany({ where: { id: { in: part } } })),
    paymentAllocations: await many(ids.paymentAllocations, (part) =>
      db.paymentAllocation.findMany({ where: { OR: pairs(part).map(([paymentId, folioId]) => ({ paymentId, folioId })) } }),
    ),
    charges: await many(ids.charges, (part) => db.charge.findMany({ where: { id: { in: part } } })),
    payments: await many(ids.payments, (part) => db.payment.findMany({ where: { id: { in: part } } })),
    folios: await many(ids.folios, (part) => db.folio.findMany({ where: { id: { in: part } } })),
    stayGuests: await many(ids.stayGuests, (part) =>
      db.stayGuest.findMany({ where: { OR: pairs(part).map(([reservationItemId, guestId]) => ({ reservationItemId, guestId })) } }),
    ),
    allocations: await many(ids.allocations, (part) => db.allocation.findMany({ where: { id: { in: part } } })),
    reservationItems: await many(ids.reservationItems, (part) => db.reservationItem.findMany({ where: { id: { in: part } } })),
    reservations: await many(ids.reservations, (part) => db.reservation.findMany({ where: { id: { in: part } } })),
    guestDocuments: await many(ids.guestDocuments, (part) => db.guestDocument.findMany({ where: { id: { in: part } } })),
    guests: await many(ids.guests, (part) => db.guest.findMany({ where: { id: { in: part } } })),
    housekeepingEvents: await many(ids.housekeepingEvents, (part) => db.housekeepingEvent.findMany({ where: { id: { in: part } } })),
    auditLogs: await many(ids.auditLogs, (part) => db.auditLog.findMany({ where: { id: { in: part } } })),
  };
  for (const t of TABLES) {
    if (rows[t].length !== ids[t].length)
      throw new Error(`копия ${t}: прочитано ${rows[t].length} из ${ids[t].length} — удаление не начато`);
    writeFileSync(resolve(BACKUP_DIR, `${t}.json`), JSON.stringify(encodeTyped(rows[t])));
  }
  writeFileSync(
    resolve(BACKUP_DIR, 'manifest.json'),
    JSON.stringify({ createdAt: now.toISOString(), plan: 'plans/plan-2026-09-13-live-db-clean.md', ids }, null, 1),
  );
  console.log(`\nкопия записана: ${BACKUP_DIR.replace(`${ROOT}/`, '')} (${TABLES.length} таблиц + manifest.json)`);
}

async function many<T>(list: string[], read: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunk(list, 200)) out.push(...(await read(part)));
  return out;
}

/** Удаление по номерам из копии, фаза за фазой, пачками по 200 в транзакции; повтор безопасен. */
async function purge(ids: Ids): Promise<void> {
  const pairs = (list: string[]) => list.map((k) => k.split('|') as [string, string]);
  // Одна пачка — один DELETE, он атомарен сам по себе; порядок фаз держит внешние ключи, повтор удаляет оставшееся
  const phase = async (t: Table, del: (part: string[]) => Promise<{ count: number }>) => {
    let n = 0;
    for (const part of chunk(ids[t], 200)) n += (await del(part)).count;
    console.log(`  удалено ${t.padEnd(20)} ${n}`);
  };
  console.log('\nудаление:');
  await phase('refunds', (p) => db.refund.deleteMany({ where: { id: { in: p } } }));
  await phase('paymentAllocations', (p) =>
    db.paymentAllocation.deleteMany({ where: { OR: pairs(p).map(([paymentId, folioId]) => ({ paymentId, folioId })) } }),
  );
  await phase('charges', (p) => db.charge.deleteMany({ where: { id: { in: p } } }));
  await phase('payments', (p) => db.payment.deleteMany({ where: { id: { in: p } } }));
  await phase('folios', (p) => db.folio.deleteMany({ where: { id: { in: p } } }));
  await phase('stayGuests', (p) =>
    db.stayGuest.deleteMany({ where: { OR: pairs(p).map(([reservationItemId, guestId]) => ({ reservationItemId, guestId })) } }),
  );
  await phase('allocations', (p) => db.allocation.deleteMany({ where: { id: { in: p } } }));
  await phase('reservationItems', (p) => db.reservationItem.deleteMany({ where: { id: { in: p } } }));
  await phase('reservations', (p) => db.reservation.deleteMany({ where: { id: { in: p } } }));
  await phase('guestDocuments', (p) => db.guestDocument.deleteMany({ where: { id: { in: p } } }));
  await phase('guests', (p) => db.guest.deleteMany({ where: { id: { in: p } } }));
  await phase('housekeepingEvents', (p) => db.housekeepingEvent.deleteMany({ where: { id: { in: p } } }));
  await phase('auditLogs', (p) => db.auditLog.deleteMany({ where: { id: { in: p } } }));
}

async function remaining(ids: Ids): Promise<Record<Table, number>> {
  const pairs = (list: string[]) => list.map((k) => k.split('|') as [string, string]);
  const sum = async (t: Table, count: (part: string[]) => Promise<number>) => {
    let n = 0;
    for (const part of chunk(ids[t], 200)) n += await count(part);
    return n;
  };
  return {
    refunds: await sum('refunds', (p) => db.refund.count({ where: { id: { in: p } } })),
    paymentAllocations: await sum('paymentAllocations', (p) =>
      db.paymentAllocation.count({ where: { OR: pairs(p).map(([paymentId, folioId]) => ({ paymentId, folioId })) } }),
    ),
    charges: await sum('charges', (p) => db.charge.count({ where: { id: { in: p } } })),
    payments: await sum('payments', (p) => db.payment.count({ where: { id: { in: p } } })),
    folios: await sum('folios', (p) => db.folio.count({ where: { id: { in: p } } })),
    stayGuests: await sum('stayGuests', (p) =>
      db.stayGuest.count({ where: { OR: pairs(p).map(([reservationItemId, guestId]) => ({ reservationItemId, guestId })) } }),
    ),
    allocations: await sum('allocations', (p) => db.allocation.count({ where: { id: { in: p } } })),
    reservationItems: await sum('reservationItems', (p) => db.reservationItem.count({ where: { id: { in: p } } })),
    reservations: await sum('reservations', (p) => db.reservation.count({ where: { id: { in: p } } })),
    guestDocuments: await sum('guestDocuments', (p) => db.guestDocument.count({ where: { id: { in: p } } })),
    guests: await sum('guests', (p) => db.guest.count({ where: { id: { in: p } } })),
    housekeepingEvents: await sum('housekeepingEvents', (p) => db.housekeepingEvent.count({ where: { id: { in: p } } })),
    auditLogs: await sum('auditLogs', (p) => db.auditLog.count({ where: { id: { in: p } } })),
  };
}

function readIds(): Ids {
  const f = resolve(BACKUP_DIR, 'manifest.json');
  if (!existsSync(f)) throw new Error(`нет ${f}`);
  return (JSON.parse(readFileSync(f, 'utf-8')) as { ids: Ids }).ids;
}
