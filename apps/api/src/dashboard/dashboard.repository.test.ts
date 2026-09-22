import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChessboardService } from '../chessboard/chessboard.service';
import type { PrismaService } from '../database/prisma.provider';
import { forgetPropertyRef } from '../database/property-ref';
import { PrismaDashboardRepository } from './dashboard.repository';

/**
 * «Главная» группирует источники по имени канала (`packages/domain/src/dashboard/metrics.ts`, ключ `source|channel`).
 * Channex присылает один канал под разными именами — «Booking.com» и «BookingCom»
 * (docs/channex: bookings-collection.md:340 и :1192), поэтому репозиторий отдаёт одно имя для показа
 * (plans/channel-name-canonical-2026-09-22.md). Имя канала, которого у объекта нет, не меняется.
 */
describe('главная: имя канала у проживаний', () => {
  afterEach(() => forgetPropertyRef());

  it('один канал под двумя именами Channex приходит на «Главную» одним именем', async () => {
    const row = (channel: string | null, source = 'OTA') => ({
      arrivalDate: new Date('2026-10-10T00:00:00Z'),
      departureDate: new Date('2026-10-12T00:00:00Z'),
      status: 'CONFIRMED',
      adults: 1,
      children: 0,
      price: 1000n,
      accommodationType: { code: 'M' },
      reservation: { source, channel },
    });
    const findMany = vi
      .fn()
      .mockResolvedValue([row('Booking.com'), row('BookingCom'), row(null, 'DESK'), row('Klook')]);
    const prisma = {
      db: {
        property: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p1', name: 'Luxx Aparts', organizationId: null }),
        },
        reservationItem: { findMany },
      },
    } as unknown as PrismaService;
    const repo = new PrismaDashboardRepository(prisma, {} as ChessboardService);

    const stays = await repo.stays('2026-10-01', '2026-10-31');

    expect(stays.map((s) => s.channel)).toEqual(['Booking.com', 'Booking.com', null, 'Klook']);
  });
});
