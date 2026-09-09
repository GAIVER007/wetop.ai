import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { ChessboardModule } from './chessboard.module';
import { CHESSBOARD_REPOSITORY, type ChessboardRepository } from './chessboard.repository';

/** Вымышленные данные: 2 ячейки, 1 проживание, 1 бронь. */
const fakeRepo: ChessboardRepository = {
  async units() {
    return [
      {
        id: 'u1',
        code: '9001',
        kind: 'ROOM',
        accommodationTypeCode: 'exely-900001',
        accommodationTypeName: 'Тестовая одиночная',
      },
      {
        id: 'u2',
        code: '9010',
        kind: 'BED',
        accommodationTypeCode: 'exely-900003',
        accommodationTypeName: 'Тестовый dorm',
      },
    ];
  },
  async allocations(from, to) {
    return from <= '2026-09-11' && to >= '2026-09-10'
      ? [
          {
            unitId: 'u2',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            itemId: 'i1',
            itemStatus: 'CONFIRMED',
            confirmationNumber: 'B-1',
            guestLabel: 'Гость Тест-abc',
          },
        ]
      : [];
  },
  async blocks() {
    return [];
  },
  async reservation(number) {
    if (number !== 'B-1') return null;
    return {
      confirmationNumber: 'B-1',
      source: 'OTA',
      channel: 'booking.com',
      status: 'CONFIRMED',
      arrivalDate: '2026-09-10',
      departureDate: '2026-09-12',
      adults: 1,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: '1200000',
      notes: null,
      primaryGuest: { label: 'Гость Тест-abc', citizenship: 'KAZ' },
      items: [
        {
          id: 'i1',
          accommodationTypeName: 'Тестовый dorm',
          arrivalDate: '2026-09-10',
          departureDate: '2026-09-12',
          status: 'CONFIRMED',
          priceMinor: '1200000',
          unitCode: '9010',
          guests: [{ label: 'Гость Тест-abc', isPrimary: true }],
        },
      ],
    };
  },
};

describe('GET /chessboard, GET /reservations/:number', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [ChessboardModule] })
      .overrideProvider(CHESSBOARD_REPOSITORY)
      .useValue(fakeRepo)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns rows × dates with states and per-day summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/chessboard?from=2026-09-10&to=2026-09-12')
      .expect(200);
    expect(res.body.dates).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.rows[1].cells.map((c: { state: string }) => c.state)).toEqual([
      'OCCUPIED',
      'OCCUPIED',
      'FREE',
    ]);
    expect(res.body.summary['2026-09-10']).toEqual({ occupied: 1, blocked: 0, free: 1 });
  });
  it('defaults to today + 14 days when no range is given', async () => {
    const res = await request(app.getHttpServer()).get('/chessboard').expect(200);
    expect(res.body.dates).toHaveLength(15);
  });
  it('rejects a bad or too long range with 400', async () => {
    await request(app.getHttpServer()).get('/chessboard?from=2026-09-10&to=2026-13-40').expect(400);
    await request(app.getHttpServer()).get('/chessboard?from=2026-01-01&to=2026-12-31').expect(400);
  });
  it('returns a reservation card by confirmation number, 404 when unknown', async () => {
    const res = await request(app.getHttpServer()).get('/reservations/B-1').expect(200);
    expect(res.body).toMatchObject({
      confirmationNumber: 'B-1',
      channel: 'booking.com',
      totalAmountMinor: '1200000',
    });
    expect(res.body.items[0].unitCode).toBe('9010');
    await request(app.getHttpServer()).get('/reservations/nope').expect(404);
  });
});
