import 'reflect-metadata';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthorInterceptor } from './author.interceptor';
import { BUSINESS_CAPABILITY } from './capability.decorator';
import { PUBLIC_ROUTE } from './public.decorator';

const B = '11111111-1111-4111-8111-111111111111';
function boundary(vertical: string, pointer = `business=${B}`) {
  const handler = () => undefined;
  Reflect.defineMetadata(BUSINESS_CAPABILITY, 'hospitality.channels', handler);
  const db = { business: { findFirst: async () => ({ id: B, vertical }) } };
  const context = {
    getHandler: () => handler,
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'u', organizationId: 'own' },
        headers: { 'x-wetop-scope': pointer },
      }),
    }),
  };
  return { interceptor: new AuthorInterceptor({ db } as never), context };
}

describe('HTTP capability boundary before domain handler', () => {
  it.each(['BEAUTY', 'FOOD_SERVICE'])(
    'denies %s before reading Hospitality data',
    async (vertical) => {
      let read = false;
      const { interceptor, context } = boundary(vertical);
      await expect(
        interceptor.intercept(
          context as never,
          {
            handle: () => {
              read = true;
              return of('data');
            },
          } as never,
        ),
      ).rejects.toThrow();
      expect(read).toBe(false);
    },
  );
  it('rejects a malformed explicit scope instead of silently selecting a hotel', async () => {
    const { interceptor, context } = boundary('HOSPITALITY', 'business=invalid');
    await expect(
      interceptor.intercept(context as never, { handle: () => of('data') } as never),
    ).rejects.toThrow();
  });
  it('preserves Hospitality response', async () => {
    const { interceptor, context } = boundary('HOSPITALITY');
    await expect(
      interceptor.intercept(context as never, { handle: () => of('data') } as never),
    ).resolves.toBeDefined();
  });
});

it('keeps public provider webhook binding independent of the installation Property', async () => {
  const handler = () => undefined;
  Reflect.defineMetadata(PUBLIC_ROUTE, true, handler);
  const controller = class PublicProviderController {};
  Reflect.defineMetadata(BUSINESS_CAPABILITY, 'hospitality.channels', controller);
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  };
  let received = false;
  const interceptor = new AuthorInterceptor({ db: {} } as never);
  await expect(
    interceptor.intercept(
      context as never,
      {
        handle: () => {
          received = true;
          return of('provider-bound');
        },
      } as never,
    ),
  ).resolves.toBeDefined();
  expect(received).toBe(true);
});
