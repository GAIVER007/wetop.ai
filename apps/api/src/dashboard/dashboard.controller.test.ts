import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dateRange } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardService } from '../chessboard/chessboard.service';
import { DashboardModule } from './dashboard.module';
import { DASHBOARD_REPOSITORY, type DashboardRepository } from './dashboard.repository';

/**
 * Подставной репозиторий: 2 номера, по одному занятому в день, один заезд 05.10 на 300 000 тиын;
 * рядом 3 свободные койки — чтобы тип фонда (Аналитика v2, AN1) было что делить.
 */
const calls: string[] = [];
const repo: DashboardRepository = {
  async board(from, to) {
    calls.push(`board ${from}..${to}`);
    return {
      categories: [
        { code: 'ROOM', name: 'Двухместная', units: 2, kind: 'ROOM' },
        { code: 'DORM', name: 'Мужская общая', units: 3, kind: 'BED' },
      ],
      days: dateRange(from, to).map((date) => ({
        date,
        occupied: 1,
        free: 4,
        blocked: 0,
        byCategory: {
          ROOM: { units: 2, occupied: 1, free: 1, blocked: 0 },
          DORM: { units: 3, occupied: 0, free: 3, blocked: 0 },
        },
      })),
      unassignedByCategory: { ROOM: 1 },
      // REP3: per-unit клетки тех же дней — R1 занят каждый день, R2 закрыт блоком, койки пустые
      units: [
        {
          code: 'R2',
          categoryCode: 'ROOM',
          categoryName: 'Двухместная',
          kind: 'ROOM' as const,
          occupiedNights: 0,
          blockedNights: dateRange(from, to).length,
          arrivals: 0,
        },
        {
          code: 'R1',
          categoryCode: 'ROOM',
          categoryName: 'Двухместная',
          kind: 'ROOM' as const,
          occupiedNights: dateRange(from, to).length,
          blockedNights: 0,
          arrivals: from <= '2026-10-05' && to >= '2026-10-05' ? 1 : 0,
        },
        ...['D1', 'D2', 'D3'].map((code) => ({
          code,
          categoryCode: 'DORM',
          categoryName: 'Мужская общая',
          kind: 'BED' as const,
          occupiedNights: 0,
          blockedNights: 0,
          arrivals: 0,
        })),
      ],
    };
  },
  async stays(from, to) {
    return from <= '2026-10-05' && to >= '2026-10-05'
      ? [
          {
            arrivalDate: '2026-10-05',
            departureDate: '2026-10-06',
            status: 'CONFIRMED',
            reservationId: 'res-1',
            reservationStatus: 'CONFIRMED',
            adults: 1,
            children: 0,
            priceMinor: 300_000n,
            source: 'OTA',
            channel: 'Booking.com',
            categoryCode: 'ROOM',
          },
        ]
      : [];
  },
  async charges(from, to) {
    return from <= '2026-10-05' && to >= '2026-10-05'
      ? [
          {
            kind: 'ACCOMMODATION',
            amountMinor: 300_000n,
            categoryCode: 'ROOM',
            serviceDate: '2026-10-05',
          },
        ]
      : [];
  },
  async payments() {
    return [];
  },
  async refundsMinor() {
    return 0n;
  },
};

