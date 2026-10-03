import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BranchesService } from './branches';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
const input = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Тестовый филиал',
  address: '',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
};
const run = <T>(fn: () => Promise<T>, role: 'OWNER' | 'STAFF' = 'OWNER') =>
  withSignedInUser({ userId: 'synthetic', organizationId: 'org-test', role }, fn);
function setup(existing: unknown = null) {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    property: { findFirst: vi.fn(async () => existing) },
    // срез B2: путь салона идёт по Location и своему бизнесу, объект в нём не участвует
    location: { findFirst: vi.fn(async () => existing) },
    business: { findFirst: vi.fn(async () => ({ id: 'business-test' })) },
    organization: { findUniqueOrThrow: vi.fn(async () => ({ name: 'Тестовая сеть' })) },
    auditLog: { create: vi.fn(async () => undefined) },
  };
  const transaction = vi.fn(async (fn: (db: unknown) => unknown) => fn(tx));
  const service = new BranchesService({
    db: { $transaction: transaction },
  } as unknown as PrismaService);
  return { service, transaction, tx };
}
describe('создание филиала', () => {
  it('сотрудник не создаёт филиал, даже вызывая сервис напрямую', async () => {
    const { service, transaction } = setup();
    await expect(run(() => service.create(input), 'STAFF')).rejects.toThrow('владелец');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('не принимает неверный часовой пояс до записи', async () => {
    const { service, transaction } = setup();
    await expect(run(() => service.create({ ...input, timezone: 'Wrong/Test' }))).rejects.toThrow(
      'пояс',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
  it('повтор с тем же UUID возвращает исходный объект', async () => {
    const saved = { ...input, address: null };
    const { service, tx } = setup(saved);
    // срез B2: ответ создания той же формы, что строка списка, значит с направлением филиала
    expect(await run(() => service.create(input))).toEqual({ ...saved, vertical: 'HOSPITALITY' });
    expect(tx.property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: input.id, organizationId: 'org-test' } }),
    );
  });
  it('UUID другой формы не притворяется успешным созданием', async () => {
    const { service } = setup({ ...input, name: 'Другой филиал' });
    await expect(run(() => service.create(input))).rejects.toThrow('повтор');
  });
});

it('создаёт пустой объект в цепочке и возвращает тот же объект при повторе', async () => {
  let saved: Record<string, unknown> | null = null;
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    business: { findFirst: vi.fn(async () => ({ id: 'business-test' })) },
    location: { create: vi.fn(async () => ({ id: 'location-test' })) },
    property: {
      findFirst: vi.fn(async () => saved),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { saved = data; return data; }),
      findFirstOrThrow: vi.fn(async () => saved),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const service = new BranchesService({ db: { $transaction: async (fn: (db: unknown) => unknown) => fn(tx) } } as unknown as PrismaService);
  const first = await run(() => service.create(input));
  const repeat = await run(() => service.create(input));
  expect(repeat).toEqual(first);
  expect(saved).toMatchObject({ organizationId: 'org-test', locationId: 'location-test', id: input.id });
  expect(tx.property.create).toHaveBeenCalledTimes(1);
  expect(tx.location.create).toHaveBeenCalledTimes(1);
  expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
});

/**
 * Филиал салона (срез B2, решения Q-254 и Q-256 от 03.10.2026, ADR-139): та же команда, другая вертикаль.
 * Объекта у салона нет вовсе, поэтому путь создания объекта в неё не заходит.
 */
describe('вертикаль филиала', () => {
  it('без вертикали создаётся гостиница, как было до среза', async () => {
    const { service, tx } = setup();
    await run(() => service.create(input)).catch(() => undefined);
    expect(tx.property.findFirst).toHaveBeenCalled();
  });

  it('вертикаль BEAUTY не трогает объекты вовсе', async () => {
    const { service, tx } = setup();
    await run(() => service.create({ ...input, vertical: 'BEAUTY' })).catch(() => undefined);
    expect(tx.property.findFirst).not.toHaveBeenCalled();
    expect(tx.location.findFirst).toHaveBeenCalled();
  });

  it('незнакомое направление отклоняется до записи', async () => {
    const { service, transaction } = setup();
    await expect(run(() => service.create({ ...input, vertical: 'SPA' }))).rejects.toThrow(
      'направление',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('сотрудник не создаёт и салон', async () => {
    const { service, transaction } = setup();
    await expect(
      run(() => service.create({ ...input, vertical: 'BEAUTY' }), 'STAFF'),
    ).rejects.toThrow('владелец');
    expect(transaction).not.toHaveBeenCalled();
  });
});
