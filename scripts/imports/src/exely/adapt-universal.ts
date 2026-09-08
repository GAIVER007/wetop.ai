/**
 * Адаптер: бронь Универсального API Exely PMS 1.5.0 → форма Exely Connect (ExelyReservationDetails),
 * чтобы оба API шли через один нормализатор. Значения полей — из docs/exely/universal-pms-api-1.5.0.md.
 */
import type { exely } from '@pms/integrations';
import type { ExelyReservationDetails } from './normalize-reservation';

export function adaptUniBooking(b: exely.UniBooking): ExelyReservationDetails {
  const bookingStatus = b.roomStays[0]?.bookingStatus ?? 'Confirmed';
  const bookingCancelled = bookingStatus === 'Cancelled';
  const c = b.customer;
  return {
    number: b.number,
    currencyCode: b.currencyId,
    customerComment: b.customerComment ?? null,
    customer: {
      pmsPersonId: c.id,
      personName: {
        lastName: c.lastName ?? null,
        firstName: c.firstName ?? null,
        middleName: c.middleName ?? null,
      },
      birthDate: c.birthDate ?? null,
      citizenship: c.citizenshipCode ?? null,
      emails: (c.emails ?? []).map((address) => ({ address })),
      phones: (c.phones ?? []).map((number) => ({ number })),
      gender: c.gender ?? null,
    },
    creationSource: b.source ? { id: b.source.key, name: b.source.value } : null,
    channelInformation: b.sourceChannelName ? { channelName: b.sourceChannelName } : null,
    reservationStatus: bookingStatus,
    roomStays: b.roomStays.map((s) => ({
      pmsRoomStayId: s.id,
      roomId: s.roomId,
      roomTypeId: s.roomTypeId,
      guestsIds: s.guestsIds ?? [],
      checkInDateTime: s.checkInDateTime,
      checkOutDateTime: s.checkOutDateTime,
      actualCheckInDateTime: s.actualCheckInDateTime,
      actualCheckOutDateTime: s.actualCheckOutDateTime,
      // отменённая бронь отменяет все свои проживания, какой бы статус у них ни стоял
      status: bookingCancelled ? 'Cancelled' : s.status,
      guestCount: {
        adults: s.guestCountInfo?.adults ?? 0,
        children: s.guestCountInfo?.children ?? 0,
      },
      totalPrice: {
        amount: { value: s.totalPrice?.amount ?? 0, currencyCode: null },
        payAmount: { value: s.totalPrice?.toPayAmount ?? 0, currencyCode: null },
        refundAmount: { value: s.totalPrice?.toRefundAmount ?? 0, currencyCode: null },
      },
    })),
  };
}
