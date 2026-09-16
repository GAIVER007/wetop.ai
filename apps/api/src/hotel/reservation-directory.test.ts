import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReservationDirectory } from './reservation-directory';
const fixture = () => {
  const db = {
    property: { findFirst: vi.fn().mockResolvedValue({ id: 'p' }) },
    reservation: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, service: new ReservationDirectory({ db } as never) };
};
describe('reservation directory is a bounded read projection', () => {
  it('rejects repeated or structured query parameters with a client error', async () => {
    for (const query of [{ q: ['one', 'two'] }, { from: ['2026-09-13'] }, { page: {} }]) {
      const { db, service } = fixture();
      await expect(service.list(query as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.property.findFirst).not.toHaveBeenCalled();
    }
  });
  it('rejects invalid dates, statuses and pagination before querying records', async () => {
    for (const params of [
      { from: '2026-02-30', to: '2026-03-05' },
      { from: '2026-09-13', to: '2026-09-01' },
      { status: 'BOGUS' },
      { page: '0' },
      { page: '1.5' },
    ]) {
      const { db, service } = fixture();
      await expect(service.list(params)).rejects.toThrow();
      expect(db.reservation.findMany).not.toHaveBeenCalled();
    }
  });
  it('scopes and limits reads, preserving empty data and decimal-safe money', async () => {
    const { db, service } = fixture();
    const result = await service.list({
      from: '2026-09-01',
      to: '2026-09-30',
      status: 'CONFIRMED',
      page: '2',
      q: 'Демо',
    });
    expect(result).toMatchObject({ rows: [], total: 0, page: 2, pageSize: 25 });
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        skip: 25,
        where: expect.objectContaining({ propertyId: 'p', status: 'CONFIRMED' }),
      }),
    );
  });
  it('pageSize widens a page up to 200 rows (guests of the day) and refuses more', async () => {
    const { db, service } = fixture();
    const result = await service.list({ from: '2026-09-15', to: '2026-09-15', pageSize: '200' });
    expect(result).toMatchObject({ pageSize: 200, page: 1 });
    expect(db.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200, skip: 0 }),
    );
    for (const pageSize of ['0', '201', '2.5', 'x']) {
      const bad = fixture();
      await expect(bad.service.list({ pageSize })).rejects.toBeInstanceOf(BadRequestException);
      expect(bad.db.reservation.findMany).not.toHaveBeenCalled();
    }
  });
  it('excludes voided finance entries in the read selection and preserves refunds', async () => {
    const { db, service } = fixture();
    db.reservation.findMany.mockResolvedValue([
      {
        confirmationNumber: 'DEMO',
        status: 'CONFIRMED',
        source: 'DESK',
        channel: null,
        arrivalDate: new Date('2026-09-13'),
        departureDate: new Date('2026-09-14'),
        currency: 'KZT',
        totalAmount: 9007199254740999n,
        primaryGuest: null,
        items: [
          {
            allocations: [],
            folio: {
              charges: [{ amount: 9007199254740999n }],
              allocations: [{ amount: 5n }],
              refunds: [{ amount: 2n }],
            },
          },
        ],
      },
    ] as never);
    const result = await service.list({});
    expect(result.rows[0]).toMatchObject({
      totalAmountMinor: '9007199254740999',
      paidMinor: '5',
      balanceMinor: '9007199254740996',
    });
    const args = db.reservation.findMany.mock.calls[0]![0];
    expect(args.select.items.select.folio.select.charges.where).toEqual({ voidedAt: null });
    expect(args.select.items.select.folio.select.allocations.where).toEqual({
      payment: { status: 'COMPLETED' },
    });
  });
});
