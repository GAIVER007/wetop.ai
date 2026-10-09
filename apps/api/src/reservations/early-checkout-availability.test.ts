import { expect, it, vi } from 'vitest';
import type { Db } from '@pms/database';
import { PrismaReservationsRepository } from './reservations.repository';

it('завершённое проживание без оставшихся назначений не удерживает категорию', async () => {
  const db = {
    inventoryUnit: { count: vi.fn().mockResolvedValue(4) },
    inventoryBlock: { findMany: vi.fn().mockResolvedValue([]) },
    reservationItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          status: 'CHECKED_OUT',
          arrivalDate: new Date('2026-10-04T00:00:00Z'),
          departureDate: new Date('2026-10-08T00:00:00Z'),
          allocations: [],
        },
      ]),
    },
  };
  const repo = new PrismaReservationsRepository(db as unknown as Db);
  expect(await repo.categoryAvailability('single', '2026-10-04', '2026-10-06')).toBe(4);
});
