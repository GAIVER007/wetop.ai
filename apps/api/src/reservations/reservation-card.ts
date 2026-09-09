import type { Db, DbTx } from '@pms/database';

export interface ReservationCardItem {
  id: string;
  accommodationTypeCode: string;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  priceMinor: string;
  unitCode: string | null;
  guests: Array<{ label: string; isPrimary: boolean }>;
}
export interface ReservationCard {
  confirmationNumber: string;
  source: string;
  channel: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  /** integer minor units как строка — BigInt в JSON не сериализуется */
  totalAmountMinor: string;
  notes: string | null;
  primaryGuest: { label: string; citizenship: string | null } | null;
  items: ReservationCardItem[];
}

const d = (x: Date) => x.toISOString().slice(0, 10);
const guestLabel = (g: { firstName: string; lastName: string } | null | undefined) =>
  g ? `${g.firstName} ${g.lastName}`.trim() : '';

/** Карточка брони для стойки и для AuditLog. Одна форма для чтения (шахматка) и для команд. */
export async function loadReservationCard(
  db: Db | DbTx,
  propertyId: string,
  confirmationNumber: string,
): Promise<ReservationCard | null> {
  const r = await db.reservation.findUnique({
    where: { propertyId_confirmationNumber: { propertyId, confirmationNumber } },
    include: {
      primaryGuest: { select: { firstName: true, lastName: true, citizenship: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          accommodationType: { select: { code: true, name: true } },
          allocations: {
            orderBy: { startDate: 'asc' },
            include: { inventoryUnit: { select: { code: true } } },
          },
          stayGuests: { include: { guest: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });
  if (!r) return null;
  return {
    confirmationNumber: r.confirmationNumber,
    source: r.source,
    channel: r.channel,
    status: r.status,
    arrivalDate: d(r.arrivalDate),
    departureDate: d(r.departureDate),
    adults: r.adults,
    children: r.children,
    currency: r.currency,
    totalAmountMinor: r.totalAmount.toString(),
    notes: r.notes,
    primaryGuest: r.primaryGuest
      ? { label: guestLabel(r.primaryGuest), citizenship: r.primaryGuest.citizenship }
      : null,
    items: r.items.map((it) => ({
      id: it.id,
      accommodationTypeCode: it.accommodationType.code,
      accommodationTypeName: it.accommodationType.name,
      arrivalDate: d(it.arrivalDate),
      departureDate: d(it.departureDate),
      status: it.status,
      priceMinor: it.price.toString(),
      unitCode: it.allocations.at(-1)?.inventoryUnit.code ?? null,
      guests: it.stayGuests.map((sg) => ({ label: guestLabel(sg.guest), isPrimary: sg.isPrimary })),
    })),
  };
}
