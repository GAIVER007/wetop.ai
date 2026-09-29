import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { accessDeniedMessage, type MembershipRole } from '@pms/domain';
import { HotelService } from './hotel.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/**
 * Каталог услуг из «Настроек объекта» (SET3, `plans/property-settings-set2-set3-2026-09-28.md`): правят владелец и
 * управляющий — право `settings` включает «услуги» (ADR-107 о ролях); администратор нет. Удаления нет — начисления
 * ссылаются на услугу, в архив уходит `active = false`. Код услуги даёт система. Каждая правка — в журнал «было/стало».
 */
type Row = {
  id: string;
  propertyId: string;
  code: string;
  nameRu: string;
  nameKz: string | null;
  price: bigint;
  group: string | null;
  active: boolean;
};
function setup(rows: Row[] = []) {
  const store = rows.map((r) => ({ ...r }));
  const property = { id: 'prop-a', name: 'Хостел А', organizationId: 'org-a' };
  const db = {
    property: { findFirst: vi.fn().mockResolvedValue(property) },
    service: {
      findMany: vi
        .fn()
        .mockImplementation(async () => store.filter((r) => r.propertyId === 'prop-a')),
      findFirst: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { propertyId: string; code: string } }) =>
            store.find((r) => r.propertyId === where.propertyId && r.code === where.code) ?? null,
        ),
      create: vi.fn().mockImplementation(async ({ data }: { data: Omit<Row, 'id'> }) => {
        const row = {
          id: `svc-id-${store.length + 1}`,
          ...data,
          nameKz: data.nameKz ?? null,
        } as Row;
        store.push(row);
        return row;
      }),
      update: vi
        .fn()
        .mockImplementation(
          async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
            const row = store.find((r) => r.id === where.id)!;
            Object.assign(row, data);
            return row;
          },
        ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const service = new HotelService({
    db: { ...db, $transaction: async (fn: (t: typeof db) => Promise<unknown>) => fn(db) },
  } as unknown as PrismaService);
  return { service, db, store };
}
const as = <T>(role: MembershipRole, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u1', organizationId: 'org-a', role }, fn);
const water: Row = {
  id: 'svc-1',
  propertyId: 'prop-a',
  code: 'WATER',
  nameRu: 'Вода 0,5',
  nameKz: null,
  price: 70000n,
  group: 'Минибар',
  active: true,
};

describe('каталог услуг в «Настройках объекта»', () => {
  it('список — весь каталог, с архивными, цена строкой тиынов', async () => {
    const { service } = setup([
      water,
      { ...water, id: 'svc-2', code: 'OLD', nameRu: 'Старое', active: false },
    ]);
    const list = await as('MANAGER', () => service.serviceCatalog());
    expect(list).toEqual([
      { code: 'WATER', name: 'Вода 0,5', group: 'Минибар', priceMinor: '70000', active: true },
      { code: 'OLD', name: 'Старое', group: 'Минибар', priceMinor: '70000', active: false },
    ]);
  });

  it('владелец создаёт услугу: код даёт система, запись — в журнал', async () => {
    const { service, db } = setup();
    const created = await as('OWNER', () =>
      service.createService({ name: 'Трансфер', group: 'Трансфер', price: '8000' }),
    );
    expect(created).toMatchObject({ name: 'Трансфер', priceMinor: '800000', active: true });
    expect(created.code).toMatch(/^svc-[0-9a-z]{8}$/);
    expect(db.service.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId: 'prop-a',
        code: created.code,
        nameRu: 'Трансфер',
        group: 'Трансфер',
        price: 800000n,
        active: true,
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Service',
        action: 'hotel.service.created',
        after: {
          code: created.code,
          name: 'Трансфер',
          group: 'Трансфер',
          priceMinor: '800000',
          active: true,
        },
      }),
    });
  });

  it('управляющий меняет цену и отправляет в архив — «было/стало» только по изменённому', async () => {
    const { service, db } = setup([water]);
    await as('MANAGER', () =>
      service.updateService('WATER', { price: '750', active: false, group: 'Минибар' }),
    );
    expect(db.service.update).toHaveBeenCalledWith({
      where: { id: 'svc-1' },
      data: { price: 75000n, active: false },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Service',
        entityId: 'svc-1',
        action: 'hotel.service.updated',
        before: { priceMinor: '70000', active: true },
        after: { priceMinor: '75000', active: false },
      }),
    });
  });

  it('без изменений — ни записи, ни строки журнала', async () => {
    const { service, db } = setup([water]);
    await as('OWNER', () => service.updateService('WATER', { price: '700' }));
    expect(db.service.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('администратор каталог не правит и не читает', async () => {
    const { service, db } = setup([water]);
    const denied = accessDeniedMessage('settings');
    await expect(
      as('STAFF', () => service.createService({ name: 'Вода', price: '700' })),
    ).rejects.toThrow(denied);
    await expect(as('STAFF', () => service.updateService('WATER', { price: '1' }))).rejects.toThrow(
      denied,
    );
    await expect(as('STAFF', () => service.serviceCatalog())).rejects.toThrow(denied);
    expect(db.service.create).not.toHaveBeenCalled();
    expect(db.service.update).not.toHaveBeenCalled();
  });

  it('неверный ввод и чужой код — отказ словами', async () => {
    const { service } = setup([water]);
    await expect(
      as('OWNER', () => service.createService({ name: 'Вода', price: '0' })),
    ).rejects.toThrow('Цена — больше нуля, например 700 или 700,50');
    await expect(as('OWNER', () => service.updateService('NOPE', { price: '1' }))).rejects.toThrow(
      'Услуга не найдена',
    );
  });
});
