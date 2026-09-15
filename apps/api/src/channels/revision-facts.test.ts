import { describe, expect, it } from 'vitest';
import { revisionFacts } from './revision-facts';

/** Ревизия как в ленте Channex; гость вымышленный (ADR-010) и наружу не идёт */
const payload = {
  id: 'rev-1',
  unique_id: 'BDC-4821-7731',
  ota_name: 'Booking.com',
  ota_reservation_code: '4821773100',
  status: 'new',
  arrival_date: '2026-09-15',
  departure_date: '2026-09-20',
  occupancy: { adults: 1, children: 0, infants: 0 },
  amount: '20000.00',
  currency: 'KZT',
  payment_collect: 'ota',
  customer: {
    name: 'Гость',
    surname: 'Тестовый',
    phone: '+70000000001',
    mail: 'guest@example.test',
  },
  rooms: [
    {
      checkin_date: '2026-09-15',
      checkout_date: '2026-09-20',
      room_type_id: 'rt-1',
      rate_plan_id: 'rp-1',
      occupancy: { adults: 1, children: 0, infants: 0 },
      amount: '20000.00',
      guests: [{ name: 'Гость' }],
    },
  ],
};

describe('revisionFacts — факты ревизии для страницы приёма брони', () => {
  it('переносит канал, даты, гостей, сумму и комнаты', () => {
    const f = revisionFacts(payload);
    expect(f).toMatchObject({
      uniqueId: 'BDC-4821-7731',
      otaName: 'Booking.com',
      status: 'new',
      arrivalDate: '2026-09-15',
      departureDate: '2026-09-20',
      adults: 1,
      amount: '20000.00',
      currency: 'KZT',
      paymentCollect: 'ota',
    });
    expect(f.rooms).toEqual([
      {
        checkinDate: '2026-09-15',
        checkoutDate: '2026-09-20',
        roomTypeId: 'rt-1',
        ratePlanId: 'rp-1',
        adults: 1,
        amount: '20000.00',
      },
    ]);
  });
  it('персональные данные гостя наружу не уходят', () => {
    const text = JSON.stringify(revisionFacts(payload));
    expect(text).not.toContain('Тестовый');
    expect(text).not.toContain('+70000000001');
    expect(text).not.toContain('example.test');
    expect(text).not.toContain('guests');
  });
  it('пустой payload — все поля null, комнат нет', () => {
    expect(revisionFacts(null)).toMatchObject({ uniqueId: null, rooms: [] });
  });
});
