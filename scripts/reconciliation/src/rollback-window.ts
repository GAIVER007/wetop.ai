/**
 * Сверка окна отката (CUTOVER.md ROLLBACK, шаг 6 «Reconcile reservations received during migration window»).
 * Чистые правила без сети и базы: сопоставить ревизии Channex за окно с событиями PMS и сказать, что
 * администратор должен повторить в Exely, если канал возвращается к Exely. Без ПД: номера, даты, суммы.
 */

export type RevisionStatus = 'new' | 'modified' | 'cancelled';

export interface ChannexRevision {
  revisionId: string;
  bookingId: string;
  uniqueId: string;
  otaName: string;
  status: RevisionStatus;
  insertedAt: Date;
  arrivalDate: string;
  departureDate: string;
  /** Сумма брони из ревизии, десятичной строкой, как отдаёт Channex */
  amount: string;
}

export interface PmsEvent {
  externalEventId: string;
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'REJECTED' | string;
  receivedVia: 'WEBHOOK' | 'PULL' | 'MANUAL' | string;
  receivedAt: Date;
  processedAt: Date | null;
  lastError: string | null;
}

export interface PmsReservation {
  confirmationNumber: string;
  /** unique_id брони в Channex — по нему приём ревизий находит бронь (inbound.service) */
  externalId: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  totalMinor: bigint;
}

/** Channex отдаёт `inserted_at` без зоны («2019-04-23T10:03:29.335485») — это UTC */
export function parseChannexTime(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

export type RevisionOutcome = 'processed' | 'pending' | 'failed' | 'missing';

export interface MatchedRevision {
  revision: ChannexRevision;
  event: PmsEvent | null;
  outcome: RevisionOutcome;
}

export interface MatchSummary {
  revisions: number;
  processed: number;
  pending: number;
  failed: number;
  missing: number;
  byWebhook: number;
  byPull: number;
}

/** Каждая ревизия Channex обязана иметь событие в PMS: нет события — бронь потеряна, FAILED — не разобрана. */
export function matchRevisions(
  revisions: ChannexRevision[],
  events: PmsEvent[],
): { rows: MatchedRevision[]; summary: MatchSummary } {
  const byId = new Map(events.map((e) => [e.externalEventId, e]));
  const rows = [...revisions]
    .sort((a, b) => a.insertedAt.getTime() - b.insertedAt.getTime())
    .map((revision): MatchedRevision => {
      const event = byId.get(revision.revisionId) ?? null;
      const outcome: RevisionOutcome = !event
        ? 'missing'
        : event.status === 'PROCESSED'
          ? 'processed'
          : event.status === 'FAILED' || event.status === 'REJECTED'
            ? 'failed'
            : 'pending';
      return { revision, event, outcome };
    });
  const count = (o: RevisionOutcome) => rows.filter((r) => r.outcome === o).length;
  return {
    rows,
    summary: {
      revisions: rows.length,
      processed: count('processed'),
      pending: count('pending'),
      failed: count('failed'),
      missing: count('missing'),
      byWebhook: rows.filter((r) => r.outcome === 'processed' && r.event?.receivedVia === 'WEBHOOK')
        .length,
      byPull: rows.filter((r) => r.outcome === 'processed' && r.event?.receivedVia === 'PULL')
        .length,
    },
  };
}

/**
 * create — создана в окне и жива: завести в Exely;
 * modify — существовала до окна, в окне изменена: поправить в Exely (даты — из последней ревизии);
 * cancel — существовала до окна, в окне отменена: отменить в Exely;
 * none   — создана и отменена внутри окна: в Exely её не было и не нужно;
 * verify — новая ревизия связана с бронью, перенесённой из Exely (ADR-024): в Exely она уже есть, сверить даты;
 * lost   — ревизии есть, брони в PMS нет: потеря, к человеку.
 */
export type ExelyAction = 'create' | 'modify' | 'cancel' | 'none' | 'verify' | 'lost';

export interface ExelyActionRow {
  uniqueId: string;
  otaName: string;
  pmsNumber: string | null;
  action: ExelyAction;
  lastStatus: RevisionStatus;
  arrivalDate: string;
  departureDate: string;
  amount: string;
  revisions: number;
}

export function exelyActions(
  revisions: ChannexRevision[],
  reservations: PmsReservation[],
): ExelyActionRow[] {
  const byBooking = new Map<string, ChannexRevision[]>();
  for (const r of revisions) byBooking.set(r.uniqueId, [...(byBooking.get(r.uniqueId) ?? []), r]);
  const pmsByExternal = new Map(
    reservations.filter((p) => p.externalId).map((p) => [p.externalId!, p]),
  );
  const out: ExelyActionRow[] = [];
  for (const [uniqueId, list] of byBooking) {
    const sorted = [...list].sort((a, b) => a.insertedAt.getTime() - b.insertedAt.getTime());
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const pms = pmsByExternal.get(uniqueId) ?? null;
    const createdInWindow = first.status === 'new';
    const cancelled = last.status === 'cancelled';
    let action: ExelyAction;
    if (!pms) action = 'lost';
    else if (createdInWindow && pms.confirmationNumber !== uniqueId) action = 'verify';
    else if (createdInWindow) action = cancelled ? 'none' : 'create';
    else action = cancelled ? 'cancel' : 'modify';
    out.push({
      uniqueId,
      otaName: last.otaName,
      pmsNumber: pms?.confirmationNumber ?? null,
      action,
      lastStatus: last.status,
      arrivalDate: last.arrivalDate,
      departureDate: last.departureDate,
      amount: last.amount,
      revisions: sorted.length,
    });
  }
  const order: ExelyAction[] = ['lost', 'create', 'modify', 'cancel', 'verify', 'none'];
  return out.sort(
    (a, b) =>
      order.indexOf(a.action) - order.indexOf(b.action) || a.uniqueId.localeCompare(b.uniqueId),
  );
}
