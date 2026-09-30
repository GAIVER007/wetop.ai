/**
 * Диагностика для WETOP Support (S5, plans/ai-agents-s5-diagnostics-2026-09-29.md §2.3).
 *
 * Чистая сборка того, что модель вправе знать о каналах продаж и о брони обратившегося. Всё, чего здесь нет,
 * остаётся у сервера: имя, телефон, гражданство и документы гостя, заметки брони, суммы, ключи и адреса Channex,
 * внутренние идентификаторы. Порогов новых нет: только существующие статусы, даты и очереди.
 */

export type IntegrationState = 'READY' | 'NO_KEY' | 'NO_MAPPING' | 'ATTENTION';

export type IntegrationProblem =
  | 'KEY_MISSING'
  | 'PROPERTY_NOT_MAPPED'
  | 'CATEGORIES_UNMAPPED'
  | 'RATE_PLANS_UNMAPPED'
  | 'WEBHOOK_SUSPECT'
  | 'WEBHOOK_UNREACHABLE'
  | 'OUTBOX_FAILED'
  | 'OUTBOX_STUCK'
  | 'NO_EVENTS_24H';

/** Факты о подключении, как их читает API: только база и снимок сторожа webhook, без живого вызова Channex */
export interface IntegrationFacts {
  keyConfigured: boolean;
  propertyMapped: boolean;
  categoriesTotal: number;
  categoriesMapped: number;
  ratePlansMapped: number;
  /** Последнее событие из канала (webhook или опрос ленты); null — не было */
  lastEventAt: Date | null;
  outbox: { pending: number; failed: number; oldestPendingAt: Date | null };
  webhook: { suspect: boolean; suspectReason: string | null; callbackReachable: boolean | null };
}

export interface IntegrationHealth {
  state: IntegrationState;
  categories: { mapped: number; total: number };
  ratePlansMapped: number;
  lastEventAgeMinutes: number | null;
  outbox: { pending: number; failed: number; oldestPendingMinutes: number | null };
  webhook: { suspect: boolean; reachable: boolean | null };
  problems: IntegrationProblem[];
}

/** Самая старая дельта ждёт дольше этого — канал не знает об изменениях (та же мера, что у T6 в «Свежести») */
export const OUTBOX_STUCK_MINUTES = 30;
export const NO_EVENTS_HOURS = 24;

const minutesBetween = (from: Date | null, now: Date): number | null =>
  from ? Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000)) : null;

export function buildIntegrationHealth(facts: IntegrationFacts, now: Date): IntegrationHealth {
  const lastEventAgeMinutes = minutesBetween(facts.lastEventAt, now);
  const oldestPendingMinutes = minutesBetween(facts.outbox.oldestPendingAt, now);
  const problems: IntegrationProblem[] = [];
  let state: IntegrationState = 'READY';

  if (!facts.keyConfigured) {
    // Без ключа остальное не проверить: сопоставления и очередь могут быть, но обмена нет
    problems.push('KEY_MISSING');
    state = 'NO_KEY';
  } else if (!facts.propertyMapped) {
    problems.push('PROPERTY_NOT_MAPPED');
    state = 'NO_MAPPING';
  } else {
    if (facts.categoriesMapped < facts.categoriesTotal) problems.push('CATEGORIES_UNMAPPED');
    if (facts.ratePlansMapped === 0) problems.push('RATE_PLANS_UNMAPPED');
    if (facts.webhook.suspect) problems.push('WEBHOOK_SUSPECT');
    if (facts.webhook.callbackReachable === false) problems.push('WEBHOOK_UNREACHABLE');
    if (facts.outbox.failed > 0) problems.push('OUTBOX_FAILED');
    if (oldestPendingMinutes !== null && oldestPendingMinutes > OUTBOX_STUCK_MINUTES) problems.push('OUTBOX_STUCK');
    if (lastEventAgeMinutes === null || lastEventAgeMinutes > NO_EVENTS_HOURS * 60) problems.push('NO_EVENTS_24H');
    if (problems.length) state = 'ATTENTION';
  }

  return {
    state,
    categories: { mapped: facts.categoriesMapped, total: facts.categoriesTotal },
    ratePlansMapped: facts.ratePlansMapped,
    lastEventAgeMinutes,
    outbox: { pending: facts.outbox.pending, failed: facts.outbox.failed, oldestPendingMinutes },
    webhook: { suspect: facts.webhook.suspect, reachable: facts.webhook.callbackReachable },
    problems,
  };
}

