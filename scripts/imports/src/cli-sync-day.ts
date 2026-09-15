/**
 * Свежие брони из Exely в PMS — для ежедневного двойного ввода (PLAN неделя 6, Gate 8) и автосинхронизации (ADR-032).
 * Exely только на чтение: берём номера броней, тянем карточки и импортируем. Гости анонимизируются (ADR-018).
 * Идемпотентно: повтор ничего не дублирует. Каждый успешный прогон пишет в журнал `exely.sync` — по нему сторож
 * (`exely.stale`) и экран свежести знают, когда была синхронизация.
 *
 * Руками: npx tsx scripts/imports/src/cli-sync-day.ts [YYYY-MM-DD] [--since=YYYY-MM-DD]
 *   брони, затрагивающие сутки; --since — добавить все брони, ИЗМЕНЁННЫЕ с этой даты (активные и отменённые).
 *   Без него PMS не увидит отмену и перенос дат: такая бронь перестаёт затрагивать сутки. После массового
 *   импорта — полная выгрузка ARI в Channex (сертификация, п. 13).
 * Автоматически (launchd `kz.luxx.pms.exely-sync`, раз в 15 мин): npx tsx scripts/imports/src/cli-sync-day.ts --auto
 *   брони, изменённые с прошлого прогона; раз в час — ещё и все активные брони текущих суток. В Channex уходит
 *   только дельта остатков по затронутым категориям и ночам, через очередь ARI; без изменений — ни одного запроса.
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
import {
  autoSyncWindow,
  availabilityChange,
  type AutoSyncRun,
  type AvailabilityChange,
  type StayAvailabilityState,
} from './exely/auto-sync';

const ROOT = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(ROOT, '.env'), quiet: true });
const startedAt = new Date();
const almatyToday = new Date(startedAt.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const AUTO = process.argv.includes('--auto');
const DATE = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? almatyToday;
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) throw new Error('дата YYYY-MM-DD');
if (AUTO && DATE !== almatyToday) throw new Error('--auto работает только на текущие сутки');
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
if (AUTO && since) throw new Error('--auto и --since вместе не используются');

const api = process.env.APP_API_URL ?? 'http://localhost:3001';
const client = new exely.ExelyUniversalClient({ apiKey: key });
const db = createPrismaClient();
try {
  const property = await db.property.findFirstOrThrow({
    where: { name: LUXX_APARTS_PROPERTY.name },
    select: { id: true },
  });

  let lastRun: AutoSyncRun | null = null;
  if (AUTO) {
    const last = await db.auditLog.findFirst({
      where: { action: 'exely.sync', after: { path: ['mode'], equals: 'auto' } },
      orderBy: { createdAt: 'desc' },
      select: { after: true },
    });
    const prev = last?.after as { startedAt?: string; fullPassAt?: string | null } | null;
    if (prev?.startedAt)
      lastRun = {
        startedAt: new Date(prev.startedAt),
        fullPassAt: prev.fullPassAt ? new Date(prev.fullPassAt) : null,
      };
  }
  const window = AUTO ? autoSyncWindow(startedAt, lastRun) : null;
  const fullPass = !window || window.fullPass;

  const all = new Set<string>();
  if (fullPass) {
    const affecting = await client.searchBookings({
      state: 'Active',
      affectsPeriodFrom: `${DATE}T00:00`,
      affectsPeriodTo: `${TO}T00:00`,
    });
    console.log(`Exely: активных броней на ${DATE}: ${affecting.length}`);
    for (const n of affecting) all.add(n);
  }
  // Exely понимает modifiedFrom/modifiedTo во времени объекта (cli-exely-modified-window.ts, 13.09.2026)
  const modified = window
    ? { from: window.modifiedFrom, to: window.modifiedTo }
    : since
      ? { from: `${since}T00:00`, to: `${TO}T00:00` }
      : null;
  if (modified) {
    for (const state of ['Active', 'Cancelled'] as const) {
      const changed = await client.searchBookings({
        state,
        modifiedFrom: modified.from,
        modifiedTo: modified.to,
      });
      console.log(`  изменённых ${modified.from} → ${modified.to} (${state}): ${changed.length}`);
      for (const n of changed) all.add(n);
    }
  }
  const numbers = [...all];
  console.log(`итого карточек к переносу: ${numbers.length}`);

  const records: ReservationImportRecord[] = [];
  if (numbers.length > 0) {
    const rooms = await client.rooms();
    const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
    const typeMap = new Map(rooms.map((r) => [r.roomTypeId, `exely-${r.roomTypeId}`]));
    for (const [i, n] of numbers.entries()) {
      const card = await client.booking(n);
      records.push(normalizeExelyReservation(adaptUniBooking(card), { roomMap, typeMap }));
      if ((i + 1) % 25 === 0) console.log(`  карточек получено ${i + 1}/${numbers.length}`);
    }
  }
  const stays = records.reduce((a, r) => a + r.items.length, 0);
  console.log(`карточек: ${records.length}, проживаний: ${stays}`);

  // Состояние проживаний до импорта: по нему автосинхронизация видит, сдвинулся ли остаток канала
  const sold = (status: string) => status !== 'CANCELLED' && status !== 'NO_SHOW';
  const before = new Map<string, StayAvailabilityState>();
  if (AUTO && stays > 0) {
    const rows = await db.reservationItem.findMany({
      where: { exelyRoomStayId: { in: records.flatMap((r) => r.items.map((i) => i.exelyRoomStayId)) } },
      select: {
        exelyRoomStayId: true,
        arrivalDate: true,
        departureDate: true,
        status: true,
        accommodationType: { select: { code: true } },
      },
    });
    for (const row of rows)
      if (row.exelyRoomStayId)
        before.set(row.exelyRoomStayId, {
          accommodationTypeCode: row.accommodationType.code,
          arrivalDate: row.arrivalDate.toISOString().slice(0, 10),
          departureDate: row.departureDate.toISOString().slice(0, 10),
          sold: sold(row.status),
        });
  }

  let summary: Record<string, unknown> = { reservations: { created: 0, updated: 0 } };
  if (records.length > 0) {
    const report = await db.$transaction(
      (tx) => importReservations(tx, records, { propertyId: property.id, anonymizeSalt: salt }),
      { timeout: 900_000, maxWait: 30_000 },
    );
    console.log(
      `брони ${report.reservations.created}/${report.reservations.updated}, ` +
        `проживания ${report.items.created}/${report.items.updated}, ` +
        `назначения ${report.allocations.created}/${report.allocations.updated}, ` +
        `без ячейки ${report.unassigned}, конфликтов ${report.conflicts.length}, ` +
        `исчезли из Exely ${report.vanished.length}, удержаний ${report.retained}`,
    );
    for (const v of report.vanished)
      console.log(
        `  исчезло из карточки Exely: ${v.confirmationNumber} проживание ${v.exelyRoomStayId} ${v.arrivalDate} → ${v.departureDate} — отменено (ADR-046)`,
      );
    for (const c of report.conflicts)
      console.log(
        `  конфликт: ${c.confirmationNumber} ячейка ${c.exelyRoomNumber} ${c.arrivalDate} → ${c.departureDate} занята ${c.conflictsWith}` +
          (c.split
            ? ` → до ${c.split.at} на ${c.movedTo}, с ${c.split.at} на ${c.split.to} (переезд внутри срока, ADR-044)`
            : c.movedTo
              ? ` → посажен на ${c.movedTo}`
              : ' → свободной ячейки в категории нет'),
      );
    summary = {
      reservations: report.reservations,
      items: report.items,
      unassigned: report.unassigned,
      conflicts: report.conflicts.length,
      vanished: report.vanished.length,
      retained: report.retained,
    };
  }

  let ari: 'full' | 'delta' | 'none' | 'failed' = 'none';
  let change: AvailabilityChange | null = null;
  if (AUTO) {
    const after = new Map<string, StayAvailabilityState>();
    for (const r of records)
      for (const it of r.items)
        after.set(it.exelyRoomStayId, {
          accommodationTypeCode: it.accommodationTypeCode,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          sold: sold(it.status),
        });
    change = availabilityChange(before, after, almatyToday);
    if (change) ari = (await queueAvailabilityDelta(change)) ? 'delta' : 'failed';
    console.log(
      change
        ? `остаток канала сдвинулся: ${change.categoryCodes.join(', ')} ${change.from} → ${change.toExclusive} — дельта ${ari === 'delta' ? 'в очереди ARI' : 'НЕ поставлена'}`
        : 'остаток канала не сдвинулся — в Channex ничего не отправляется',
    );
  } else if (records.length > 0) {
    // Массовый перенос меняет остатки мимо очереди дельт: каналы об этом не узнают, пока не сделать
    // полную выгрузку. Делаем её сразу через API PMS (сверка 11.09.2026 нашла 6 опасных расхождений именно
    // после импорта); если API недоступен — говорим, что сделать руками.
    ari = (await fullSyncChannels()) ? 'full' : 'failed';
  }

  await db.auditLog.create({
    data: {
      entityType: 'Property',
      entityId: property.id,
      action: 'exely.sync',
      after: JSON.parse(
        JSON.stringify({
          mode: AUTO ? 'auto' : 'manual',
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
          date: DATE,
          since: since ?? null,
          window,
          fullPass,
          fullPassAt: fullPass ? startedAt.toISOString() : (lastRun?.fullPassAt?.toISOString() ?? null),
          cards: records.length,
          stays,
          ...summary,
          ari,
          change,
        }),
      ),
    },
  });
} finally {
  await db.$disconnect();
}

/** Дельта остатков в очередь ARI через API PMS (ADR-032): пересчёт — там же, где для броней со стойки. */
async function queueAvailabilityDelta(change: AvailabilityChange): Promise<boolean> {
  if (!process.env.CHANNEX_API_KEY?.trim()) return true;
  try {
    const res = await fetch(`${api}/channels/channex/availability/changed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(change),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (e) {
    console.log(
      `ВНИМАНИЕ: дельта остатков в Channex не поставлена (${(e as Error).message}). Канал увидит изменение ` +
        'при ночной полной выгрузке; сторож (ari.oversell) сделает её раньше, если канал продаёт лишние места.',
    );
    return false;
  }
}

/** Полная выгрузка остатков и ограничений в Channex после импорта — иначе канал продаёт по старому остатку. */
async function fullSyncChannels(): Promise<boolean> {
  if (!process.env.CHANNEX_API_KEY?.trim()) return true;
  try {
    // Глубину решает API (500 дней, сертификация Channex §1); 365 оставалось здесь с 12.09, как и в кнопке стойки.
    // По этой выгрузке с trigger=import сторож видел время синхронизации до записи exely.sync (ADR-032)
    const res = await fetch(`${api}/channels/channex/sync?trigger=import`, {
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
    return true;
  } catch (e) {
    console.log(
      `\nВНИМАНИЕ: полная выгрузка в Channex не выполнена (${(e as Error).message}) — остатки в каналах устарели. Выполните руками:\n` +
        "  curl -s -X POST 'http://localhost:3001/channels/channex/sync'\n" +
        '  npx tsx scripts/reconciliation/src/cli-channex-ari.ts 30\n',
    );
    return false;
  }
}
