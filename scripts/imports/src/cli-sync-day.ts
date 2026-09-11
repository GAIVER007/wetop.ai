/**
 * Свежие брони на дату из Exely в PMS — для ежедневного двойного ввода (PLAN неделя 6, Gate 8).
 * Exely только на чтение: берём номера активных броней, затрагивающих сутки, тянем карточки и импортируем.
 * Гости анонимизируются (ADR-018). Идемпотентно: повтор ничего не дублирует.
 * Запуск: npx tsx scripts/imports/src/cli-sync-day.ts [YYYY-MM-DD] [--since=YYYY-MM-DD]
 *   --since — добавить все брони, ИЗМЕНЁННЫЕ с этой даты (активные и отменённые). Без него PMS не увидит
 *   отмену и перенос дат: такая бронь перестаёт затрагивать сутки и в выборку по периоду не попадает.
 */
import { pseudonymSalt } from '@pms/shared';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '@pms/database';
import { exely } from '@pms/integrations';
import type { ReservationImportRecord } from './exely/index';
import {
  LUXX_APARTS_PROPERTY,
  adaptUniBooking,
  importReservations,
  normalizeExelyReservation,
} from './exely/index';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const almatyToday = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const DATE = process.argv[2] ?? almatyToday;
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error('дата YYYY-MM-DD');
const next = new Date(`${DATE}T00:00:00Z`);
next.setUTCDate(next.getUTCDate() + 1);
const TO = next.toISOString().slice(0, 10);

const key = process.env.EXELY_API_KEY;
if (!key) throw new Error('EXELY_API_KEY пуст');
// соль не хардкодится: с известной солью псевдоним гостя перебирается по словарю
const salt = pseudonymSalt();

const since = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1];
if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since))
  throw new Error('--since=YYYY-MM-DD');

const client = new exely.ExelyUniversalClient({ apiKey: key });
const affecting = await client.searchBookings({
  state: 'Active',
  affectsPeriodFrom: `${DATE}T00:00`,
  affectsPeriodTo: `${TO}T00:00`,
});
console.log(`Exely: активных броней на ${DATE}: ${affecting.length}`);

const all = new Set(affecting);
if (since) {
  const modifiedTo = `${TO}T00:00`;
  for (const state of ['Active', 'Cancelled'] as const) {
    const changed = await client.searchBookings({
      state,
      modifiedFrom: `${since}T00:00`,
      modifiedTo,
    });
    console.log(`  изменённых с ${since} (${state}): ${changed.length}`);
    for (const n of changed) all.add(n);
  }
}
const numbers = [...all];
if (since) console.log(`итого карточек к переносу: ${numbers.length}`);

const rooms = await client.rooms();
const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
const typeMap = new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`]));

const records: ReservationImportRecord[] = [];
for (const [i, n] of numbers.entries()) {
  const card = await client.booking(n);
  records.push(normalizeExelyReservation(adaptUniBooking(card), { roomMap, typeMap }));
  if ((i + 1) % 25 === 0) console.log(`  карточек получено ${i + 1}/${numbers.length}`);
}
console.log(
  `карточек: ${records.length}, проживаний: ${records.reduce((a, r) => a + r.items.length, 0)}`,
);

const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });
  const report = await db.$transaction(
    (tx) => importReservations(tx, records, { propertyId: property.id, anonymizeSalt: salt }),
    { timeout: 900_000, maxWait: 30_000 },
  );
  console.log(
    `брони ${report.reservations.created}/${report.reservations.updated}, ` +
      `проживания ${report.items.created}/${report.items.updated}, ` +
      `назначения ${report.allocations.created}/${report.allocations.updated}, ` +
      `без ячейки ${report.unassigned}, конфликтов ${report.conflicts.length}`,
  );
  for (const c of report.conflicts)
    console.log(
      `  конфликт: ${c.confirmationNumber} ячейка ${c.exelyRoomNumber} ${c.arrivalDate} → ${c.departureDate} занята ${c.conflictsWith}` +
        (c.movedTo ? ` → посажен на ${c.movedTo}` : ' → свободной ячейки в категории нет'),
    );
  // Массовый перенос меняет остатки мимо очереди дельт: каналы об этом не узнают, пока не сделать
  // полную выгрузку. Делаем её сразу через API PMS (сверка 11.09.2026 нашла 6 опасных расхождений именно
  // после импорта); если API недоступен — говорим, что сделать руками.
  await fullSyncChannels();
} finally {
  await db.$disconnect();
}

/** Полная выгрузка остатков и ограничений в Channex после импорта — иначе канал продаёт по старому остатку. */
async function fullSyncChannels(): Promise<void> {
  if (!process.env.CHANNEX_API_KEY?.trim()) return;
  const api = process.env.APP_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${api}/channels/channex/sync?days=365&trigger=import`, {
      method: 'POST',
    });
    const body = (await res.json()) as {
      tasks?: string[];
      availabilityValues?: number;
      message?: string;
    };
    if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
    console.log(
      `\nполная выгрузка в Channex выполнена: остатков ${body.availabilityValues}, задачи ${(body.tasks ?? []).join(', ')}`,
    );
  } catch (e) {
    console.log(
      `\nВНИМАНИЕ: полная выгрузка в Channex не выполнена (${(e as Error).message}) — остатки в каналах устарели. Выполните руками:\n` +
        "  curl -s -X POST 'http://localhost:3001/channels/channex/sync?days=365'\n" +
        '  npx tsx scripts/reconciliation/src/cli-channex-ari.ts 30\n',
    );
  }
}
