import { describe, expect, it, vi } from 'vitest';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

const customerId = '11111111-1111-4111-8111-111111111111';
const originalBirthDate = new Date('1990-05-01T00:00:00.000Z');

function setup() {
  let stored: { id: string; isVip: boolean; birthDate: Date | null } = {
    id: customerId,
    isVip: true,
    birthDate: originalBirthDate,
  };
  const customer = {
    findFirst: vi.fn(async () => ({ ...stored })),
    update: vi.fn(async ({ data }: { data: { isVip?: boolean; birthDate?: Date | null } }) => {
      stored = { ...stored, ...data };
      return { ...stored };
    }),
  };
  const service = new FoodService({ db: {} } as PrismaService);
  const internals = service as unknown as {
    write: (
      permission: string,
      fn: (tx: { customer: typeof customer }, scope: Record<string, string>) => Promise<unknown>,
    ) => Promise<unknown>;
    audit: () => Promise<void>;
  };
  internals.write = async (_permission, fn) =>
    fn(
      { customer },
      {
        organizationId: '22222222-2222-4222-8222-222222222222',
        businessId: '33333333-3333-4333-8333-333333333333',
        timezone: 'Asia/Almaty',
      },
    );
  internals.audit = vi.fn(async () => undefined);

  return { service, customer, stored: () => stored };
}

describe('FoodService.updateCustomer birthDate PATCH semantics', () => {
  it('distinguishes omitted, null, new and invalid dates without changing VIP unexpectedly', async () => {
    const omitted = setup();
    await expect(omitted.service.updateCustomer(customerId, { isVip: false })).resolves.toEqual({
      id: customerId,
      isVip: false,
      birthDate: '1990-05-01',
    });
    expect(omitted.customer.update).toHaveBeenCalledWith({
      where: { id: customerId },
      data: { isVip: false },
    });

    const cleared = setup();
    await expect(cleared.service.updateCustomer(customerId, { birthDate: null })).resolves.toEqual({
      id: customerId,
      isVip: true,
      birthDate: null,
    });
    expect(cleared.stored()).toMatchObject({ isVip: true, birthDate: null });

    const changed = setup();
    await expect(
      changed.service.updateCustomer(customerId, { birthDate: '1995-06-15' }),
    ).resolves.toEqual({ id: customerId, isVip: true, birthDate: '1995-06-15' });
    expect(changed.stored()).toMatchObject({
      isVip: true,
      birthDate: new Date('1995-06-15T00:00:00.000Z'),
    });

    const invalid = setup();
    await expect(
      invalid.service.updateCustomer(customerId, { isVip: false, birthDate: '2999-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(invalid.customer.update).not.toHaveBeenCalled();
    expect(invalid.stored()).toMatchObject({ isVip: true, birthDate: originalBirthDate });
  });
});
