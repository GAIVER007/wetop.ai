/**
 * Сопоставление подтянутой каналом брони с перенесённой из Exely (ADR-024, Q-034).
 *
 * При подключении канала channel manager присылает уже существующие будущие брони как новые.
 * Те же брони уже лежат в PMS после переноса из Exely, но без номера на стороне канала
 * (Универсальный API Exely его не отдаёт). Чтобы не занять вторую койку, ревизия ищется среди
 * перенесённых броней по составу проживаний: мультимножество (категория, заезд, выезд) должно
 * совпасть 1:1, порядок комнат не важен. Суммы и валюта в сопоставлении не участвуют.
 *
 * Здесь только чистое правило: кто именно кандидат (канал, источник, статус) — решает вызывающий.
 */

export interface StaySpan {
  accommodationTypeId: string;
  arrivalDate: string;
  departureDate: string;
}

export interface ImportedCandidate {
  id: string;
  confirmationNumber: string;
  /** Живые (не отменённые) проживания кандидата */
  items: StaySpan[];
}

export type ImportedMatch =
  | { kind: 'one'; id: string; confirmationNumber: string }
  | { kind: 'none' }
  | { kind: 'many'; confirmationNumbers: string[] };

const spanKey = (s: StaySpan) => `${s.accommodationTypeId}|${s.arrivalDate}|${s.departureDate}`;

/** Одинаковый набор проживаний как мультимножество: одинаковые ключи в одинаковом количестве. */
export function sameStaySet(a: readonly StaySpan[], b: readonly StaySpan[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(spanKey).sort();
  const right = b.map(spanKey).sort();
  return left.every((k, i) => k === right[i]);
}

export function matchImportedReservation(
  rooms: readonly StaySpan[],
  candidates: readonly ImportedCandidate[],
): ImportedMatch {
  const hits = candidates.filter((c) => sameStaySet(rooms, c.items));
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length === 1)
    return { kind: 'one', id: hits[0]!.id, confirmationNumber: hits[0]!.confirmationNumber };
  return { kind: 'many', confirmationNumbers: hits.map((c) => c.confirmationNumber) };
}
