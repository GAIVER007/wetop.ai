import { describe, expect, it } from 'vitest';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { readSiteFactsSnapshot, SiteFactsService } from './site-facts.service';

/**
 * SITE-2: сборщик «что WETOP знает о филиале» на подставной базе. Проверяет: цены салона по правилу филиала
 * (своя цена, валюта каталога), только мастера филиала, часы из смен, меню в порядке ресторана, оценки заказов,
 * доступ по праву `settings` в месте, отказ на чужой филиал. Настоящая база: tests/integration/site-facts.test.ts.
 */
const ORG = '00000000-0000-4000-8000-0000000000a0';
const BIZ = '00000000-0000-4000-8000-0000000000b0';
const OTHER_BIZ = '00000000-0000-4000-8000-0000000000b9';
const LOC = '00000000-0000-4000-8000-0000000000c0';
const LOC2 = '00000000-0000-4000-8000-0000000000c2';
const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

function fakeDb(vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') {
  const calls: Array<{ model: string; args: unknown }> = [];
  const log = (model: string) => (args: unknown) => {
    calls.push({ model, args });
  };
  const db = {
    location: {
      findFirstOrThrow: async (args: unknown) => (log('location')(args), { id: LOC, name: 'Филиал', address: 'ул. Тестовая, 1', phone: '+7 700 000 00 01', currency: 'KZT' }),
      findFirst: async (args: { where: { id: string } }) => {
        log('location.findFirst')(args);
        return args.where.id === LOC ? { id: LOC, businessId: BIZ, business: { vertical } } : null;
      },
      findMany: async () => [
        { id: LOC, name: 'Филиал', businessId: BIZ, business: { vertical }, marketingSite: { state: 'PAUSED' } },
        { id: LOC2, name: 'Другой', businessId: OTHER_BIZ, business: { vertical: 'FOOD_SERVICE' }, marketingSite: null },
      ],
    },
    siteAsset: { count: async () => 2 },
    property: {
      findFirst: async () => ({ id: 'p1', address: null, city: 'Астана', checkInTime: '14:00', checkOutTime: '12:00' }),
    },
    accommodationType: { findMany: async () => [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] },
    beautyService: {
      findMany: async (args: unknown) => (
        log('beautyService')(args),
        [
          // своя цена филиала
          { id: 's1', name: 'Маникюр', category: 'Ногти', durationMinutes: 60, price: 700000n, currency: 'KZT', active: true, locations: [{ enabled: true, priceOverride: 800000n, durationOverride: null }] },
          // цена каталога в валюте филиала
          { id: 's2', name: 'Стрижка', category: null, durationMinutes: 45, price: 500000n, currency: 'KZT', active: true, locations: [{ enabled: true, priceOverride: null, durationOverride: 50 }] },
          // в филиале не включена
          { id: 's3', name: 'Не здесь', category: null, durationMinutes: 30, price: 100n, currency: 'KZT', active: true, locations: [] },
          // валюта каталога другая и своей цены нет: не продаётся
          { id: 's4', name: 'В долларах', category: null, durationMinutes: 30, price: 100n, currency: 'USD', active: true, locations: [{ enabled: true, priceOverride: null, durationOverride: null }] },
        ]
      ),
    },
    employee: {
      findMany: async (args: unknown) => (
        log('employee')(args),
        [{ id: 'e2', name: 'Мастер Б', services: [{ serviceId: 's2' }, { serviceId: 's3' }] }, { id: 'e1', name: 'Мастер А', services: [] }]
      ),
    },
    workingHours: {
      findMany: async () => [
        { weekday: 1, timeFrom: t('10:00'), timeTo: t('18:00') },
        { weekday: 1, timeFrom: t('09:00'), timeTo: t('20:00') },
        { weekday: 3, timeFrom: t('11:00'), timeTo: t('19:00') },
      ],
    },
    menuCategory: {
      findMany: async (args: unknown) => (
        log('menuCategory')(args),
        [
          { name: 'Супы', items: [{ id: 'd1', name: 'Борщ', weightGrams: 300, price: 250000n, currency: 'KZT', photo: { menuItemId: 'd1' } }] },
          { name: 'Пустой', items: [] },
          { name: 'Горячее', items: [{ id: 'd2', name: 'Плов', weightGrams: null, price: 350000n, currency: 'KZT', photo: null }] },
        ]
      ),
    },
    servicePeriod: {
      findMany: async () => [
        { weekday: 5, timeFrom: t('12:00'), timeTo: t('16:00'), endsNextDay: false },
        { weekday: 5, timeFrom: t('18:00'), timeTo: t('02:00'), endsNextDay: true },
      ],
    },
    restaurantOrderRating: { aggregate: async () => ({ _avg: { stars: 4.25 }, _count: { _all: 8 } }) },
    beautyPositionAssignment: { findMany: async () => [] },
    menuItemPhoto: {},
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return { db, calls };
}

const actor = (role: 'OWNER' | 'MANAGER' | 'STAFF', scopes: Array<{ role: 'MANAGER' | 'ADMIN'; businessId: string; locationId: string | null }> = []) =>
  ({ userId: 'u1', organizationId: ORG, role, scopes }) as Parameters<typeof withSignedInUser>[0];

describe('readSiteFactsSnapshot', () => {
  it('салон: цены по правилу филиала, длительность филиала, только продаваемые услуги, мастера и часы', async () => {
    const { db } = fakeDb('BEAUTY');
    const snap = await readSiteFactsSnapshot(db as never, { organizationId: ORG, businessId: BIZ, locationId: LOC, vertical: 'BEAUTY' });
    expect(snap.catalog).toEqual({
      kind: 'services',
      items: [
        { code: 's2', name: 'Стрижка', price: { minor: '500000', currency: 'KZT' }, durationMin: 50 },
        { code: 's1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60, category: 'Ногти' },
      ],
    });
    // специализация только из услуг, которые продаются в филиале
    expect(snap.staff).toEqual([{ id: 'e2', name: 'Мастер Б', specialization: 'Стрижка' }, { id: 'e1', name: 'Мастер А', specialization: null }]);
    expect(snap.hours.days).toEqual([{ weekday: 1, open: '09:00', close: '20:00' }, { weekday: 3, open: '11:00', close: '19:00' }]);
    expect(snap.reviews).toBeNull();
  });

  it('салон: мастера и смены берутся только этого филиала и бизнеса', async () => {
    const { db, calls } = fakeDb('BEAUTY');
    await readSiteFactsSnapshot(db as never, { organizationId: ORG, businessId: BIZ, locationId: LOC, vertical: 'BEAUTY' });
    expect(calls.find((c) => c.model === 'employee')!.args).toMatchObject({ where: { businessId: BIZ, status: 'ACTIVE', locations: { some: { locationId: LOC } } } });
    expect(calls.find((c) => c.model === 'beautyService')!.args).toMatchObject({ where: { businessId: BIZ, active: true } });
  });

  it('ресторан: меню в порядке ресторана без пустых разделов, часы до утра, оценки, фото блюд в счёте фото', async () => {
    const { db, calls } = fakeDb('FOOD_SERVICE');
    const snap = await readSiteFactsSnapshot(db as never, { organizationId: ORG, businessId: BIZ, locationId: LOC, vertical: 'FOOD_SERVICE' });
    expect(snap.catalog.items.map((i) => [i.code, i.category, i.price?.minor])).toEqual([
      ['d1', 'Супы', '250000'],
      ['d2', 'Горячее', '350000'],
    ]);
    expect(snap.hours.days).toEqual([{ weekday: 5, open: '12:00', close: '02:00' }]);
    expect(snap.reviews).toEqual({ avg: 4.25, count: 8 });
    expect(snap.photosCount).toBe(3);
    expect(calls.find((c) => c.model === 'menuCategory')!.args).toMatchObject({ where: { businessId: BIZ, active: true } });
  });

  it('гостиница: категории, город и заезд из объекта', async () => {
    const { db } = fakeDb('HOSPITALITY');
    const snap = await readSiteFactsSnapshot(db as never, { organizationId: ORG, businessId: BIZ, locationId: LOC, vertical: 'HOSPITALITY' });
    expect(snap.catalog).toEqual({ kind: 'rooms', items: [{ code: 'std', name: 'Стандарт', capacityAdults: 2 }] });
    expect(snap.location.city).toBe('Астана');
    expect(snap.hours).toEqual({ days: [], checkInTime: '14:00', checkOutTime: '12:00' });
  });
});

describe('SiteFactsService: доступ', () => {
  const service = (vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') => new SiteFactsService({ db: fakeDb(vertical).db } as unknown as PrismaService);

  it('владелец получает факты салона с подсказками', async () => {
    const facts = await withSignedInUser(actor('OWNER'), () => service('BEAUTY').facts(LOC));
    expect(facts.vertical).toBe('BEAUTY');
    expect(facts.location.whatsapp).toBeNull();
    expect(facts.gaps.map((g) => g.key)).toEqual(['whatsapp', 'photos']);
  });

  it('неверный id 400, чужой или несуществующий филиал 404', async () => {
    await expect(withSignedInUser(actor('OWNER'), () => service('BEAUTY').facts('x'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(withSignedInUser(actor('OWNER'), () => service('BEAUTY').facts(LOC2))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('без права settings в этом месте 403; управляющий филиала проходит', async () => {
    await expect(withSignedInUser(actor('STAFF'), () => service('BEAUTY').facts(LOC))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      withSignedInUser(actor('STAFF', [{ role: 'MANAGER', businessId: OTHER_BIZ, locationId: null }]), () => service('BEAUTY').facts(LOC)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const ok = await withSignedInUser(actor('STAFF', [{ role: 'MANAGER', businessId: BIZ, locationId: LOC }]), () => service('FOOD_SERVICE').facts(LOC));
    expect(ok.catalog.kind).toBe('menu');
  });

  it('без входа 403', async () => {
    await expect(withSignedInUser(null, () => service('BEAUTY').facts(LOC))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('список филиалов: статус сайта, только места с правом settings', async () => {
    const owner = await withSignedInUser(actor('OWNER'), () => service('BEAUTY').locations());
    expect(owner.items).toEqual([
      { id: LOC, name: 'Филиал', vertical: 'BEAUTY', siteStatus: 'DRAFT' },
      { id: LOC2, name: 'Другой', vertical: 'FOOD_SERVICE', siteStatus: 'NONE' },
    ]);
    const manager = await withSignedInUser(actor('STAFF', [{ role: 'MANAGER', businessId: OTHER_BIZ, locationId: null }]), () => service('BEAUTY').locations());
    expect(manager.items.map((i) => i.id)).toEqual([LOC2]);
  });
});
