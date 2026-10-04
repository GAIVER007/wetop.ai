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
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'p1', name: 'Luxx Aparts', organizationId: null }),
        },
        reservationItem: { findMany },
      },
    } as unknown as PrismaService;
    const repo = new PrismaDashboardRepository(prisma, {} as ChessboardService);

    const stays = await repo.stays('2026-10-01', '2026-10-31');

    expect(stays.map((s) => s.channel)).toEqual(['Booking.com', 'Booking.com', null, 'Klook']);
  });
});

/** Аналитика v2, AN1: тип фонда берётся из единиц шахматки, «без ячейки» и выручка по дням — по категориям. */
describe('аналитика: тип категории, без ячейки по категориям, дата начисления', () => {
  afterEach(() => forgetPropertyRef());

  it('тип категории — из единиц шахматки; проживание без ячейки считается один раз в своей категории', async () => {
    // REP3: у номера '1' в каждом куске одна занятая клетка с заездом — ночи и заезды
    // складываются по кускам, а куски не пересекаются, поэтому ничего не задваивается
    const unit = (code: string, kind: 'ROOM' | 'BED', typeCode: string, typeName: string) => ({
      unit: {
        id: code,
        code,
        kind,
        accommodationTypeCode: typeCode,
        accommodationTypeName: typeName,
      },
      cells: code === '1' ? [{ state: 'OCCUPIED', isArrival: true }] : [],
    });
    const board = vi.fn().mockImplementation(async (from: string, to: string) => ({
      dates: from === to ? [from] : [from, to],
      rows: [
        unit('1', 'ROOM', 'SGL', 'Одноместная'),
        unit('5', 'BED', 'DRM', 'Мужская общая'),
        unit('6', 'BED', 'DRM', 'Мужская общая'),
      ],
      summary: {},
      byCategory: {},
      // одно и то же проживание в двух кусках периода — одно
      unassigned: [
        { confirmationNumber: 'T-1', categoryCode: 'DRM', arrivalDate: '2026-10-01' },
        { confirmationNumber: 'T-2', categoryCode: 'SGL', arrivalDate: '2026-10-01' },
      ],
    }));
    const repo = new PrismaDashboardRepository(
      {} as PrismaService,
      { board } as unknown as ChessboardService,
    );

    const b = await repo.board('2026-10-01', '2026-12-31');

    expect(board.mock.calls.length).toBeGreaterThan(1);
    expect(b.categories).toEqual([
      { code: 'SGL', name: 'Одноместная', units: 1, kind: 'ROOM' },
      { code: 'DRM', name: 'Мужская общая', units: 2, kind: 'BED' },
    ]);
    expect(b.unassignedByCategory).toEqual({ DRM: 1, SGL: 1 });
    // клетки до единицы: по одной занятой на кусок, сумма равна числу кусков
    expect(b.units.find((u) => u.code === '1')).toEqual({
      code: '1',
      categoryCode: 'SGL',
      categoryName: 'Одноместная',
      kind: 'ROOM',
      occupiedNights: board.mock.calls.length,
      blockedNights: 0,
      arrivals: board.mock.calls.length,
    });
    expect(b.units.find((u) => u.code === '5')).toMatchObject({
      kind: 'BED',
      occupiedNights: 0,
    });
  });

  it('групповая бронь на три койки без места — три проживания, даже если период разбит на куски', async () => {
    const bed = {
      confirmationNumber: 'G-1',
      categoryCode: 'DRM',
      arrivalDate: '2026-11-28',
      departureDate: '2026-12-05',
    };
    const board = vi.fn().mockImplementation(async (from: string, to: string) => ({
      dates: [from, to],
      rows: [
        {
          unit: {
            id: '5',
            code: '5',
            kind: 'BED',
            accommodationTypeCode: 'DRM',
            accommodationTypeName: 'Мужская общая',
          },
          cells: [],
        },
      ],
      summary: {},
      byCategory: {},
      // проживания группы одинаковы до последнего поля и приходят в каждом куске, который задевают
      unassigned: [bed, bed, bed],
    }));
    const repo = new PrismaDashboardRepository(
      {} as PrismaService,
      { board } as unknown as ChessboardService,
    );

    const b = await repo.board('2026-10-01', '2026-12-31');

    expect(board.mock.calls.length).toBeGreaterThan(1);
    expect(b.unassignedByCategory).toEqual({ DRM: 3 });
  });

  it('начисление несёт дату услуги — по ней строится выручка по дням', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        kind: 'ACCOMMODATION',
        amount: 500_000n,
        serviceDate: new Date('2026-10-05T00:00:00Z'),
        folio: { reservationItem: { accommodationType: { code: 'SGL' } } },
      },
    ]);
    const prisma = {
      db: {
        property: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'p1', name: 'Luxx Aparts', organizationId: null }),
        },
        charge: { findMany },
      },
    } as unknown as PrismaService;
    const repo = new PrismaDashboardRepository(prisma, {} as ChessboardService);

    const charges = await repo.charges('2026-10-01', '2026-10-31');

    expect(charges).toEqual([
      {
        kind: 'ACCOMMODATION',
        amountMinor: 500_000n,
        categoryCode: 'SGL',
        serviceDate: '2026-10-05',
      },
    ]);
    expect(findMany.mock.calls[0]![0].select).toMatchObject({ serviceDate: true });
  });
});

/** Q-209: бронь — это Reservation; проживание несёт её id и статус, чтобы «Аналитика» считала брони, а не места */
describe('аналитика: проживание знает свою бронь', () => {
  afterEach(() => forgetPropertyRef());

  it('id и статус брони приходят вместе с проживанием', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        arrivalDate: new Date('2026-10-10T00:00:00Z'),
        departureDate: new Date('2026-10-12T00:00:00Z'),
        status: 'CANCELLED',
        adults: 1,
        children: 0,
        price: 1000n,
        reservationId: 'res-1',
        accommodationType: { code: 'M' },
        reservation: { source: 'DESK', channel: null, status: 'CONFIRMED' },
      },
    ]);
    const prisma = {
      db: {
        property: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'p1', name: 'Luxx Aparts', organizationId: null }),
        },
        reservationItem: { findMany },
      },
    } as unknown as PrismaService;
    const repo = new PrismaDashboardRepository(prisma, {} as ChessboardService);

    const [stay] = await repo.stays('2026-10-01', '2026-10-31');

    expect(stay).toMatchObject({
      status: 'CANCELLED',
      reservationId: 'res-1',
      reservationStatus: 'CONFIRMED',
    });
    expect(findMany.mock.calls[0]![0].select).toMatchObject({
      reservationId: true,
      reservation: { select: { status: true } },
    });
  });
});
