import { describe, expect, it, vi } from 'vitest';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
vi.mock('../../apps/api/src/database/property-ref', () => ({
  propertyIdRef: async () => '00000000-0000-4000-8000-000000000001',
}));
const product = {
  id: 'product',
  name: 'Synthetic goods',
  salePrice: 9007199254740993n,
  minimumStockUnits: 0n,
  unitsPerPackage: 1,
};
describe('Bar nested product JSON boundary', () => {
  it('serializes the real nested product in sale history without precision loss', async () => {
    const repo = new PrismaBarRepository({
      db: {
        barSale: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              {
                id: 'sale',
                totalRevenue: 9007199254740993n,
                totalCost: 1000n,
                lines: [
                  {
                    product,
                    quantityUnits: 1n,
                    salePrice: 9007199254740993n,
                    revenue: 9007199254740993n,
                    cost: 1000n,
                  },
                ],
              },
            ]),
        },
      },
    } as unknown as PrismaService);
    const rows = await repo.sales();
    const parsed = JSON.parse(JSON.stringify(rows));
    expect(parsed[0].lines[0].product).toMatchObject({
      salePrice: '9007199254740993',
      minimumStockUnits: '0',
      name: 'Synthetic goods',
    });
  });
  it('serializes the real nested product in movements without precision loss', async () => {
    const repo = new PrismaBarRepository({
      db: {
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([{ currency: 'USD' }])
          .mockResolvedValueOnce([]),
        barStockMovement: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'movement', product, units: 1n, unitCost: 1000n }]),
        },
      },
    } as unknown as PrismaService);
    const parsed = JSON.parse(JSON.stringify(await repo.movements()));
    expect(parsed[0].product).toMatchObject({
      salePrice: '9007199254740993',
      minimumStockUnits: '0',
    });
    expect(parsed[0].amountMinor).toBe('1000');
  });
});
