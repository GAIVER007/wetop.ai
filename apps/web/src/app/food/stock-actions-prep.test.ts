import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPrepRecipe, mutateStock } from './stock-actions';

const mocks = vi.hoisted(() => ({
  currentMe: vi.fn(),
  revalidatePath: vi.fn(),
  produce: vi.fn(),
  setPrepRecipe: vi.fn(),
  prepRecipe: vi.fn(),
  createProduct: vi.fn(),
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
    produce: mocks.produce,
    setPrepRecipe: mocks.setPrepRecipe,
    prepRecipe: mocks.prepRecipe,
  },
}));

const key = 'synthetic-business:synthetic-location';
const signedIn = (vertical: string) =>
  mocks.currentMe.mockResolvedValue({ context: { vertical, businessId: 'synthetic-business', locationId: 'synthetic-location' } });

/** Заготовки (DATA_MODEL §62, срез K1): действия склада кухни у гостиницы, салона и ресторана */
describe('склад кухни: заготовки и гостиница', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['HOSPITALITY', '/bar/consumables'],
    ['BEAUTY', '/bar/consumables'],
    ['FOOD_SERVICE', '/stock'],
  ] as const)('%s: продукт склада кухни создаётся, обновляется экран %s', async (vertical, path) => {
    signedIn(vertical);
    mocks.createProduct.mockResolvedValue({ id: 'p' });
    await expect(mutateStock(key, { kind: 'product', body: { name: 'Колбаса', unit: 'г', kind: 'PREP' } })).resolves.toEqual({
      error: null,
    });
    expect(mocks.createProduct).toHaveBeenCalledWith({ name: 'Колбаса', unit: 'г', kind: 'PREP' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
  });

  it('«Приготовили» и техкарта уходят в API склада', async () => {
    signedIn('HOSPITALITY');
    await mutateStock(key, { kind: 'produce', body: { productId: 'p', qty: '2.5', expiresOn: null } });
    expect(mocks.produce).toHaveBeenCalledWith({ productId: 'p', qty: '2.5', expiresOn: null });
    const recipe = { yieldQty: '1000', lines: [{ ingredientId: 'i', normQty: '800' }] };
    await mutateStock(key, { kind: 'recipe', id: 'p', body: recipe });
    expect(mocks.setPrepRecipe).toHaveBeenCalledWith('p', recipe);
  });

  it('техкарта читается по требованию; чужой филиал отказ без запроса', async () => {
    signedIn('BEAUTY');
    mocks.prepRecipe.mockResolvedValue({ productId: 'p', yieldQty: '1000', lines: [] });
    await expect(loadPrepRecipe(key, 'p')).resolves.toMatchObject({ error: null, recipe: { yieldQty: '1000' } });
    const stale = await loadPrepRecipe('synthetic-business:other', 'p');
    expect(stale.error).toMatch(/другой/);
    expect(mocks.prepRecipe).toHaveBeenCalledOnce();
  });
});
