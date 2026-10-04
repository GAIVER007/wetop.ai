import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { describe, expect, it, vi } from 'vitest';
import { beautyScope } from './scope';
import { BeautyCatalogController } from './beauty.module';
import { BeautyAppointmentsController } from './appointments';
import { BeautyScheduleController } from './schedule';
import { BUSINESS_CAPABILITY } from '../auth/capability.decorator';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

const actor = {
  userId: 'user',
  organizationId: 'org',
  role: 'OWNER' as const,
  scope: 'BUSINESS' as const,
  businessId: 'business',
  vertical: 'BEAUTY' as const,
};
function fixture() {
  const business = { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) };
  const location = {
    findFirst: vi
      .fn()
      .mockResolvedValue({ id: 'first', name: 'Salon', currency: 'KZT', timezone: 'UTC' }),
  };
  return { business, location, prisma: { db: { business, location } } as unknown as PrismaService };
}
describe('MV4 explicit Beauty boundary', () => {
  it('does not choose a salon without explicit Business', async () => {
    const f = fixture();
    await expect(
      withSignedInUser(
        {
          userId: actor.userId,
          organizationId: actor.organizationId,
          role: actor.role,
          scope: 'ORGANIZATION',
        },
        () => beautyScope(f.prisma),
      ),
    ).rejects.toThrow();
    expect(f.business.findFirst).not.toHaveBeenCalled();
  });
  it('Business context does not choose the first Location', async () => {
    const f = fixture();
    const result = await withSignedInUser(actor, () => beautyScope(f.prisma));
    expect(result.locationId).toBeNull();
    expect(f.location.findFirst).not.toHaveBeenCalled();
  });
  it('invalid explicit Location fails instead of degrading to Business', async () => {
    const f = fixture();
    f.location.findFirst.mockResolvedValue(null);
    await expect(
      withSignedInUser({ ...actor, scope: 'LOCATION', locationId: 'foreign' }, () =>
        beautyScope(f.prisma),
      ),
    ).rejects.toThrow();
  });
  for (const vertical of ['HOSPITALITY', 'FOOD_SERVICE'] as const) {
    it(`${vertical} is rejected before domain access`, async () => {
      const f = fixture();
      await expect(
        withSignedInUser({ ...actor, vertical }, () => beautyScope(f.prisma)),
      ).rejects.toThrow();
    });
  }
  it('every existing Beauty handler has the canonical capability', () => {
    for (const [controller, methods, capability] of [
      [BeautyCatalogController, ['customers'], 'beauty.customers'],
      [
        BeautyCatalogController,
        ['services', 'createService', 'updateService', 'setLocationService'],
        'beauty.services',
      ],
      [
        BeautyCatalogController,
        ['employees', 'createEmployee', 'updateEmployee', 'setEmployeeServices'],
        'beauty.employees',
      ],
      [
        BeautyScheduleController,
        ['schedule', 'setWorkingHours', 'addTimeOff', 'removeTimeOff', 'setLocations'],
        'beauty.employees',
      ],
      [BeautyAppointmentsController, ['day', 'create', 'move', 'setStatus'], 'beauty.appointments'],
    ] as const) {
      for (const method of methods) {
        const handler = (controller.prototype as unknown as Record<string, object>)[method]!;
        expect(
          Reflect.getMetadata(BUSINESS_CAPABILITY, handler) ??
            Reflect.getMetadata(BUSINESS_CAPABILITY, controller),
          method,
        ).toBe(capability);
      }
    }
  });
});

it('no-scope Beauty capability fails before legacy Property resolution', async () => {
  const propertyRead = vi.fn().mockRejectedValue(new Error('legacy Property must not be read'));
  const interceptor = new AuthorInterceptor({
    db: { property: { findFirst: propertyRead, findUnique: propertyRead } },
  } as never);
  const context = {
    getHandler: () => BeautyCatalogController.prototype.services,
    getClass: () => BeautyCatalogController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'user', organizationId: 'org', role: 'OWNER' },
        headers: {},
      }),
    }),
  };
  const handle = vi.fn(() => of('not reached'));
  await expect(interceptor.intercept(context as never, { handle })).rejects.toThrow(
    ForbiddenException,
  );
  expect(propertyRead).not.toHaveBeenCalled();
  expect(handle).not.toHaveBeenCalled();
});
