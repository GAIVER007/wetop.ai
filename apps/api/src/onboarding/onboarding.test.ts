import { describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { SharedOnboardingService } from './onboarding.module';
const actor: Exclude<Parameters<typeof withSignedInUser>[0], string | null> = {
  userId: 'user',
  organizationId: 'org',
  role: 'OWNER',
  scope: 'LOCATION',
  businessId: 'business',
  locationId: 'location',
  vertical: 'BEAUTY',
};
function fixture() {
  const db = {
    location: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'location',
        businessId: 'business',
        name: 'Филиал',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        business: {
          name: 'Бизнес',
          vertical: 'BEAUTY',
          organization: { status: 'ACTIVE', trialEndsAt: null, locale: 'en' },
        },
      }),
    },
    onboardingProgress: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    beautyService: { findMany: vi.fn().mockResolvedValue([]) },
    employee: { findMany: vi.fn().mockResolvedValue([]) },
    beautyPositionAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  return { db, service: new SharedOnboardingService({ db } as unknown as PrismaService) };
}
describe('MV3 trusted onboarding context', () => {
  it('requires explicit verified Business and Location', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser({ ...actor, businessId: '' }, () => service.status()),
    ).rejects.toThrow();
    expect(db.location.findFirst).not.toHaveBeenCalled();
  });
  it('filters the chain by organization, Business, Location and active status', async () => {
    const { service, db } = fixture();
    const state = await withSignedInUser(actor, () => service.status());
    expect(db.location.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'location',
          businessId: 'business',
          status: 'ACTIVE',
          business: { organizationId: 'org', status: 'ACTIVE' },
        },
      }),
    );
    expect(state.vertical).toBe('BEAUTY');
    expect(state.currentStep).toBe('welcome');
  });
  it('denies another Business without writing anything', async () => {
    const { service, db } = fixture();
    db.location.findFirst.mockResolvedValue(null);
    await expect(withSignedInUser(actor, () => service.status())).rejects.toThrow();
    expect(db.onboardingProgress.upsert).not.toHaveBeenCalled();
  });
  it('STAFF cannot mutate even by calling service directly', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser({ ...actor, role: 'STAFF' }, () => service.save({ action: 'next' })),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects client supplied vertical and tenant selectors', async () => {
    const { service, db } = fixture();
    await expect(
      withSignedInUser(actor, () => service.save({ vertical: 'HOSPITALITY', action: 'next' })),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

it('READ_ONLY organization denies owner mutation before any write', async () => {
  const { service, db } = fixture();
  const location = await db.location.findFirst();
  db.location.findFirst.mockResolvedValue({
    ...location,
    business: { ...location.business, organization: { status: 'READ_ONLY', trialEndsAt: null } },
  });
  await expect(
    withSignedInUser(actor, () => service.save({ action: 'next', draft: {} })),
  ).rejects.toThrow();
  expect(db.$transaction).not.toHaveBeenCalled();
});

/** ORG-LOCALE-20261026: настройка салона показывает язык организации, менять его может только владелец */
it('beauty status carries the organization language; only the owner may change it', async () => {
  const { service } = fixture();
  const owner = await withSignedInUser(actor, () => service.status());
  expect(owner).toMatchObject({ organizationLocale: 'en', canEditLocale: true });
  const manager = await withSignedInUser({ ...actor, role: 'MANAGER' }, () => service.status());
  expect(manager).toMatchObject({ organizationLocale: 'en', canEditLocale: false });
});

it('быстрый запуск: профиль салона сохраняет адрес и телефон филиала, лишнее поле отклоняется', async () => {
  const { service, db } = fixture();
  const update = vi.fn();
  Object.assign(db, {
    location: { ...db.location, update, findUnique: vi.fn().mockResolvedValue({ property: null, _count: {} }) },
    business: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  });
  const draft = {
    businessName: 'Бизнес',
    locationName: 'Филиал',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    address: 'Doha, Garafa, B05',
    phone: '+974 5000 0000',
  };
  await withSignedInUser(actor, () => service.save({ action: 'apply-profile', draft, updatedAt: null }));
  expect(update).toHaveBeenCalledWith({
    where: { id: 'location' },
    data: expect.objectContaining({ address: 'Doha, Garafa, B05', phone: '+974 5000 0000' }),
  });
  await expect(
    withSignedInUser(actor, () =>
      service.save({ action: 'apply-profile', draft: { ...draft, vertical: 'HOSPITALITY' }, updatedAt: null }),
    ),
  ).rejects.toThrow('Неизвестное поле настройки');
});

it('быстрый запуск ресторана: завершение настройки сохраняет адрес и телефон филиала', async () => {
  const { service, db } = fixture();
  const base = await db.location.findFirst();
  db.location.findFirst.mockResolvedValue({
    ...base,
    business: { ...base.business, vertical: 'FOOD_SERVICE' },
  });
  const update = vi.fn();
  db.onboardingProgress.findUnique.mockResolvedValue({
    currentStep: 'review',
    flowVersion: 1,
    draft: {},
    completedAt: null,
    updatedAt: new Date('2026-10-27T00:00:00Z'),
  });
  Object.assign(db, {
    location: { ...db.location, update, findUnique: vi.fn().mockResolvedValue({ property: null, _count: {} }) },
    business: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    $executeRaw: vi.fn(),
  });
  await withSignedInUser(actor, () =>
    service.save({
      action: 'complete',
      draft: {
        businessName: 'Ресторан',
        locationName: 'Филиал',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        address: 'Doha, Pearl, 12',
        phone: '+974 5000 0001',
      },
      updatedAt: '2026-10-27T00:00:00.000Z',
    }),
  );
  expect(update).toHaveBeenCalledWith({
    where: { id: 'location' },
    data: expect.objectContaining({ address: 'Doha, Pearl, 12', phone: '+974 5000 0001' }),
  });
});
