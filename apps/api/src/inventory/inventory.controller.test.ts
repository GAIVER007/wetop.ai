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
      code: 'exely-900001',
      name: 'Тестовая одиночная',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      capacityChildren: 0,
      exelyId: '900001',
    },
    {
      code: 'exely-900003',
      name: 'Тестовый dorm',
      kind: 'DORM_BED',
      capacityAdults: 1,
      capacityChildren: 0,
      exelyId: '900003',
    },
  ],
  units: [
    {
      code: '9001',
      exelyRoomNumber: '9001',
      kind: 'ROOM',
      accommodationTypeCode: 'exely-900001',
      roomNumber: '9001',
      roomCapacity: 1,
      isDorm: false,
    },
    {
      code: '9010',
      exelyRoomNumber: '9010',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      roomNumber: '9010',
      roomCapacity: 1,
      isDorm: true,
    },
    {
      code: '9011',
      exelyRoomNumber: '9011',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
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
          code: 'exely-900001',
          name: 'Тестовая одиночная',
          units: 1,
          maxGuests: 1,
          capacityAdults: 1,
        },
        { code: 'exely-900003', name: 'Тестовый dorm', units: 2, maxGuests: 2, capacityAdults: 1 },
      ],
    });
  });

  it('/inventory/units lists every unit with its category name', async () => {
    const res = await request(app.getHttpServer()).get('/inventory/units').expect(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[1]).toEqual({
      code: '9010',
      exelyRoomNumber: '9010',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Тестовый dorm',
      roomNumber: '9010',
      roomCapacity: 1,
      isDorm: true,
    });
  });

  it('/inventory/units?category= filters by accommodation type code', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/units?category=exely-900003')
      .expect(200);
    expect(res.body.map((u: { code: string }) => u.code)).toEqual(['9010', '9011']);
  });

  it('/inventory/units?category=unknown returns an empty list, not an error', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/units?category=nope')
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
