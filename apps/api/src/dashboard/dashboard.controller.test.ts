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

/** Подставной репозиторий: 2 единицы, по одной занятой клетке в день, один заезд 05.10 на 300 000 тиын. */
const calls: string[] = [];
const repo: DashboardRepository = {
  async board(from, to) {
    calls.push(`board ${from}..${to}`);
    return {
      categories: [{ code: 'ROOM', name: 'Двухместная', units: 2 }],
      days: dateRange(from, to).map((date) => ({
        date,
        occupied: 1,
        free: 1,
        blocked: 0,
        byCategory: { ROOM: { units: 2, occupied: 1, free: 1, blocked: 0 } },
      })),
      unassigned: 0,
    };
  },
  async stays(from, to) {
    return from <= '2026-10-05' && to >= '2026-10-05'
      ? [
          {
            arrivalDate: '2026-10-05',
            departureDate: '2026-10-06',
            status: 'CONFIRMED',
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
      ? [{ kind: 'ACCOMMODATION', amountMinor: 300_000n, categoryCode: 'ROOM' }]
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
      .get('/desk/dashboard?from=2026-10-05&to=2026-10-06')
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
      from: '2026-10-03',
      to: '2026-10-04',
      revenue: { totalMinor: '0' },
      // клетки заняты, начислений нет — средняя цена 0, а не деление на ноль
      adrMinor: '0',
      arrivals: { count: 0 },
    });
    expect(calls).toEqual(['board 2026-10-05..2026-10-06', 'board 2026-10-03..2026-10-04']);
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
});
