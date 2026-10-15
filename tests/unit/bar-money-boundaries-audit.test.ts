import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { allocateFifo, unitsFromPackages } from '@pms/domain';
import { BarService } from '../../apps/api/src/bar/bar.service';
import type { BarRepository } from '../../apps/api/src/bar/bar.repository';

describe('N3: schema bounds and decimal-safe Bar values, audit only', () => {
  it.each(['2147483648', '9007199254740993'])('category markup %s is outside its PostgreSQL Int32 field', value => {
    const createCategory = vi.fn().mockResolvedValue({});
    const service = new BarService({ createCategory } as unknown as BarRepository);
    expect(() => service.createCategory({ name: 'A3 synthetic category', defaultMarkupBasis: value })).toThrow(BadRequestException);
    expect(createCategory).not.toHaveBeenCalled();
  });
  it('package size outside its native Int32 field is rejected before repository', () => {
    const createProduct = vi.fn().mockResolvedValue({});
    const service = new BarService({ createProduct } as unknown as BarRepository);
    expect(() => service.createProduct({ code: 'A3', name: 'A3 synthetic product', unitsPerPackage: 2147483648, salePriceMinor: '10000', minimumStockUnits: '0' })).toThrow(BadRequestException);
    expect(createProduct).not.toHaveBeenCalled();
  });
  it('price above JS safe integer is passed exactly as bigint', async () => {
    const setProductPrice = vi.fn().mockResolvedValue({ id: 'synthetic' });
    const service = new BarService({ setProductPrice } as unknown as BarRepository);
    await service.setProductPrice('synthetic', { salePriceMinor: '9007199254740993' });
    expect(setProductPrice).toHaveBeenCalledWith('synthetic', 9007199254740993n);
  });
  it('FIFO and packages preserve exact values above Number safe range', () => {
    expect(allocateFifo([{ lotId: 'synthetic', receivedAt: '2026-10-07T00:00:00Z', availableUnits: 2n, unitCostMinor: 9007199254740993n }], 2n).totalCostMinor).toBe(18014398509481986n);
    expect(unitsFromPackages(9007199254740993n, 2n)).toBe(18014398509481986n);
  });
});