export type ReservationProblem =
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'UNASSIGNED_ITEMS'
  | 'ARRIVAL_PASSED_NOT_CHECKED_IN'
  | 'DEPARTURE_PASSED_NOT_CHECKED_OUT'
  | 'UNIT_NOT_INSPECTED_BEFORE_ARRIVAL';

/** Карточка брони, как её отдаёт стойка: читаем только перечисленные поля, остальное типом не требуется */
export interface ReservationCardLike {
  confirmationNumber: string;
  source: string;
  channel: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  items: Array<{
    accommodationTypeName: string;
    status: string;
    unitCode: string | null;
    unitHousekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
  }>;
}

export interface ReservationDiagnostics {
  number: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  source: string;
  channel: string | null;
  guests: { adults: number; children: number };
  items: Array<{
    category: string;
    status: string;
    unitAssigned: boolean;
    unitCode: string | null;
    housekeeping: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
  }>;
  problems: ReservationProblem[];
}

const DAY_MS = 86_400_000;
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

const LIVE_STATUSES = new Set(['TENTATIVE', 'CONFIRMED']);

/** `today` — сегодня по часам объекта (`YYYY-MM-DD`): даты брони живут в его поясе (AGENTS.md §13) */
export function buildReservationDiagnostics(card: ReservationCardLike, today: string): ReservationDiagnostics {
  const items = card.items.map((item) => ({
    category: item.accommodationTypeName,
    status: item.status,
    unitAssigned: item.unitCode !== null && item.unitCode !== '',
    unitCode: item.unitCode || null,
    housekeeping: item.unitHousekeepingStatus ?? null,
  }));
  const problems: ReservationProblem[] = [];
  const todayN = dayNumber(today);
  const arrivalN = dayNumber(card.arrivalDate);
  const departureN = dayNumber(card.departureDate);

  if (card.status === 'CANCELLED') problems.push('CANCELLED');
  else if (card.status === 'NO_SHOW') problems.push('NO_SHOW');
  else {
    // Живая бронь: ячейки, заезд и выезд считаются только у неё — у отменённой они уже никого не касаются
    if (items.some((item) => !item.unitAssigned && LIVE_STATUSES.has(item.status) && item.status !== 'CANCELLED'))
      problems.push('UNASSIGNED_ITEMS');
    if (LIVE_STATUSES.has(card.status) && arrivalN < todayN) problems.push('ARRIVAL_PASSED_NOT_CHECKED_IN');
    if (card.status === 'CHECKED_IN' && departureN < todayN) problems.push('DEPARTURE_PASSED_NOT_CHECKED_OUT');
    if (
      LIVE_STATUSES.has(card.status) &&
      arrivalN >= todayN &&
      items.some((item) => item.unitAssigned && item.housekeeping !== null && item.housekeeping !== 'INSPECTED')
    )
      problems.push('UNIT_NOT_INSPECTED_BEFORE_ARRIVAL');
  }

  return {
    number: card.confirmationNumber,
    status: card.status,
    arrivalDate: card.arrivalDate,
    departureDate: card.departureDate,
    nights: Math.max(0, departureN - arrivalN),
    source: card.source,
    channel: card.channel,
    guests: { adults: card.adults, children: card.children },
    items,
    problems,
  };
}
