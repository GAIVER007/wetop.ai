import { describe, expect, it } from 'vitest';
import { assertBookingConfirmation, bookingRequestHash } from './seller-booking-rules';

const intent = {
  state: 'QUOTED', expiresAt: new Date('2026-10-01T10:15:00Z'),
  totalMinor: '2500000', currency: 'KZT', arrivalDate: '2026-10-02', departureDate: '2026-10-04',
  categoryCode: 'double', adults: 2,
};
const now = new Date('2026-10-01T10:10:00Z');
describe('WhatsApp booking confirmation', () => {
  it('requires explicit confirmation of the exact offer', () => {
    expect(() => assertBookingConfirmation(intent, { confirmed: false }, now)).toThrow(/подтверд/);
    expect(() => assertBookingConfirmation(intent, { confirmed: true }, now)).not.toThrow();
  });
  it('rejects expired and rejected offers', () => {
    expect(() => assertBookingConfirmation(intent, { confirmed: true }, new Date('2026-10-01T10:15:00Z'))).toThrow(/истек/);
    expect(() => assertBookingConfirmation({ ...intent, state: 'REJECTED' }, { confirmed: true }, now)).toThrow(/недоступ/);
  });
  it('stable hash ignores object key order but distinguishes different booking intents', () => {
    const a = bookingRequestHash({ categoryCode: 'double', adults: 2, arrivalDate: '2026-10-02', departureDate: '2026-10-04' });
    expect(a).toBe(bookingRequestHash({ departureDate: '2026-10-04', arrivalDate: '2026-10-02', adults: 2, categoryCode: 'double' }));
    expect(a).not.toBe(bookingRequestHash({ categoryCode: 'double', adults: 1, arrivalDate: '2026-10-02', departureDate: '2026-10-04' }));
  });
});
