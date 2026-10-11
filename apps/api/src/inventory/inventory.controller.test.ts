import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { InventoryImportPlan } from '@pms/domain';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InventoryModule } from './inventory.module';
import { INVENTORY_REPOSITORY, type InventoryRepository } from './inventory.repository';
import { PrismaService } from '../database/prisma.provider';

/** Вымышленный фонд: 2 категории, 3 единицы. Реальных данных в тестах нет (ADR-010). */
const plan: InventoryImportPlan = {
  buildingName: 'Тестовый',
  floorName: '1',
  accommodationTypes: [
    {
      code: 'category-single',
      name: 'Тестовая одиночная',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      capacityChildren: 0,
    },
    {
      code: 'category-dorm',
      name: 'Тестовый dorm',
      kind: 'DORM_BED',
      capacityAdults: 1,
      capacityChildren: 0,
    },
  ],
  units: [
    {
      code: '9001',
      kind: 'ROOM',
      accommodationTypeCode: 'category-single',
      roomNumber: '9001',
      roomCapacity: 1,
      isDorm: false,
    },
    {
      code: '9010',
      kind: 'BED',
      accommodationTypeCode: 'category-dorm',
      roomNumber: '9010',
      roomCapacity: 1,
      isDorm: true,
    },
    {
      code: '9011',
      kind: 'BED',
      accommodationTypeCode: 'category-dorm',
      roomNumber: '9011',
      roomCapacity: 1,
      isDorm: true,
    },
  ],
};
const fakeRepo: InventoryRepository = {
  async read() {
    return {
      property: { name: 'Тестовый хостел', timezone: 'Asia/Almaty', currency: 'KZT' },
      plan,
      blocks: 0,
    };
  },
  // Живое состояние (ADR-108): у 9010 действующая блокировка, 9011 в состояниях не найден —
  // сервис подставляет безопасное умолчание (грязно, в продаже, без блокировки)
  async states() {
    return [
      { code: '9001', housekeepingStatus: 'INSPECTED' as const, active: true, block: null },
      {
        code: '9010',
        housekeepingStatus: 'DIRTY' as const,
        active: true,
        block: { dateTo: '2026-10-01', type: 'MAINTENANCE', reason: 'ремонт: тестовый кран' },
      },
    ];
  },
  async trendSource() {
    return {
      today: '2026-10-09',
      units: plan.units.map((u) => ({
        code: u.code,
        kind: u.kind,
        createdAt: '2026-01-01',
        housekeepingStatus: 'DIRTY' as const,
      })),
      blocks: [{ code: '9010', dateFrom: '2026-10-08', dateTo: '2026-10-12' }],
      hkEvents: [],
    };
  },
  async staysToday() {
    return {
      today: '2026-10-09',
      byCode: new Map([
        [
          '9001',
          [
            {
              confirmationNumber: 'T-1',
              startDate: '2026-10-09',
              endDate: '2026-10-11',
              status: 'CONFIRMED',
              guest: 'Тестов Т.',
            },
          ],
        ],
      ]),
    };
  },
};

describe('GET /inventory', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InventoryModule] })
      .overrideProvider(INVENTORY_REPOSITORY)
      .useValue(fakeRepo)
      .overrideProvider(PrismaService) // БД в контрактном тесте не нужна
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('/inventory/summary returns totals, categories and property', async () => {
    const res = await request(app.getHttpServer()).get('/inventory/summary').expect(200);
    expect(res.body).toEqual({
      property: { name: 'Тестовый хостел', timezone: 'Asia/Almaty', currency: 'KZT' },
      totalUnits: 3,
      rooms: 1,
      beds: 2,
      maxGuests: 3,
      physicalRooms: 3,
      blocks: 0,
      byCategory: [
        {
          code: 'category-single',
          name: 'Тестовая одиночная',
          units: 1,
          maxGuests: 1,
          capacityAdults: 1,
        },
        { code: 'category-dorm', name: 'Тестовый dorm', units: 2, maxGuests: 2, capacityAdults: 1 },
      ],
    });
  });

  it('/inventory/units lists every unit with its category name and live state', async () => {
    const res = await request(app.getHttpServer()).get('/inventory/units').expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[1]).toEqual({
      code: '9010',
      kind: 'BED',
      accommodationTypeCode: 'category-dorm',
      accommodationTypeName: 'Тестовый dorm',
      roomNumber: '9010',
      roomCapacity: 1,
      isDorm: true,
      buildingName: null,
      floorName: null,
      housekeepingStatus: 'DIRTY',
      active: true,
      block: { dateTo: '2026-10-01', type: 'MAINTENANCE', reason: 'ремонт: тестовый кран' },
    });
    // место без строки состояния получает безопасное умолчание, а не 500
    expect(res.body[2]).toMatchObject({
      code: '9011',
      housekeepingStatus: 'DIRTY',
      active: true,
      block: null,
    });
  });

  it('/inventory/units?category= filters by accommodation type code', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/units?category=category-dorm')
      .expect(200);
    expect(res.body.map((u: { code: string }) => u.code)).toEqual(['9010', '9011']);
  });

  it('/inventory/units?category=unknown returns an empty list, not an error', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/units?category=nope')
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('/inventory/trend отдаёт динамику за период и отклоняет чужой период', async () => {
    const res = await request(app.getHttpServer()).get('/inventory/trend?days=7').expect(200);
    expect(res.body).toMatchObject({ days: 7, from: '2026-10-02', to: '2026-10-09' });
    expect(res.body.metrics.unavailable).toMatchObject({ now: 1, before: 0, delta: 1 });
    await request(app.getHttpServer()).get('/inventory/trend?days=5').expect(400);
  });

  it('/inventory/occupancy: заезд сегодня и свободные места', async () => {
    const res = await request(app.getHttpServer()).get('/inventory/occupancy').expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({ code: '9001', state: 'ARRIVING', guest: 'Тестов Т.' });
    expect(res.body[1]).toMatchObject({ code: '9010', state: 'FREE', guest: null });
  });
});
