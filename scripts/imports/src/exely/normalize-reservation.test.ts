import { describe, expect, it } from 'vitest';
import { normalizeExelyReservation, type ExelyReservationDetails } from './normalize-reservation';

/** Вымышленная бронь по форме docs/exely (pms-get-reservation.md): 2 проживания, 2 гостя. */
const fixture: ExelyReservationDetails = {
  number: '20260901-999999-70000001',
  currencyCode: 'KZT',
  modifyDateTime: '2026-08-30T10:00:00Z',
  customerComment: 'late arrival',
  customer: {
    pmsPersonId: 'P-1',
    personName: { lastName: 'Тестов', firstName: 'Иван', middleName: null },
    birthDate: '1990-05-05',
    citizenship: 'KAZ',
    emails: [{ address: 'ivan@example.invalid' }],
    phones: [{ number: '+70000000001' }],
    gender: 'Male',
  },
  creationSource: { id: '25', name: 'Online' },
  channelInformation: null,
  reservationStatus: 'Confirmed',
  roomStays: [
    {
      pmsRoomStayId: 'S-1',
      roomId: 'R-9001',
      roomTypeId: '900001',
      guestsIds: ['P-1'],
      checkInDateTime: '2026-09-10T14:00',
      checkOutDateTime: '2026-09-12T12:00',
      actualCheckInDateTime: null,
      actualCheckOutDateTime: null,
      status: 'New',
      guestCount: { adults: 1, children: 0 },
      totalPrice: {
        amount: { value: 12841.2, currencyCode: null },
        payAmount: { value: 0, currencyCode: null },
        refundAmount: { value: 0, currencyCode: null },
      },
    },
    {
      pmsRoomStayId: 'S-2',
      roomId: null,
      roomTypeId: '900003',
      guestsIds: ['P-2'],
      checkInDateTime: '2026-09-10T14:00',
      checkOutDateTime: '2026-09-13T12:00',
      actualCheckInDateTime: null,
      actualCheckOutDateTime: null,
      status: 'CheckedIn',
      guestCount: { adults: 1, children: 0 },
      totalPrice: {
        amount: { value: 6000, currencyCode: null },
        payAmount: { value: 6000, currencyCode: null },
        refundAmount: { value: 0, currencyCode: null },
      },
    },
  ],
};
const roomMap = new Map([['R-9001', '9001']]);
const typeMap = new Map([
  ['900001', 'exely-900001'],
  ['900003', 'exely-900003'],
]);

describe('normalizeExelyReservation', () => {
  it('maps a reservation with two stays into the import record: dates, minor units, statuses, refs', () => {
    const r = normalizeExelyReservation(fixture, { roomMap, typeMap });
    expect(r.confirmationNumber).toBe('20260901-999999-70000001');
    expect(r.source).toBe('WEBSITE');
    expect(r.status).toBe('CONFIRMED');
    expect(r.arrivalDate).toBe('2026-09-10');
    expect(r.departureDate).toBe('2026-09-13');
    expect(r.adults).toBe(2);
    expect(r.currency).toBe('KZT');
    expect(r.totalAmountMinor).toBe(1884120n); // 12841.20 + 6000.00 ₸ в тиынах
    expect(r.notes).toBe('late arrival');
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({
      exelyRoomStayId: 'S-1',
      accommodationTypeCode: 'exely-900001',
      exelyRoomNumber: '9001',
      priceMinor: 1284120n,
      status: 'CONFIRMED',
      guestExelyIds: ['P-1'],
    });
    expect(r.items[1]).toMatchObject({
      exelyRoomStayId: 'S-2',
      exelyRoomNumber: null,
      status: 'CHECKED_IN',
    });
    expect(r.customer).toMatchObject({
      exelyPersonId: 'P-1',
      firstName: 'Иван',
      lastName: 'Тестов',
      citizenship: 'KAZ',
      gender: 'MALE',
      email: 'ivan@example.invalid',
      phone: '+70000000001',
    });
  });
  it('OTA bookings: channelInformation present → source OTA and channel name', () => {
    const r = normalizeExelyReservation(
      {
        ...fixture,
        channelInformation: { channelName: 'Booking.com', channelReservationNumber: 'BDC-1' },
      },
      { roomMap, typeMap },
    );
    expect(r.source).toBe('OTA');
    expect(r.channel).toBe('Booking.com');
    expect(r.externalId).toBe('BDC-1');
  });
  it('refuses unknown room type, unknown stay status and unknown creation source instead of guessing', () => {
    expect(() =>
      normalizeExelyReservation(
        { ...fixture, roomStays: [{ ...fixture.roomStays[0]!, roomTypeId: '1' }] },
        { roomMap, typeMap },
      ),
    ).toThrow(/roomTypeId 1/);
    expect(() =>
      normalizeExelyReservation(
        { ...fixture, roomStays: [{ ...fixture.roomStays[0]!, status: 'Weird' }] },
        { roomMap, typeMap },
      ),
    ).toThrow(/Weird/);
    expect(() =>
      normalizeExelyReservation(
        { ...fixture, creationSource: { id: '9', name: 'Telepathy' } },
        { roomMap, typeMap },
      ),
    ).toThrow(/Telepathy/);
  });
  it('refuses a known roomId that is not in the room map: nothing is derived from the number', () => {
    expect(() => normalizeExelyReservation(fixture, { roomMap: new Map(), typeMap })).toThrow(
      /R-9001/,
    );
  });
  it('converts money exactly: 0.1 + 0.2 style values do not leak float error', () => {
    const r = normalizeExelyReservation(
      {
        ...fixture,
        roomStays: [
          {
            ...fixture.roomStays[0]!,
            totalPrice: {
              amount: { value: 0.1, currencyCode: null },
              payAmount: { value: 0, currencyCode: null },
              refundAmount: { value: 0, currencyCode: null },
            },
          },
          {
            ...fixture.roomStays[1]!,
            totalPrice: {
              amount: { value: 0.2, currencyCode: null },
              payAmount: { value: 0, currencyCode: null },
              refundAmount: { value: 0, currencyCode: null },
            },
          },
        ],
      },
      { roomMap, typeMap },
    );
    expect(r.totalAmountMinor).toBe(30n);
  });
});
