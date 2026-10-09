import 'reflect-metadata';
import { expect, it } from 'vitest';
import { AuthService } from './auth.service';

it('first registration context is resolved only inside the signed-in organization', async () => {
  const calls: unknown[] = [];
  const auth = new AuthService(
    {
      db: {
        business: {
          findFirst: async (query: unknown) => {
            calls.push(query);
            return { id: 'b', vertical: 'FOOD_SERVICE', name: 'Тест' };
          },
        },
        location: {
          findFirst: async (query: unknown) => {
            calls.push(query);
            return { id: 'l', name: 'Филиал' };
          },
        },
      },
    } as never,
    {} as never,
  );
  const result = await (
    auth as unknown as { registrationContext: (org: string) => Promise<unknown> }
  ).registrationContext('own');
  expect(calls[0]).toMatchObject({ where: { organizationId: 'own', status: 'ACTIVE' } });
  expect(calls[1]).toMatchObject({ where: { businessId: 'b', status: 'ACTIVE' } });
  expect(result).toMatchObject({ businessId: 'b', locationId: 'l', vertical: 'FOOD_SERVICE' });
});

it('unknown persisted vertical yields no registration context', async () => {
  const auth = new AuthService(
    { db: { business: { findFirst: async () => ({ id: 'b', vertical: 'UNKNOWN' }) } } } as never,
    {} as never,
  );
  expect(await auth.registrationContext('own')).toBeNull();
});
