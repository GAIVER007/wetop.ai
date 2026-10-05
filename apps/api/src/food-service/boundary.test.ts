import 'reflect-metadata';
import { of } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { FoodCatalogController, FoodReservationsController } from './food.module';
import { BUSINESS_CAPABILITY } from '../auth/capability.decorator';
import { ROUTE_ACCESS } from '../auth/access.decorator';
it('Food missing scope is refused before any legacy Property lookup', async () => {
  const handler = FoodCatalogController.prototype.areas;
  const request = { user: { id: 'owner', organizationId: 'org', role: 'OWNER' }, headers: {} };
  const ctx = {
    getClass: () => FoodCatalogController,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const next = { handle: vi.fn(() => of('should not run')) };
  const lookup = vi.fn(() => {
    throw new Error('legacy lookup must not run');
  });
  const interceptor = new AuthorInterceptor({
    db: { property: { findFirst: lookup, findUnique: lookup }, $queryRaw: lookup },
  } as never);
  await expect(interceptor.intercept(ctx as never, next)).rejects.toMatchObject({ status: 403 });
  expect(lookup).not.toHaveBeenCalled();
  expect(next.handle).not.toHaveBeenCalled();
});
it('all Food handlers inherit capability and permission metadata', () => {
  for (const [controller, capability] of [
    [FoodCatalogController, 'food.tables'],
    [FoodReservationsController, 'food.tableReservations'],
  ] as const) {
    expect(Reflect.getMetadata(BUSINESS_CAPABILITY, controller)).toBe(capability);
    expect(Reflect.getMetadata(ROUTE_ACCESS, controller)).toBe('desk');
  }
  for (const method of [
    'createArea',
    'updateArea',
    'createTable',
    'updateTable',
    'createPeriod',
    'updatePeriod',
  ] as const)
    expect(Reflect.getMetadata(ROUTE_ACCESS, FoodCatalogController.prototype[method])).toBe(
      'property',
    );
});
