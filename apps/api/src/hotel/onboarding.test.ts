import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { OnboardingService } from './onboarding';

const NOW = new Date('2026-09-21T12:00:00Z');
const PROPERTY = {
  id: 'prop-1',
  name: 'Хостел на Абая',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  organizationId: 'org-1',
};

function makeDb(opts: { property?: typeof PROPERTY | null; typeCount?: number } = {}) {
  let property: Record<string, unknown> | null =
    opts.property === undefined ? PROPERTY : opts.property;
  const rec = {
    businesses: [] as { id: string; organizationId: string; name: string; vertical: string }[],
    locations: [] as {
      id: string;
      businessId: string;
      name: string;
      timezone: string;
      currency: string;
    }[],
    properties: [] as Record<string, unknown>[],
    buildings: [] as unknown[],
    floors: [] as unknown[],
    types: [] as { id: string; propertyId: string; code: string; name: string }[],
    rooms: [] as { id: string; roomNumber: string; capacity: number; isDorm: boolean }[],
    units: [] as { code: string; accommodationTypeId: string; kind: string }[],
    ratePlans: [] as { id: string; code: string; name: string; currency: string }[],
    links: [] as { ratePlanId: string; accommodationTypeId: string }[],
    dailyRates: [] as { occupancy: number; price: bigint }[],
    audits: [] as { action: string; entityId: string; after: Record<string, unknown> }[],
  };
  let seq = 0;
  const id = (p: string) => `${p}-${(seq += 1)}`;
  const db = {
    organization: {
      async findUnique() {
        return { name: 'Гостиница Пример' };
      },
      async findUniqueOrThrow() {
        return { name: 'Гостиница Пример' };
      },
    },
    business: {
      async findFirst() {
        return null;
      },
      async create({ data }: { data: { organizationId: string; name: string; vertical: string } }) {
        const row = { id: id('biz'), ...data };
        rec.businesses.push(row);
        return { id: row.id };
      },
    },
    location: {
      async create({
        data,
      }: {
        data: { businessId: string; name: string; timezone: string; currency: string };
      }) {
        const row = { id: id('loc'), ...data };
        rec.locations.push(row);
        return { id: row.id };
      },
    },
    property: {
      async findFirst() {
        return property ? { ...property } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { id: id('prop'), ...data };
        rec.properties.push(row);
        property = row;
        return row;
      },
    },
    accommodationType: {
      async count() {
        return (opts.typeCount ?? 0) + rec.types.length;
      },
      async create({ data }: { data: { propertyId: string; code: string; name: string } }) {
        const row = { id: id('type'), ...data };
        rec.types.push(row);
        return { id: row.id };
      },
    },
    building: {
      async create({ data }: { data: unknown }) {
        rec.buildings.push(data);
        return { id: id('bld') };
      },
    },
    floor: {
      async create({ data }: { data: unknown }) {
        rec.floors.push(data);
        return { id: id('flr') };
      },
    },
    physicalRoom: {
      async create({ data }: { data: { roomNumber: string; capacity: number; isDorm: boolean } }) {
        const row = { id: id('room'), ...data };
        rec.rooms.push(row);
        return { id: row.id };
      },
    },
    inventoryUnit: {
      async create({
        data,
      }: {
        data: { code: string; accommodationTypeId: string; kind: string };
      }) {
        rec.units.push(data);
        return { id: id('unit') };
      },
    },
    ratePlan: {
      async create({ data }: { data: { code: string; name: string; currency: string } }) {
        const row = { id: id('rp'), ...data };
        rec.ratePlans.push(row);
        return { id: row.id };
      },
    },
    ratePlanAccommodationType: {
      async createMany({ data }: { data: { ratePlanId: string; accommodationTypeId: string }[] }) {
        rec.links.push(...data);
        return { count: data.length };
      },
    },
    dailyRate: {
      async createMany({ data }: { data: { occupancy: number; price: bigint }[] }) {
        rec.dailyRates.push(...data);
        return { count: data.length };
      },
    },
    auditLog: {
      async create({
        data,
      }: {
        data: { action: string; entityId: string; after: Record<string, unknown> };
      }) {
        rec.audits.push(data);
        return {};
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(db);
    },
    // запирание строки организации в provision (два первых сохранения не заводят два объекта)
    async $executeRaw() {
      return 1;
    },
  };
  const hotel = { forget: () => {} };
  return { rec, hotel, service: new OnboardingService({ db } as never, hotel as never) };
}

const SETUP = {
  currency: 'KZT',
  categories: [
    { name: 'Двухместный', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 3, priceMinor: 2100000 },
    { name: 'Койко-место', kind: 'DORM_BED', capacityAdults: 1, units: 8, priceMinor: 900000 },
  ],
};

const asUser = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u-1', organizationId: 'org-1' }, fn);

describe('OnboardingService', () => {
  it('status: пустой объект просит онбординг, отдаёт имя и валюту', async () => {
    const { service } = makeDb();
    const s = await asUser(() => service.status());
    expect(s).toEqual({ needed: true, name: 'Хостел на Абая', currency: 'KZT' });
  });

  it('status: объект с категориями онбординг не просит', async () => {
    const { service } = makeDb({ typeCount: 2 });
    expect((await asUser(() => service.status())).needed).toBe(false);
  });

  it('provision: заводит номера, тариф, связи и цены под объект своей организации', async () => {
    const { service, rec } = makeDb();
    const out = await asUser(() => service.provision(SETUP, NOW));
    expect(out).toEqual({ ok: true, categories: 2, units: 11 });
    expect(rec.buildings).toHaveLength(1);
    expect(rec.floors).toHaveLength(1);
    expect(rec.types).toHaveLength(2);
    expect(rec.types.every((t) => t.propertyId === 'prop-1')).toBe(true);
    expect(rec.units).toHaveLength(11);
    expect(rec.units.map((u) => u.code).slice(0, 3)).toEqual(['101', '102', '103']);
    expect(rec.ratePlans).toHaveLength(1);
    expect(rec.ratePlans[0]).toMatchObject({
      code: 'main',
      name: 'Основной тариф',
      currency: 'KZT',
    });
    expect(rec.links).toHaveLength(2);
    // цены: (2 occupancy у «Двухместного» + 1 у «Койко-места») × 500 дней горизонта
    expect(rec.dailyRates).toHaveLength(3 * 500);
    expect(rec.dailyRates.some((r) => r.price === 2100000n && r.occupancy === 2)).toBe(true);
    expect(rec.dailyRates.some((r) => r.price === 900000n && r.occupancy === 1)).toBe(true);
    // SECURITY.md §6: первые цены и фонд — в журнале одной строкой, без 1 500 строк цен
    expect(rec.audits).toEqual([
      expect.objectContaining({
        action: 'hotel.onboarding',
        entityId: 'prop-1',
        after: expect.objectContaining({
          currency: 'KZT',
          categories: [
            expect.objectContaining({ name: 'Двухместный', units: 3 }),
            expect.objectContaining({ name: 'Койко-место', units: 8 }),
          ],
          days: 500,
        }),
      }),
    ]);
  });

  it('provision: повторный онбординг закрыт — объект уже настроен', async () => {
    const { service } = makeDb({ typeCount: 2 });
    await expect(asUser(() => service.provision(SETUP, NOW))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('provision: пустой список категорий — 400, а не 500', async () => {
    const { service } = makeDb();
    await expect(
      asUser(() => service.provision({ currency: 'KZT', categories: [] }, NOW)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('provision: негодная цена — 400 с текстом из домена', async () => {
    const { service } = makeDb();
    await expect(
      asUser(() =>
        service.provision(
          {
            currency: 'KZT',
            categories: [
              { name: 'A', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 1, priceMinor: -5 },
            ],
          },
          NOW,
        ),
      ),
    ).rejects.toThrow(/цена за ночь/);
  });

  it('онбординг только для вошедшего человека: служебный ходок и вошедший без организации не проходят', async () => {
    const svc = makeDb().service;
    await expect(svc.status()).rejects.toBeInstanceOf(ForbiddenException); // нет человека за запросом
    await expect(
      withSignedInUser({ userId: 'u-9', organizationId: null }, () => svc.status()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  /*
   * После сброса платформы (ADR-118) у организации остаются владелец и членство, а объекта нет: онбординг должен
   * начинаться с пустого места, а не отвечать «объекта нет» (plans/onboarding-without-property-2026-09-28.md).
   */
  it('status: у организации нет объекта (после сброса) — онбординг нужен, имя — организации, объект не создаётся', async () => {
    const { service, rec } = makeDb({ property: null });
    const s = await asUser(() => service.status());
    expect(s).toEqual({ needed: true, name: 'Гостиница Пример', currency: 'KZT' });
    expect(rec.properties).toHaveLength(0);
  });

  it('provision: у организации нет объекта — создаёт его в цепочке и заводит номера под ним', async () => {
    const { service, rec } = makeDb({ property: null });
    const res = await asUser(() => service.provision(SETUP, NOW));
    expect(res).toMatchObject({ ok: true, categories: 2, units: 11 });
    expect(rec.businesses).toEqual([
      expect.objectContaining({ organizationId: 'org-1', vertical: 'HOSPITALITY' }),
    ]);
    expect(rec.locations).toHaveLength(1);
    expect(rec.properties).toEqual([
      expect.objectContaining({
        organizationId: 'org-1',
        locationId: rec.locations[0]!.id,
        name: 'Гостиница Пример',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      }),
    ]);
    const propertyId = rec.properties[0]!['id'];
    expect(rec.types.every((t) => t.propertyId === propertyId)).toBe(true);
    expect(rec.audits).toEqual([
      expect.objectContaining({ action: 'hotel.onboarding', entityId: propertyId }),
    ]);
  });
});

it.each(['BEAUTY', 'FOOD_SERVICE'] as const)(
  'MV3 rejects explicit %s Business in legacy hotel onboarding',
  async (vertical) => {
    const { service, rec } = makeDb({ property: null });
    const actor = {
      userId: 'u-1',
      organizationId: 'org-1',
      role: 'OWNER' as const,
      scope: 'BUSINESS' as const,
      businessId: 'pilot-business',
      vertical,
    };
    await expect(withSignedInUser(actor, () => service.status())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      withSignedInUser(actor, () => service.provision(SETUP, NOW)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rec.businesses).toHaveLength(0);
    expect(rec.properties).toHaveLength(0);
  },
);
