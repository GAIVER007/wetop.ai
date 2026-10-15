import { describe, it, expect, vi } from 'vitest';
import { BusinessCardsService } from './business-cards';
import { withSignedInUser } from '../auth/request-context';
const org = '11111111-1111-4111-8111-111111111111',
  id = '33333333-3333-4333-8333-333333333333';
const at = new Date('2026-10-13T00:00:00Z');
const row = {
  id,
  organizationId: org,
  name: 'Демо бизнес',
  description: null,
  coverImage: null,
  updatedAt: at,
  vertical: 'HOSPITALITY',
  status: 'ACTIVE',
  revision: '2026-10-13T00:00:00.000000Z',
};
function setup(found: unknown = row) {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ ...row, name: 'Новое название' }]),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = {
    $queryRaw: vi.fn().mockResolvedValue(found ? [found] : []),
    $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const storage = { put: vi.fn(), delete: vi.fn(), signedGet: vi.fn(), exists: vi.fn() };
  return { tx, db, storage, service: new BusinessCardsService({ db } as never, storage) };
}

const actor = (role: 'OWNER' | 'MANAGER' | 'STAFF', fn: () => Promise<unknown>) =>
  withSignedInUser({ userId: id, organizationId: org, role }, fn);
const body = {
  name: 'Новое название',
  description: 'Описание',
  expectedUpdatedAt: at.toISOString(),
  removeCover: '0',
};
describe('business card persistence', () => {
  it('lists an owner business even when it has no objects', async () => {
    const { service, db } = setup();
    const cards = await actor('OWNER', () => service.list([]));
    expect(cards).toHaveLength(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it('does not expose empty businesses to scoped staff', async () => {
    const { service, db } = setup();
    expect(await actor('STAFF', () => service.list([]))).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects managers before accessing the database', async () => {
    const { service, db } = setup();
    await expect(actor('MANAGER', () => service.save(id, body))).rejects.toThrow('владелец');
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects a foreign or invisible business without writes', async () => {
    const { service, db } = setup(null);
    await expect(actor('OWNER', () => service.save(id, body))).rejects.toThrow('недоступен');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('saves metadata and its audit atomically without requiring storage', async () => {
    const { service, tx } = setup();
    await actor('OWNER', () => service.save(id, body));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it('rejects concurrent stale edits', async () => {
    const { service, tx } = setup();
    tx.$executeRaw.mockResolvedValue(0);
    await expect(actor('OWNER', () => service.save(id, body))).rejects.toThrow('изменилась');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  it('rejects injected tenant and storage fields', async () => {
    const { service, db } = setup();
    await expect(
      actor('OWNER', () =>
        service.save(id, { ...body, organizationId: org, storageRef: 'private' }),
      ),
    ).rejects.toThrow('Лишние поля');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects oversized photos before image decode and storage', async () => {
    const { service, storage } = setup();
    await expect(
      actor('OWNER', () => service.save(id, body, { buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })),
    ).rejects.toThrow('5 МБ');
    expect(storage.put).not.toHaveBeenCalled();
  });
});
