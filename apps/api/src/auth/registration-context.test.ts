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
  expect(calls[2]).toMatchObject({ where: { businessId: 'b', status: 'ACTIVE' } });
  expect(result).toMatchObject({ businessId: 'b', locationId: 'l', vertical: 'FOOD_SERVICE' });
});

it('unknown persisted vertical yields no registration context', async () => {
  const auth = new AuthService(
    { db: { business: { findFirst: async () => ({ id: 'b', vertical: 'UNKNOWN' }) } } } as never,
    {} as never,
  );
  expect(await auth.registrationContext('own')).toBeNull();
});

it('does not choose the earliest business when verification is reopened with multiple businesses', async () => {
  const auth = new AuthService(
    {
      db: {
        business: {
          findFirst: async ({ where }: { where: { id?: unknown } }) =>
            where.id
              ? { id: 'second', vertical: 'BEAUTY', name: 'Другой' }
              : { id: 'first', vertical: 'BEAUTY', name: 'Первый' },
        },
        location: { findFirst: async () => ({ id: 'location', name: 'Филиал' }) },
      },
    } as never,
    {} as never,
  );
  expect(await auth.registrationContext('own')).toBeNull();
});

it('сотрудник с областью доступа получает первый назначенный ему филиал, а не самый ранний в организации (A3/F6)', async () => {
  const queries: unknown[] = [];
  const auth = new AuthService(
    {
      db: {
        business: {
          findMany: async (query: unknown) => {
            queries.push(query);
            return [
              {
                id: 'b-hotel',
                name: 'Гостиница',
                vertical: 'HOSPITALITY',
                locations: [
                  { id: 'l-1', name: 'Филиал 1' },
                  { id: 'l-2', name: 'Филиал 2' },
                ],
              },
              {
                id: 'b-salon',
                name: 'Салон',
                vertical: 'BEAUTY',
                locations: [{ id: 'l-3', name: 'Салон 1' }],
              },
            ];
          },
        },
      },
    } as never,
    {} as never,
  );
  const hotelSecond = await auth.registrationContext('own', {
    role: 'MANAGER',
    scopes: [{ role: 'MANAGER', businessId: 'b-hotel', locationId: 'l-2' }],
  });
  expect(queries[0]).toMatchObject({ where: { organizationId: 'own', status: 'ACTIVE' } });
  expect(hotelSecond).toEqual({
    businessId: 'b-hotel',
    locationId: 'l-2',
    vertical: 'HOSPITALITY',
    businessName: 'Гостиница',
    locationName: 'Филиал 2',
  });
  // назначен только салон: гостиница, самая ранняя в организации, не называется
  const salon = await auth.registrationContext('own', {
    role: 'STAFF',
    scopes: [{ role: 'STAFF', businessId: 'b-salon', locationId: null }],
  });
  expect(salon).toMatchObject({ businessId: 'b-salon', locationId: 'l-3', businessName: 'Салон' });
  // назначение ни на один действующий филиал: контекста нет
  expect(
    await auth.registrationContext('own', {
      role: 'STAFF',
      scopes: [{ role: 'STAFF', businessId: 'b-gone', locationId: null }],
    }),
  ).toBeNull();
});

it('владелец и сотрудник без назначений получают самый ранний бизнес и филиал, как раньше', async () => {
  const auth = new AuthService(
    {
      db: {
        business: { findFirst: async () => ({ id: 'b', vertical: 'HOSPITALITY', name: 'Тест' }) },
        location: { findFirst: async () => ({ id: 'l', name: 'Филиал' }) },
      },
    } as never,
    {} as never,
  );
  const owner = await auth.registrationContext('own', {
    role: 'OWNER',
    scopes: [{ role: 'STAFF', businessId: 'b-x', locationId: null }],
  });
  const free = await auth.registrationContext('own', { role: 'STAFF', scopes: [] });
  expect(owner).toMatchObject({ businessId: 'b', locationId: 'l' });
  expect(free).toMatchObject({ businessId: 'b', locationId: 'l' });
});
