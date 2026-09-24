import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HotelModule } from './hotel.module';
import { PrismaService } from '../database/prisma.provider';

describe('Hotel read projections', () => {
  let app: INestApplication;
  const property = {
    id: 'test-property',
    name: 'Тестовый хостел',
    legalName: null,
    bin: null,
    address: null,
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  };
  const findFirst = vi.fn();
  const groupBy = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [HotelModule] })
      .overrideProvider(PrismaService)
      .useValue({
        db: {
          property: { findFirst },
          reservation: { groupBy },
          ratePlan: { findMany: vi.fn().mockResolvedValue([]) },
          accommodationType: { count: vi.fn().mockResolvedValue(3) },
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(property);
    groupBy.mockResolvedValue([]);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('returns stored hotel settings without inventing defaults', async () => {
    const r = await request(app.getHttpServer()).get('/hotel/settings').expect(200);
    expect(r.body.property).toEqual(property);
    expect(r.body.ratePlans).toEqual([]);
    // реквизиты для печатных форм — из записи объекта, не из кода (проверка SECURITY.md 24.09.2026, Н12)
    expect(findFirst.mock.calls[0]?.[0]?.select).toMatchObject({
      name: true,
      legalName: true,
      bin: true,
      address: true,
    });
  });
  /**
   * Волна 4: настройки объекта читает КАЖДАЯ страница стойки (их запрашивает `layout.tsx`), а это
   * два запроса в базу Сингапура на каждый показ экрана. Название, часы и тарифы меняет импорт,
   * не стойка, поэтому короткий кэш в памяти API безопаснее лишней нагрузки на пулер.
   */
  it('настройки объекта читаются из базы один раз на окно кэша, а не на каждый запрос', async () => {
    const first = await request(app.getHttpServer()).get('/hotel/settings').expect(200);
    const afterFirst = findFirst.mock.calls.length;
    const second = await request(app.getHttpServer()).get('/hotel/settings').expect(200);
    expect(second.body).toEqual(first.body);
    // второй запрос в то же окно базу не трогает; без кэша обращений было бы вдвое больше
    expect(findFirst.mock.calls.length).toBe(afterFirst);
  });

  it('aggregates by channel/source/currency with precise money and separate cancellations', async () => {
    groupBy.mockResolvedValue([
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'KZT',
        status: 'CONFIRMED',
        _count: { _all: 2 },
        _sum: { totalAmount: 9007199254740993n },
      },
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'KZT',
        status: 'CANCELLED',
        _count: { _all: 1 },
        _sum: { totalAmount: 101n },
      },
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'USD',
        status: 'NO_SHOW',
        _count: { _all: 1 },
        _sum: { totalAmount: 100n },
      },
    ]);
    const r = await request(app.getHttpServer())
      .get('/hotel/channel-report?from=2026-09-01&to=2026-09-30')
      .expect(200);
    expect(r.body.rows).toEqual([
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'KZT',
        count: 3,
        cancelled: 1,
        noShow: 0,
        amountMinor: '9007199254741094',
      },
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'USD',
        count: 1,
        cancelled: 0,
        noShow: 1,
        amountMinor: '100',
      },
    ]);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['source', 'channel', 'currency', 'status'],
        where: {
          propertyId: property.id,
          arrivalDate: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30') },
        },
      }),
    );
  });

  it('один канал под двумя именами Channex — одна строка отчёта (plans/channel-name-canonical-2026-09-22.md)', async () => {
    groupBy.mockResolvedValue([
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'KZT',
        status: 'CONFIRMED',
        _count: { _all: 2 },
        _sum: { totalAmount: 1000n },
      },
      {
        source: 'OTA',
        channel: 'BookingCom',
        currency: 'KZT',
        status: 'CANCELLED',
        _count: { _all: 1 },
        _sum: { totalAmount: 500n },
      },
      {
        source: 'DESK',
        channel: null,
        currency: 'KZT',
        status: 'CONFIRMED',
        _count: { _all: 1 },
        _sum: { totalAmount: 700n },
      },
    ]);
    const r = await request(app.getHttpServer())
      .get('/hotel/channel-report?from=2026-10-01&to=2026-12-31')
      .expect(200);
    expect(r.body.rows).toEqual([
      {
        source: 'OTA',
        channel: 'Booking.com',
        currency: 'KZT',
        count: 3,
        cancelled: 1,
        noShow: 0,
        amountMinor: '1500',
      },
      {
        source: 'DESK',
        channel: null,
        currency: 'KZT',
        count: 1,
        cancelled: 0,
        noShow: 0,
        amountMinor: '700',
      },
    ]);
  });
  it('filters by stored reservation status and returns a real empty report', async () => {
    const r = await request(app.getHttpServer())
      .get('/hotel/channel-report?from=2026-09-01&to=2026-09-01&status=CONFIRMED')
      .expect(200);
    expect(r.body.rows).toEqual([]);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });
  it.each([
    'from=2026-02-30&to=2026-03-01',
    'from=2026-09-02&to=2026-09-01',
    'from=2020-01-01&to=2026-09-01',
    'from=x&to=2026-09-01',
    'from=2026-09-01&to=2026-09-02&status=BOGUS',
    '',
  ])('rejects invalid query before touching the database: %s', async (q) => {
    await request(app.getHttpServer()).get(`/hotel/channel-report?${q}`).expect(400);
    expect(findFirst).not.toHaveBeenCalled();
    expect(groupBy).not.toHaveBeenCalled();
  });
  it('does not disguise an unconfigured property as a zero report', async () => {
    findFirst.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/hotel/channel-report?from=2026-09-01&to=2026-09-01')
      .expect(404);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
