import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { accessDeniedMessage, type MembershipRole } from '@pms/domain';
import { HotelService } from './hotel.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

/**
 * Способы оплаты объекта (DATA_MODEL §21.6, ADR-152): объект включает, выключает и упорядочивает восемь
 * системных способов. Без строк умолчания; сохранение пишет все восемь одной транзакцией и журнал «было/стало».
 * Право `settings`: владелец и управляющий; администратору раздел закрыт.
 */
const ALL = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  'DEPOSIT',
  'CARD_GUARANTEE',
];
function setup(rows: Array<{ method: string; enabled: boolean; sortOrder: number }> = []) {
  const property = {
    id: 'prop-a',
    name: 'Хостел А',
    organizationId: 'org-a',
    legalName: null,
    address: null,
    phone: null,
    email: null,
    bin: null,
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  };
  const findMany = vi.fn().mockResolvedValue(rows);
  const upsert = vi.fn().mockResolvedValue({});
  const audit = vi.fn().mockResolvedValue({});
  const db = {
    property: { findFirst: vi.fn().mockResolvedValue(property) },
    paymentMethodSetting: { findMany, upsert },
    auditLog: { create: audit },
    ratePlan: { findMany: vi.fn().mockResolvedValue([]) },
    accommodationType: { count: vi.fn().mockResolvedValue(1) },
  };
  const tx = { ...db };
  const service = new HotelService({
    db: { ...db, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
  } as unknown as PrismaService);
  return { service, findMany, upsert, audit };
}
const as = <T>(role: MembershipRole, fn: () => Promise<T>) =>
  withSignedInUser({ userId: 'u1', organizationId: 'org-a', role }, fn);
const all = (enabled = true) => ALL.map((method) => ({ method, enabled }));

describe('способы оплаты объекта', () => {
  it('без строк все восемь включены в системном порядке; строки задают порядок и включение', async () => {
    const empty = setup();
    const r = await as('OWNER', () => empty.service.paymentMethods());
    expect(r.methods).toEqual(all());
    const stored = setup([
      { method: 'KASPI', enabled: true, sortOrder: 0 },
      { method: 'CASH', enabled: false, sortOrder: 1 },
    ]);
    const s = await as('MANAGER', () => stored.service.paymentMethods());
    expect(s.methods.slice(0, 2)).toEqual([
      { method: 'KASPI', enabled: true },
      { method: 'CASH', enabled: false },
    ]);
    expect(s.methods).toHaveLength(8);
  });

  it('сохранение: все восемь строк одной транзакцией, порядок это позиция в списке, журнал «было/стало»', async () => {
    const { service, upsert, audit } = setup();
    const methods = [
      { method: 'KASPI', enabled: true },
      { method: 'CASH', enabled: false },
      ...all().filter((m) => m.method !== 'KASPI' && m.method !== 'CASH'),
    ];
    const r = await as('OWNER', () => service.updatePaymentMethods({ methods }));
    expect(r.methods).toEqual(methods);
    expect(upsert).toHaveBeenCalledTimes(8);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { propertyId_method: { propertyId: 'prop-a', method: 'KASPI' } },
      create: { propertyId: 'prop-a', method: 'KASPI', enabled: true, sortOrder: 0 },
      update: { enabled: true, sortOrder: 0 },
    });
    expect(upsert.mock.calls[1]?.[0]).toMatchObject({
      update: { enabled: false, sortOrder: 1 },
    });
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Property',
        entityId: 'prop-a',
        action: 'hotel.payment_methods.updated',
        before: { enabled: ALL, order: ALL },
        after: {
          enabled: methods.filter((m) => m.enabled).map((m) => m.method),
          order: methods.map((m) => m.method),
        },
      }),
    });
  });

  it('ничего не изменилось: записи нет, журнала нет', async () => {
    const { service, upsert, audit } = setup();
    await as('OWNER', () => service.updatePaymentMethods({ methods: all() }));
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('неверное тело: 400 словами разбора, ничего не пишется', async () => {
    const { service, upsert } = setup();
    await expect(
      as('OWNER', () => service.updatePaymentMethods({ methods: all(false) })),
    ).rejects.toThrow('Хотя бы один способ оплаты должен быть включён');
    await expect(
      as('OWNER', () => service.updatePaymentMethods({ methods: all().slice(0, 7) })),
    ).rejects.toThrow('В списке не хватает');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('администратор не читает и не правит: право settings (ADR-107)', async () => {
    const { service } = setup();
    await expect(as('STAFF', () => service.paymentMethods())).rejects.toThrow(
      accessDeniedMessage('settings'),
    );
    await expect(as('STAFF', () => service.updatePaymentMethods({ methods: all() }))).rejects.toThrow(
      accessDeniedMessage('settings'),
    );
  });
});
