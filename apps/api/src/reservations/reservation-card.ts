import type { Db, DbTx } from '@pms/database';
import { normalizeCitizenship } from '@pms/domain';

export interface ReservationCardItem {
  id: string;
  accommodationTypeCode: string;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  priceMinor: string;
  /** Тариф проживания (Q-102); null — неизвестен (перенесено из Exely): пересчёт цены требует выбрать тариф */
  ratePlanCode: string | null;
  ratePlanName: string | null;
  /** Гостей на проживании (Q-102) — правится с карточки */
  adults: number;
  children: number;
  unitCode: string | null;
  /** Статус уборки ячейки (Q-156, ADR-068): стойка предупреждает о заселении в непроверенную */
  unitHousekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
  guests: Array<{ label: string; isPrimary: boolean }>;
}
export interface ReservationCard {
  confirmationNumber: string;
  source: string;
  channel: string | null;
  /** Номер брони в канале (ADR-071) или `unique_id` Channex, если бронь пришла из канала; фальшивки тестов могут опускать */
  externalId?: string | null;
  status: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  currency: string;
  /** integer minor units как строка — BigInt в JSON не сериализуется */
  totalAmountMinor: string;
  notes: string | null;
  primaryGuest: {
    id: string;
    label: string;
    citizenship: string | null;
    /** Для перехода в мессенджер из карточки (T5); телефон не шифруется, в отличие от документов */
    phone: string | null;
  } | null;
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
      primaryGuest: {
        select: { id: true, firstName: true, lastName: true, citizenship: true, phone: true },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          accommodationType: { select: { code: true, name: true } },
          ratePlan: { select: { code: true, name: true } },
          allocations: {
            orderBy: { startDate: 'asc' },
            include: { inventoryUnit: { select: { code: true, housekeepingStatus: true } } },
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
    externalId: r.externalId,
    status: r.status,
    arrivalDate: d(r.arrivalDate),
    departureDate: d(r.departureDate),
    adults: r.adults,
    children: r.children,
    currency: r.currency,
    totalAmountMinor: r.totalAmount.toString(),
    notes: r.notes,
    primaryGuest: r.primaryGuest
      ? {
          id: r.primaryGuest.id,
          label: guestLabel(r.primaryGuest),
          citizenship: normalizeCitizenship(r.primaryGuest.citizenship), // CHAR(3): '' хранится как '   '
          phone: r.primaryGuest.phone,
        }
      : null,
    items: r.items.map((it) => ({
      id: it.id,
      accommodationTypeCode: it.accommodationType.code,
      accommodationTypeName: it.accommodationType.name,
      arrivalDate: d(it.arrivalDate),
      departureDate: d(it.departureDate),
      status: it.status,
      priceMinor: it.price.toString(),
      ratePlanCode: it.ratePlan?.code ?? null,
      ratePlanName: it.ratePlan?.name ?? null,
      adults: it.adults,
      children: it.children,
      unitCode: it.allocations.at(-1)?.inventoryUnit.code ?? null,
      unitHousekeepingStatus: it.allocations.at(-1)?.inventoryUnit.housekeepingStatus ?? null,
      guests: it.stayGuests.map((sg) => ({ label: guestLabel(sg.guest), isPrimary: sg.isPrimary })),
    })),
  };
}
