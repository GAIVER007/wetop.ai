import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mutateStock } from './stock-actions';

const mocks = vi.hoisted(() => ({
  currentMe: vi.fn(),
  createProduct: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ unstable_rethrow() {} }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: mocks.currentMe }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));
vi.mock('../../lib/food-api', () => ({
  stockApi: {
    createProduct: mocks.createProduct,
    updateProduct: vi.fn(),
    receipt: vi.fn(),
    reverseLot: vi.fn(),
    writeOff: vi.fn(),
    inventory: vi.fn(),
    lots: vi.fn(),
  },
}));

const product = {
  kind: 'product' as const,
  body: { name: 'Synthetic consumable', unit: 'шт' as const, active: true },
};

describe('shared stock action scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createProduct.mockResolvedValue({ id: 'synthetic-product' });
  });

  it.each(['BEAUTY', 'FOOD_SERVICE'] as const)(
    'accepts the captured branch key for %s',
    async (vertical) => {
      mocks.currentMe.mockResolvedValue({
        context: {
          vertical,
          businessId: 'synthetic-business',
          locationId: 'synthetic-location',
        },
      });

      await expect(
        mutateStock('synthetic-business:synthetic-location', product),
      ).resolves.toEqual({ error: null });
      expect(mocks.createProduct).toHaveBeenCalledOnce();
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        vertical === 'BEAUTY' ? '/bar/consumables' : '/stock',
      );
    },
  );

  it('rejects another salon key before calling the stock API', async () => {
    mocks.currentMe.mockResolvedValue({
      context: {
        vertical: 'BEAUTY',
        businessId: 'synthetic-business',
        locationId: 'current-location',
      },
    });

    const result = await mutateStock('synthetic-business:stale-location', product);

    expect(result.error).toMatch(/другой салон/i);
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });
});
