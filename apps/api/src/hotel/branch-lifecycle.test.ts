import { describe, expect, it, vi } from 'vitest';
import { BranchLifecycleService } from './branch-lifecycle';
import { withSignedInUser } from '../auth/request-context';
const org = '11111111-1111-4111-8111-111111111111',
  id = '22222222-2222-4222-8222-222222222222';
const actor = (role: 'OWNER' | 'STAFF', fn: () => Promise<unknown>) =>
  withSignedInUser({ userId: id, organizationId: org, role }, fn);
const setup = () => {
  const tx = {
    location: {
      findFirst: vi.fn().mockResolvedValue({ id, name: 'Existing branch', status: 'ACTIVE' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn() },
  };
  const db = { $transaction: vi.fn(async (fn: (v: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { tx, db, service: new BranchLifecycleService({ db } as never) };
};
describe('branch archive', () => {
  it('archives the existing location and records audit without deleting configuration', async () => {
    const { service, tx } = setup();
    await actor('OWNER', () => service.setStatus(id, 'ARCHIVED'));
    expect(tx.location.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ARCHIVED' } }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityId: id, action: 'location.archived' }),
      }),
    );
  });
  it('rejects staff before database access', async () => {
    const { service, db } = setup();
    await expect(actor('STAFF', () => service.setStatus(id, 'ARCHIVED'))).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a foreign branch', async () => {
    const { service, tx } = setup();
    tx.location.findFirst.mockResolvedValue(null);
    await expect(actor('OWNER', () => service.setStatus(id, 'ARCHIVED'))).rejects.toThrow();
    expect(tx.location.updateMany).not.toHaveBeenCalled();
  });
});
