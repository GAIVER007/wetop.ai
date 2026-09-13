/**
 * Удаление демо-данных из рабочей базы (план plans/plan-2026-09-13-live-db-clean.md, шаг A): чистые правила отбора.
 * До переключения каналов рядом с настоящими бронями Exely в базе лежат брони автотестов, проверок стойки и тестового
 * Channex staging. Правила удаляют только их и останавливают удаление, если кандидат держит место или деньги настоящего
 * счёта. Скрипт — cli-purge-test-data.ts; копия и восстановление — encodeTyped / decodeTyped.
 */
import { E2E_NOTE, OWN_NUMBER } from './e2e-cleanup-rules';

/** Номер брони Exely: дата, id объекта 513903, номер */
export const EXELY_NUMBER = /^\d{8}-513903-\d+$/;
/** Витринные брони Channex для показа сертификации — остаются до показа (решение владельца 13.09.2026) */
export const SHOWCASE = /-SHOW-/;
/**
 * Моложе порога бронь не трогаем: её может использовать идущий в эту минуту тест другой сессии. Час — вчетверо больше
 * порога уборки автотестов (STALE_AFTER_MINUTES); удаление разовое, спешить некуда.
 */
export const PURGE_MIN_AGE_MINUTES = 60;

const INACTIVE = new Set(['CANCELLED', 'NO_SHOW']);

/** Таблицы копии в порядке удаления — от зависимых к главным; восстановление идёт в обратном порядке */
export const PURGE_TABLES = [
  'refunds',
  'paymentAllocations',
  'charges',
  'payments',
  'folios',
  'stayGuests',
  'allocations',
  'reservationItems',
  'reservations',
  'guestDocuments',
  'guests',
  'housekeepingEvents',
  'auditLogs',
] as const;
export type PurgeTable = (typeof PURGE_TABLES)[number];

export interface PurgeReservation {
  id: string;
  confirmationNumber: string;
  source: string;
  notes: string | null;
  createdAt: Date;
  items: Array<{ id: string; status: string; exelyRoomStayId: string | null; allocations: number }>;
}

export type TestDataKind = 'e2e' | 'pms-number' | 'channel-test';

/** Почему бронь — тестовые данные, или null, если нет (Exely, витрина, без признаков). */
export function testDataKind(r: PurgeReservation): TestDataKind | null {
  if (r.items.some((i) => i.exelyRoomStayId)) return null;
  if (SHOWCASE.test(r.confirmationNumber)) return null;
  if (r.notes?.includes(E2E_NOTE)) return 'e2e';
  if (OWN_NUMBER.test(r.confirmationNumber)) return 'pms-number';
  if (r.source === 'OTA' && !EXELY_NUMBER.test(r.confirmationNumber)) return 'channel-test';
  return null;
}

export interface PurgePlan {
  candidates: PurgeReservation[];
  byKind: Record<TestDataKind, number>;
  /** Тестовые, но моложе порога — пропущены */
  skippedFresh: string[];
  /** Не из Exely и не витрина, но без признаков теста — не удаляются, показываются владельцу */
  unclassified: string[];
  /** Любая строка здесь останавливает удаление целиком */
  blockers: string[];
}

export function planPurge(
  rows: readonly PurgeReservation[],
  now: Date,
  opts: { propertyLive: boolean; pendingChannexEvents: number },
): PurgePlan {
  const plan: PurgePlan = {
    candidates: [],
    byKind: { e2e: 0, 'pms-number': 0, 'channel-test': 0 },
    skippedFresh: [],
    unclassified: [],
    blockers: [],
  };
  if (opts.propertyLive)
    plan.blockers.push(
      'объект объявлен живым (GUARD_PROPERTY_LIVE=true): номер PMS теперь у настоящих броней, правило отбора неприменимо',
    );
  if (opts.pendingChannexEvents > 0)
    plan.blockers.push(
      `необработанных ревизий Channex: ${opts.pendingChannexEvents} — Channex пришлёт их снова, удалённая бронь могла бы вернуться`,
    );
  for (const r of rows) {
    const kind = testDataKind(r);
    if (!kind) {
      const fromExely = r.items.some((i) => i.exelyRoomStayId);
      if (!fromExely && !SHOWCASE.test(r.confirmationNumber)) plan.unclassified.push(r.confirmationNumber);
      continue;
    }
    if (now.getTime() - r.createdAt.getTime() < PURGE_MIN_AGE_MINUTES * 60_000) {
      plan.skippedFresh.push(r.confirmationNumber);
      continue;
    }
    const active = r.items.filter((i) => !INACTIVE.has(i.status));
    if (active.length)
      plan.blockers.push(`${r.confirmationNumber}: активное проживание (${active.map((i) => i.status).join(', ')})`);
    if (r.items.some((i) => i.allocations > 0))
      plan.blockers.push(`${r.confirmationNumber}: назначена ячейка — удаление поменяло бы остатки`);
    plan.candidates.push(r);
    plan.byKind[kind] += 1;
  }
  return plan;
}

/** Платёж удаляется, только если все его распределения и возвраты — в удаляемых счетах; иначе стоп. */
export function paymentsToDelete(input: {
  folioIds: ReadonlySet<string>;
  payments: ReadonlyArray<{ id: string; allocationFolioIds: string[]; refundFolioIds: string[] }>;
}): { paymentIds: string[]; blockers: string[] } {
  const paymentIds: string[] = [];
  const blockers: string[] = [];
  for (const p of input.payments) {
    const outside = [...p.allocationFolioIds, ...p.refundFolioIds].filter((f) => !input.folioIds.has(f));
    if (outside.length) blockers.push(`платёж ${p.id}: задевает счета, которые остаются (${outside.length})`);
    else paymentIds.push(p.id);
  }
  return { paymentIds, blockers };
}

/** Гость удаляется, только если он не из Exely и все его брони — удаляемые. */
export function guestsToDelete(input: {
  reservationIds: ReadonlySet<string>;
  guests: ReadonlyArray<{ id: string; exelyPersonId: string | null; reservationIds: string[] }>;
}): string[] {
  return input.guests
    .filter((g) => !g.exelyPersonId && g.reservationIds.every((r) => input.reservationIds.has(r)))
    .map((g) => g.id);
}

/** Строка базы → JSON без потерь: BigInt и даты помечаются, остальное как есть. */
export function encodeTyped(value: unknown): unknown {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeTyped);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeTyped(v)]));
  return value;
}

export function decodeTyped(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeTyped);
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1 && typeof o.$bigint === 'string') return BigInt(o.$bigint);
    if (keys.length === 1 && typeof o.$date === 'string') return new Date(o.$date);
    return Object.fromEntries(keys.map((k) => [k, decodeTyped(o[k])]));
  }
  return value;
}