describe('desk dashboard API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [DashboardModule] })
      .overrideProvider(DASHBOARD_REPOSITORY)
      .useValue(repo)
      .overrideProvider(ChessboardService)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('период и предыдущий отрезок той же длины; загрузка из шахматки, деньги из счетов', async () => {
    const r = await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06&fund=rooms')
      .expect(200);
    expect(r.body.current).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-06',
      nights: 2,
      units: 2,
      occupancy: { unitNights: 4, occupiedNights: 2, percent: 50 },
      revenue: { accommodationMinor: '300000', totalMinor: '300000' },
      adrMinor: '150000',
      revparMinor: '75000',
      arrivals: { count: 1, guests: 1, cancelled: 0, noShow: 0 },
      sources: [{ source: 'OTA', channel: 'Booking.com', count: 1, share: 100 }],
    });
    expect(r.body.previous).toMatchObject({
      fund: 'rooms',
      from: '2026-10-03',
      to: '2026-10-04',
      revenue: { totalMinor: '0' },
      // клетки заняты, начислений нет — средняя цена 0, а не деление на ноль
      adrMinor: '0',
      arrivals: { count: 0 },
    });
    expect(calls).toEqual(['board 2026-10-05..2026-10-06', 'board 2026-10-03..2026-10-04']);
  });

  it('тип фонда: по умолчанию весь фонд, койки — отдельно; оба периода считаются одним типом', async () => {
    const all = await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06')
      .expect(200);
    expect(all.body.current).toMatchObject({
      fund: 'all',
      funds: { rooms: 2, beds: 3 },
      units: 5,
      occupancy: { unitNights: 10, occupiedNights: 2, percent: 20 },
      bookings: { total: 1, active: 1, averageMinor: '300000' },
    });
    expect(all.body.current.daily[0]).toMatchObject({ date: '2026-10-05', revenueMinor: '300000' });
    const beds = await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06&fund=beds')
      .expect(200);
    expect(beds.body.current).toMatchObject({
      fund: 'beds',
      units: 3,
      occupancy: { unitNights: 6, occupiedNights: 0, percent: 0 },
      revenue: { accommodationMinor: '0' },
      bookings: { total: 0, averageMinor: null },
    });
    expect(beds.body.previous).toMatchObject({ fund: 'beds', units: 3 });
  });

  it('REP3 «По номерам»: клетки до единицы, итог сходится со сводкой, тип фонда режет; неверный период — 400', async () => {
    const r = await request(app.getHttpServer())
      .get('/desk/dashboard/units?from=2026-10-05&to=2026-10-06')
      .expect(200);
    // порядок: категория по алфавиту, внутри — код
    expect(r.body.rows.map((x: { code: string }) => x.code)).toEqual([
      'R1',
      'R2',
      'D1',
      'D2',
      'D3',
    ]);
    expect(r.body.rows[0]).toMatchObject({
      code: 'R1',
      categoryName: 'Двухместная',
      occupiedNights: 2,
      percent: 100,
      arrivals: 1,
    });
    expect(r.body.rows[1]).toMatchObject({ code: 'R2', blockedNights: 2, percent: 0 });
    // итог — суммы тех же клеток, что занятость сводки того же фонда
    const dash = await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06')
      .expect(200);
    expect(r.body.totals).toMatchObject({
      units: 5,
      unitNights: 10,
      occupiedNights: dash.body.current.occupancy.occupiedNights,
      arrivals: 1,
    });
    expect(r.body.unassignedStays).toBe(1);

    const rooms = await request(app.getHttpServer())
      .get('/desk/dashboard/units?from=2026-10-05&to=2026-10-06&fund=rooms')
      .expect(200);
    expect(rooms.body.rows).toHaveLength(2);
    expect(rooms.body.totals).toMatchObject({ units: 2, percent: 50 });

    await request(app.getHttpServer()).get('/desk/dashboard/units').expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard/units?from=2026-10-06&to=2026-10-05')
      .expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard/units?from=2026-10-05&to=2026-10-06&fund=apartments')
      .expect(400);
  });

  it('неизвестный тип фонда — 400, а не молча весь фонд', async () => {
    await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06&fund=apartments')
      .expect(400);
  });

  it('без дат — 400; to раньше from — 400; больше 366 дней — 400', async () => {
    await request(app.getHttpServer()).get('/desk/dashboard').expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard?from=2026-10-06&to=2026-10-05')
      .expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard?from=2025-01-01&to=2026-10-05')
      .expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard?from=05.10.2026&to=2026-10-05')
      .expect(400);
  });

  it('эффективность каналов: строка канала, каналы без броней по запросу, сравнение и отборы проверяются', async () => {
    const r = await request(app.getHttpServer())
      .get('/desk/dashboard/channels?from=2026-10-01&to=2026-10-31&compareFrom=2025-10-01&compareTo=2025-10-31')
      .expect(200);
    expect(r.body.current.rows).toEqual([
      expect.objectContaining({ label: 'Booking.com', revenueMinor: '300000', nights: 1, revenueShare: 100 }),
    ]);
    expect(r.body.previous.totals).toEqual({ revenueMinor: '0', nights: 0, adrMinor: null, bookings: 0 });
    const all = await request(app.getHttpServer())
      .get('/desk/dashboard/channels?from=2026-10-01&to=2026-10-31&empty=1')
      .expect(200);
    expect(all.body.previous).toBeNull();
    expect(all.body.current.rows.map((x: { label: string }) => x.label)).toEqual(
      expect.arrayContaining(['Booking.com', 'Agoda', 'Trip.com', 'Hostelworld']),
    );
    await request(app.getHttpServer())
      .get('/desk/dashboard/channels?from=2026-10-01&to=2026-10-31&sort=price')
      .expect(400);
    await request(app.getHttpServer())
      .get('/desk/dashboard/channels?from=2026-10-01&to=2026-10-31&compareFrom=2025-10-01')
      .expect(400);
  });
});
