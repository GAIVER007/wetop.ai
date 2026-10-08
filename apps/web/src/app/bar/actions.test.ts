import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBarCategoryAction,
  createBarReceiptAction,
  inventoryBarAction,
  payBarSupplierAction,
  sellBarRetailAction,
  sellBarToFolioAction,
  setBarProductPriceAction,
} from './actions';
import { barApi } from '../../lib/api';
import { hotelApi } from '../../lib/hotel-api';

vi.mock('../../lib/hotel-api', () => ({ hotelApi: { settings: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  barApi: {
    createCategory: vi.fn(),
    createReceipt: vi.fn(),
    postReceipt: vi.fn(),
    sellRetail: vi.fn(),
    sellToFolio: vi.fn(),
    payReceipt: vi.fn(),
    inventoryCount: vi.fn(),
    setProductPrice: vi.fn(),
  },
}));

describe('форма прихода бара', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'KZT' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
  });
  it('переводит тенге и процент в целые младшие единицы', async () => {
    vi.mocked(barApi.createReceipt).mockResolvedValue({ id: 'receipt-1', status: 'DRAFT' });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({
      lineCount: '1',
      supplierId: 'supplier-1',
      documentNumber: 'SF-7',
      documentDate: '2026-10-04',
      receivedDate: '2026-10-04',
      'productId.0': 'product-1',
      'quantityUnits.0': '12',
      'unitCost.0': '150,50',
      'markup.0': '35.25',
      postNow: 'on',
    }).forEach(([key, value]) => fd.set(key, value));
    const result = await createBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          {
            productId: 'product-1',
            quantityUnits: '12',
            unitCostMinor: '15050',
            markupBasis: 3525,
          },
        ],
      }),
    );
    expect(barApi.postReceipt).toHaveBeenCalledWith('receipt-1');
  });

  it('не пропускает float и не отправляет запрос', async () => {
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({ lineCount: '1', 'unitCost.0': '12.345', 'markup.0': '20' }).forEach(
      ([key, value]) => fd.set(key, value),
    );
    const result = await createBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toContain('сумму в валюте операции');
    expect(barApi.createReceipt).not.toHaveBeenCalled();
  });

  it('передает розничную продажу с ключом повтора', async () => {
    vi.mocked(barApi.sellRetail).mockResolvedValue({
      id: 'sale-1',
      status: 'POSTED',
      revenueMinor: '140000',
      costMinor: '30000',
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({ productId: 'product-1', quantityUnits: '2', method: 'CASH' }).forEach(
      ([key, value]) => fd.set(key, value),
    );
    const result = await sellBarRetailAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.sellRetail).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        quantityUnits: '2',
        method: 'CASH',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('переводит частичную оплату поставщику в minor units', async () => {
    vi.mocked(barApi.payReceipt).mockResolvedValue({
      id: 'payment-1',
      receiptId: 'receipt-1',
      paidAmount: '8050',
      dueAmount: '9950',
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({
      receiptId: 'receipt-1',
      amount: '80.50',
      method: 'BANK_TRANSFER_LEGAL',
    }).forEach(([key, value]) => fd.set(key, value));
    const result = await payBarSupplierAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.payReceipt).toHaveBeenCalledWith(
      'receipt-1',
      expect.objectContaining({ amountMinor: '8050', method: 'BANK_TRANSFER_LEGAL' }),
    );
  });

  it('передает продажу в счет гостя с ключом повтора', async () => {
    vi.mocked(barApi.sellToFolio).mockResolvedValue({
      id: 'sale-2',
      status: 'POSTED',
      chargeId: 'charge-1',
      revenueMinor: '70000',
      costMinor: '15000',
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({ folioId: 'folio-1', productId: 'product-1', quantityUnits: '1' }).forEach(
      ([key, value]) => fd.set(key, value),
    );
    const result = await sellBarToFolioAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.sellToFolio).toHaveBeenCalledWith(
      expect.objectContaining({
        folioId: 'folio-1',
        productId: 'product-1',
        quantityUnits: '1',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('передает фактический остаток без float', async () => {
    vi.mocked(barApi.inventoryCount).mockResolvedValue({
      id: 'count-1',
      systemUnits: '12',
      actualUnits: '10',
      differenceUnits: '-2',
      costMinor: '30000',
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    Object.entries({ productId: 'product-1', actualUnits: '10', reason: 'Пересчет' }).forEach(
      ([key, value]) => fd.set(key, value),
    );
    const result = await inventoryBarAction({ error: null, ok: 0 }, fd);
    expect(result.message).toContain('2 шт.');
    expect(barApi.inventoryCount).toHaveBeenCalledWith({
      productId: 'product-1',
      actualUnits: '10',
      reason: 'Пересчет',
    });
  });

  it('хранит наценку категории в basis points', async () => {
    vi.mocked(barApi.createCategory).mockResolvedValue({
      id: 'category-1',
      name: 'Напитки',
      defaultMarkupBasis: 3525,
      active: true,
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    fd.set('name', 'Напитки');
    fd.set('markup', '35.25');
    await createBarCategoryAction({ error: null, ok: 0 }, fd);
    expect(barApi.createCategory).toHaveBeenCalledWith({
      name: 'Напитки',
      defaultMarkupBasis: 3525,
    });
  });

  it('сохраняет свою цену продажи в minor units', async () => {
    vi.mocked(barApi.setProductPrice).mockResolvedValue({
      id: 'product-1',
      code: 'WATER',
      name: 'Вода',
      categoryId: null,
      unitsPerPackage: 1,
      markupBasis: null,
      salePrice: '85000',
      minimumStockUnits: '0',
      active: true,
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    fd.set('id', 'product-1');
    fd.set('salePrice', '850');
    const result = await setBarProductPriceAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.setProductPrice).toHaveBeenCalledWith('product-1', '85000');
  });
});

describe('Bar scope/currency/replay regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'USD' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
  });
  const form = () => {
    const fd = new FormData();
    Object.entries({
      barPropertyId: 'property-1',
      barCurrency: 'USD',
      idempotencyKey: '00000000-0000-4000-8000-000000000025',
      productId: 'product-1',
      quantityUnits: '1',
      method: 'CASH',
      lineCount: '1',
      supplierId: 'supplier-1',
      documentNumber: 'A25',
      documentDate: '2026-10-07',
      receivedDate: '2026-10-07',
      'productId.0': 'product-1',
      'quantityUnits.0': '1',
      'unitCost.0': '100',
      'markup.0': '0',
    }).forEach(([k, v]) => fd.set(k, v));
    return fd;
  };
  it('sends verified USD instead of substituting KZT', async () => {
    vi.mocked(barApi.createReceipt).mockResolvedValue({ id: 'r', status: 'DRAFT' });
    await createBarReceiptAction({ error: null, ok: 0 }, form());
    expect(barApi.createReceipt).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  });
  it('rejects a draft from another property before mutation', async () => {
    const fd = form();
    fd.set('barPropertyId', 'other-property');
    expect((await sellBarRetailAction({ error: null, ok: 0 }, fd)).error).toContain(
      'Объект формы изменился',
    );
    expect(barApi.sellRetail).not.toHaveBeenCalled();
  });
  it('preserves the submitted sale key across retries', async () => {
    vi.mocked(barApi.sellRetail).mockResolvedValue({
      id: 's',
      status: 'POSTED',
      revenueMinor: '15000',
      costMinor: '10000',
    });
    const fd = form();
    await sellBarRetailAction({ error: null, ok: 0 }, fd);
    await sellBarRetailAction({ error: null, ok: 0 }, fd);
    expect(
      vi
        .mocked(barApi.sellRetail)
        .mock.calls.map(([x]) => (x as { idempotencyKey: string }).idempotencyKey),
    ).toEqual([fd.get('idempotencyKey'), fd.get('idempotencyKey')]);
  });
  it('does not announce REVERSED replay as a new sale', async () => {
    vi.mocked(barApi.sellRetail).mockResolvedValue({
      id: 's',
      status: 'REVERSED',
      revenueMinor: '15000',
      costMinor: '10000',
    } as never);
    expect((await sellBarRetailAction({ error: null, ok: 0 }, form())).message).toContain(
      'отменена',
    );
  });
});
