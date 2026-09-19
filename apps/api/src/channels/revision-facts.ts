/**
 * Что из сохранённой ревизии Channex можно показать на странице «Приём брони из канала» (срез 7.2).
 * `external_events.payload` хранит ревизию целиком, включая `customer` (имя, телефон, почта) — это ПД,
 * наружу они не идут (ADR-018, SECURITY.md); гость виден в карточке брони по правилам стойки.
 */
export interface RevisionFacts {
  uniqueId: string | null;
  otaName: string | null;
  otaReservationCode: string | null;
  status: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  adults: number | null;
  children: number | null;
  /** сумма канала как прислана: десятичная строка и валюта */
  amount: string | null;
  currency: string | null;
  paymentCollect: string | null;
  rooms: Array<{
    checkinDate: string | null;
    checkoutDate: string | null;
    roomTypeId: string | null;
    ratePlanId: string | null;
    adults: number | null;
    amount: string | null;
  }>;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) ? v : null;
const occ = (v: unknown): { adults: number | null; children: number | null } => {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return { adults: int(o['adults']), children: int(o['children']) };
};

export function revisionFacts(payload: unknown): RevisionFacts {
  const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const o = occ(p['occupancy']);
  const rooms = Array.isArray(p['rooms']) ? p['rooms'] : [];
  return {
    uniqueId: str(p['unique_id']),
    otaName: str(p['ota_name']),
    otaReservationCode: str(p['ota_reservation_code']),
    status: str(p['status']),
    arrivalDate: str(p['arrival_date']),
    departureDate: str(p['departure_date']),
    adults: o.adults,
    children: o.children,
    amount: str(p['amount']),
    currency: str(p['currency']),
    paymentCollect: str(p['payment_collect']),
    rooms: rooms
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        checkinDate: str(r['checkin_date']),
        checkoutDate: str(r['checkout_date']),
        roomTypeId: str(r['room_type_id']),
        ratePlanId: str(r['rate_plan_id']),
        adults: occ(r['occupancy']).adults,
        amount: str(r['amount']),
      })),
  };
}
