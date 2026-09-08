import { describe, expect, it } from 'vitest';
import type { exely } from '@pms/integrations';
import { adaptUniBooking } from './adapt-universal';
import { normalizeExelyReservation } from './normalize-reservation';

/** Вымышленная бронь в форме Универсального API 1.5.0 (docs/exely/universal-pms-api-1.5.0.md). */
const uni: exely.UniBooking = {
  id: 'B1',
  number: '20260901-999999-70000002',
  currencyId: 'KZT',
  customerComment: 'просьба: тихая койка',
  customer: {
    id: 'P-7',
    lastName: 'Тестова',
    firstName: 'Анна',
    middleName: null,
    birthDate: '1995-02-02',
    citizenshipCode: 'KAZ',
    emails: ['anna@example.invalid'],
    phones: ['+70000000007'],
    gender: 'Unknown',
  },
  source: { key: '2', value: 'Из канала продаж' },
  sourceChannelName: 'booking.com',
  roomStays: [
    {
      id: 'S-7',
      bookingId: 'B1',
      roomId: 'R-9010',
      roomTypeId: '900003',
      checkInDateTime: '2026-09-20T14:00',
      checkOutDateTime: '2026-09-22T12:00',
      actualCheckInDateTime: null,
      actualCheckOutDateTime: null,
      status: 'New',
      bookingStatus: 'Confirmed',
      guestCountInfo: { adults: 1, children: 0 },
      guestsIds: ['P-7'],
      totalPrice: { amount: 12000, toPayAmount: 12000, toRefundAmount: 0 },
    },
  ],
};
const ctx = {
  roomMap: new Map([['R-9010', '9010']]),
  typeMap: new Map([['900003', 'exely-900003']]),
};

describe('adaptUniBooking → normalizeExelyReservation', () => {
  it('maps the Universal API shape onto the common normalizer', () => {
    const r = normalizeExelyReservation(adaptUniBooking(uni), ctx);
    expect(r).toMatchObject({
      confirmationNumber: '20260901-999999-70000002',
      source: 'OTA',
      channel: 'booking.com',
      status: 'CONFIRMED',
      currency: 'KZT',
      totalAmountMinor: 1200000n,
      notes: 'просьба: тихая койка',
    });
    expect(r.customer).toMatchObject({
      exelyPersonId: 'P-7',
      firstName: 'Анна',
      citizenship: 'KAZ',
      gender: 'UNKNOWN',
      email: 'anna@example.invalid',
      phone: '+70000000007',
    });
    expect(r.items[0]).toMatchObject({
      exelyRoomStayId: 'S-7',
      exelyRoomNumber: '9010',
      status: 'CONFIRMED',
      priceMinor: 1200000n,
    });
  });
  it('«От стойки» and «Мобильный экстранет» → DESK; a cancelled bookingStatus wins over stay status', () => {
    const desk = normalizeExelyReservation(
      adaptUniBooking({
        ...uni,
        source: { key: '0', value: 'От стойки' },
        sourceChannelName: null,
      }),
      ctx,
    );
    expect(desk.source).toBe('DESK');
    const mob = normalizeExelyReservation(
      adaptUniBooking({
        ...uni,
        source: { key: '2147483646', value: 'Мобильный экстранет' },
        sourceChannelName: null,
      }),
      ctx,
    );
    expect(mob.source).toBe('DESK');
    const canc = normalizeExelyReservation(
      adaptUniBooking({
        ...uni,
        roomStays: [{ ...uni.roomStays[0]!, bookingStatus: 'Cancelled' }],
      }),
      ctx,
    );
    expect(canc.status).toBe('CANCELLED');
    expect(canc.items[0]!.status).toBe('CANCELLED');
  });
});
