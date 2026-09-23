/**
 * Импорт броней Exely в БД: из скачанных карточек (project-input/exely/api/<дата>/bookings) либо живьём.
 * Запуск: npx tsx scripts/imports/src/cli-import-reservations.ts 2026-09-08 [--set=future|all] [--skip=N]
 * --skip=N — пропустить первые N броней (продолжение после обрыва; импорт идемпотентен, пачки по 50)
 * Гости анонимизируются (ADR-018): соль ANONYMIZE_SALT из .env (запасной вариант — PII_ENCRYPTION_KEY);
 * с PII_STORAGE=real (только боевая база в РК) — переносятся как есть (`importPiiSalt`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import type { exely } from '@pms/integrations';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  importPiiSalt,
  importReservations,
  normalizeEach,
  normalizeExelyReservation,
  screenRecords,
  type SeatFollow,
  type StatusKept,
  type VanishedStay,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const set = (process.argv.find((a) => a.startsWith('--set='))?.split('=')[1] ?? 'future') as
  'future' | 'all';
const DIR = resolve(ROOT, `project-input/exely/api/${day}`);
// соль не хардкодится: с известной солью псевдоним гостя перебирается по словарю;
// null — PII_STORAGE=real, боевая база в РК: гости переносятся как есть
const salt = importPiiSalt();
const skip = Number(process.argv.find((a) => a.startsWith('--skip='))?.split('=')[1] ?? 0);
if (!Number.isInteger(skip) || skip < 0) throw new Error('--skip=N — целое от 0');

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
// Q-165: карточка, которую нормализатор не разобрал, пропускается — остальные переносятся
const normalized = normalizeEach(
  files,
  (f) => f.slice(0, -5),
  (f) =>
    normalizeExelyReservation(
      adaptUniBooking(
        JSON.parse(readFileSync(resolve(DIR, 'bookings', f), 'utf-8')) as exely.UniBooking,
      ),
      { roomMap, typeMap },
    ),
);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  // До транзакции (Q-165): бронь с категорией или ячейкой, которых нет в фонде PMS, — пропуск с причиной
  const [knownTypes, exelyUnits] = await Promise.all([
    db.accommodationType.findMany({ where: { propertyId: property.id }, select: { code: true } }),
    db.inventoryUnit.findMany({
      where: { accommodationType: { propertyId: property.id }, exelyRoomNumber: { not: null } },
      select: { exelyRoomNumber: true },
    }),
  ]);
  const screened = screenRecords(normalized.records, {
    accommodationTypeCodes: new Set(knownTypes.map((t) => t.code)),
    exelyRoomNumbers: new Set(exelyUnits.map((u) => u.exelyRoomNumber!)),
  });
  const records = screened.importable;
  console.log(
    `набор ${set}: карточек ${files.length}, к переносу ${records.length}, проживаний ${records.reduce((a, r) => a + r.items.length, 0)}; анонимизация: ${salt ? 'да' : 'нет (PII_STORAGE=real)'}`,
  );
  for (const k of [...normalized.skipped, ...screened.skipped]) console.log(`  ПРОПУЩЕНА (Q-165): ${k.reason}`);
  // Пачками по CHUNK броней, каждая в своей транзакции: импорт идемпотентен, а один запрос до Сингапура ~0,1 с,
  // и полный набор (~1 700 карточек × ~10 запросов) в 10-минутный лимит одной транзакции не помещается.
  const CHUNK = 50;
  const total = {
    reservations: { created: 0, updated: 0 },
    items: { created: 0, updated: 0 },
    guests: { created: 0, updated: 0 },
    allocations: { created: 0, updated: 0, released: 0 },
    stayGuests: { linked: 0 },
    unassigned: 0,
    paymentsImported: 0,
    // снимок с диска — не живая карточка: cancelVanished не передаётся, vanished всегда пуст (ADR-050)
    vanished: [] as VanishedStay[],
    vanishedKept: [] as Array<VanishedStay & { reason: 'checked-in' | 'paid' }>,
    retained: 0,
    statusKept: [] as StatusKept[],
    reseated: [] as SeatFollow[],
    unseated: [] as SeatFollow[],
    conflicts: [] as Array<{
      confirmationNumber: string;
      exelyRoomNumber: string;
      arrivalDate: string;
      departureDate: string;
      conflictsWith: string;
      movedTo: string | null;
      from: string;
      to: string;
    }>,
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = skip; i < records.length; i += CHUNK) {
    const part = records.slice(i, i + CHUNK);
    let report: Awaited<ReturnType<typeof importReservations>> | undefined;
    // Обрыв соединения до Supabase (Сингапур) — повторяем пачку: транзакция откатилась, импорт идемпотентен
    for (let attempt = 1; ; attempt += 1) {
      try {
        report = await db.$transaction(
          (tx) => importReservations(tx, part, { propertyId: property.id, anonymizeSalt: salt }),
          { timeout: 900_000, maxWait: 30_000 },
        );
        break;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        if (attempt >= 3 || !/terminated|ECONNRESET|ETIMEDOUT|timeout|closed/i.test(msg)) throw e;
        console.log(
          `  пачка ${i / CHUNK + 1}: обрыв связи (${msg.slice(0, 60)}), повтор ${attempt + 1}/3 через 15 с`,
        );
        await sleep(15_000);
      }
    }
    for (const k of ['reservations', 'items', 'guests'] as const) {
      total[k].created += report[k].created;
      total[k].updated += report[k].updated;
    }
    total.allocations.created += report.allocations.created;
    total.allocations.updated += report.allocations.updated;
    total.allocations.released += report.allocations.released;
    total.stayGuests.linked += report.stayGuests.linked;
    total.unassigned += report.unassigned;
    total.paymentsImported += report.paymentsImported;
    total.vanished.push(...report.vanished);
    total.vanishedKept.push(...report.vanishedKept);
    total.retained += report.retained;
    total.statusKept.push(...report.statusKept);
    total.reseated.push(...report.reseated);
    total.unseated.push(...report.unseated);
    total.conflicts.push(...report.conflicts);
    console.log(
      `  пачка ${i / CHUNK + 1}/${Math.ceil(records.length / CHUNK)}: ${part.length} броней — ок`,
    );
  }
  const report = total;
  console.log('Импорт завершён. Создано / обновлено:');
  for (const k of ['reservations', 'items', 'guests', 'allocations'] as const)
    console.log(`  ${k.padEnd(14)} ${report[k].created} / ${report[k].updated}`);
  console.log(
    `  связей гость↔проживание: ${report.stayGuests.linked}; проживаний без единицы: ${report.unassigned}; назначений снято (отмены/незаезды): ${report.allocations.released}`,
  );
  console.log(`  платежей перенесено из Exely (EXTERNAL): ${report.paymentsImported}`);
  console.log(`  удержаний «оплачено в Exely, отменено без возврата» (ADR-051): ${report.retained}`);
  for (const k of report.statusKept)
    console.log(
      `  СТАТУС НЕ ТРОНУТ (Q-162): ${k.confirmationNumber}${k.exelyRoomStayId ? ` проживание ${k.exelyRoomStayId}` : ''} — в PMS ${k.pmsStatus}, в Exely ${k.exelyStatus}; разобрать руками`,
    );
  for (const f of report.reseated)
    console.log(
      `  посадка стойки продолжена (Q-164): ${f.confirmationNumber} ${f.arrivalDate} → ${f.departureDate} на ${f.units.join(', ')}`,
    );
  for (const f of report.unseated)
    console.log(
      `  ПОСАДКА СНЯТА (Q-164): ${f.confirmationNumber} ${f.arrivalDate} → ${f.departureDate} — ${f.units.join(', ')} занята на новые ночи; бронь без ячейки`,
    );
  if (report.vanished.length) {
    console.log(`  исчезли из карточек Exely и отменены (ADR-050): ${report.vanished.length}`);
    for (const v of report.vanished)
      console.log(`    ${v.confirmationNumber} проживание ${v.exelyRoomStayId} ${v.arrivalDate} → ${v.departureDate}`);
  }
  if (report.conflicts.length) {
    console.log(`  КОНФЛИКТЫ ячеек (назначение пропущено): ${report.conflicts.length}`);
    for (const c of report.conflicts)
      console.log(
        `    ${c.confirmationNumber} комната ${c.exelyRoomNumber} ${c.arrivalDate} → ${c.departureDate} пересекается с ${c.conflictsWith} (${c.from} → ${c.to})` +
          (c.movedTo ? ` → посажен на ${c.movedTo}` : ' → свободной ячейки в категории нет'),
      );
  }
  // Массовый перенос меняет остатки мимо очереди дельт: каналы об этом не узнают, пока не сделать
  // полную выгрузку. Пока она не сделана, канал продаёт по старому остатку — прямой риск овербукинга.
  console.log(
    '\nВНИМАНИЕ: остатки в каналах устарели. Выполните полную выгрузку:\n' +
      "  curl -s -X POST 'http://localhost:3001/channels/channex/sync?days=365'\n" +
      '  npx tsx scripts/reconciliation/src/cli-channex-ari.ts 30\n',
  );
} finally {
  await db.$disconnect();
}
