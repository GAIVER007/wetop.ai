import { describe, expect, it, vi } from 'vitest';
import type { DbTx } from '@pms/database';
import { findOrCreateCustomer } from './identity';

describe('Общий helper клиента: только разрешённые поля', () => {
  it('не сохраняет служебный kind и не принимает подмену server scope/ID', async () => {
    const customer = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) };
    const body = { kind: 'new', id: 'forged', organizationId: 'foreign', firstName: 'Тест', lastName: null, phone: '+77000006001' };
    const result = await findOrCreateCustomer({ customer } as unknown as Pick<DbTx, 'customer'>, 'own', body);
    expect(customer.create).toHaveBeenCalledWith({ data: {
      id: result.id, organizationId: 'own', firstName: 'Тест', lastName: null, phone: '+77000006001',
    } });
    expect(result.id).not.toBe('forged');
  });

  it('не скрывает сбой базы под видом дубля', async () => {
    const failure = new Error('Synthetic storage failure');
    const customer = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockRejectedValue(failure) };
    await expect(findOrCreateCustomer({ customer } as unknown as Pick<DbTx, 'customer'>, 'own',
      { firstName: 'Тест', lastName: null, phone: null })).rejects.toBe(failure);
  });
});
