import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBarCategoryAction, createBarProductAction, createBarReceiptAction, inventoryBarAction, payBarSupplierAction, scanBarReceiptAction, sellBarRetailAction, sellBarToFolioAction, setBarProductPriceAction } from './actions';
import { barApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { hotelApi } from '../../lib/hotel-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';

vi.mock('../../lib/hotel-api', () => ({ hotelApi: { settings: vi.fn() } }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: vi.fn(async () => ({ user: { id: 'user-1', organizationId: 'org-1' }, context: { businessId: 'business-1', locationId: 'location-1' }, expiresAt: '2099-01-01T00:00:00Z', sessionIssuedAt: '2026-10-19T08:00:00.000Z' })) }));
vi.mock('../../lib/workspace-context', () => ({ selectedWorkspaceBranch: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {},
  barApi: { createCategory: vi.fn(), createProduct: vi.fn(), createReceipt: vi.fn(), postReceipt: vi.fn(), scanReceipt: vi.fn(), sellRetail: vi.fn(), sellToFolio: vi.fn(), payReceipt: vi.fn(), inventoryCount: vi.fn(), setProductPrice: vi.fn(), updateProduct: vi.fn(), writeOff: vi.fn() },
}));

describe('retail recovery server authorization boundary', () => {
  it.each(['organization', 'business', 'location', 'user', 'property', 'currency', 'session', 'missing', 'expired'])('refuses %s scope before the real action sends any sale', async changed => {
    vi.clearAllMocks();
    vi.mocked(hotelApi.settings).mockResolvedValue({ property: { id: 'property-1', currency: 'KZT' } } as Awaited<ReturnType<typeof hotelApi.settings>>);
    const scope = ['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z'];
    const index = ['organization', 'business', 'location', 'user', 'property', 'currency', 'session'].indexOf(changed);
    if (index >= 0) scope[index] = 'different';
    if (changed === 'expired') {
      // currentMe зовут и выбор объекта, и проверка продажи: истёкший срок отдаётся обоим вызовам
      const expired = { user: { id: 'user-1', organizationId: 'org-1' }, context: { businessId: 'business-1', locationId: 'location-1' }, expiresAt: '2000-01-01T00:00:00Z', sessionIssuedAt: scope[6] } as Awaited<ReturnType<typeof currentMe>>;
      vi.mocked(currentMe).mockResolvedValueOnce(expired).mockResolvedValueOnce(expired);
    }
    const fd = new FormData();
    Object.entries({ barPropertyId: 'property-1', barCurrency: 'KZT', productId: 'product-1', quantityUnits: '2', method: 'CASH', idempotencyKey: '00000000-0000-4000-8000-000000000025' }).forEach(([name, value]) => fd.set(name, value));
    if (changed !== 'missing') fd.set('retailRecoveryScope', JSON.stringify(scope));
    expect((await sellBarRetailAction({ error: null, ok: 0 }, fd)).error).toContain('Объект формы');
    expect(barApi.sellRetail).not.toHaveBeenCalled();
  });

  it('sells after the session was renewed by activity: the scope names the session, not its sliding expiry (Q-153 b)', async () => {
    vi.clearAllMocks();
    vi.mocked(hotelApi.settings).mockResolvedValue({ property: { id: 'property-1', currency: 'KZT' } } as Awaited<ReturnType<typeof hotelApi.settings>>);
    // страница отрисована при одном сроке, продажа пришла после продления: срок другой, сессия та же
    const renewed = { user: { id: 'user-1', organizationId: 'org-1' }, context: { businessId: 'business-1', locationId: 'location-1' }, expiresAt: '2099-01-02T00:00:00Z', sessionIssuedAt: '2026-10-19T08:00:00.000Z' } as Awaited<ReturnType<typeof currentMe>>;
    vi.mocked(currentMe).mockResolvedValueOnce(renewed).mockResolvedValueOnce(renewed);
    vi.mocked(barApi.sellRetail).mockResolvedValue({ status: 'POSTED' } as Awaited<ReturnType<typeof barApi.sellRetail>>);
    const fd = new FormData();
    Object.entries({ barPropertyId: 'property-1', barCurrency: 'KZT', productId: 'product-1', quantityUnits: '2', method: 'CASH', idempotencyKey: '00000000-0000-4000-8000-000000000026' }).forEach(([name, value]) => fd.set(name, value));
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    expect((await sellBarRetailAction({ error: null, ok: 0 }, fd)).error).toBeNull();
    expect(barApi.sellRetail).toHaveBeenCalledOnce();
  });
});

describe('форма прихода бара', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(currentMe).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
      context: { vertical: 'HOSPITALITY', businessId: 'business-1', locationId: 'location-1' },
      expiresAt: '2099-01-01T00:00:00Z',
      sessionIssuedAt: '2026-10-19T08:00:00.000Z',
    } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(selectedWorkspaceBranch).mockResolvedValue(null);
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'KZT' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
  });
  it('переводит тенге и процент в целые младшие единицы', async () => {
    vi.mocked(barApi.createReceipt).mockResolvedValue({ id: 'receipt-1', status: 'DRAFT' });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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

  it('строка «новый товар» сначала создаёт карточку с ценой по наценке, вверх до 10 тенге', async () => {
    vi.mocked(barApi.createProduct).mockResolvedValue({ id: 'product-new', code: 'SOK-YABLOCHNYY-1L', name: 'Сок яблочный 1л', categoryId: null, barcode: '4870007654321', unitsPerPackage: 1, markupBasis: 3500, salePrice: '106000', minimumStockUnits: '0', active: true });
    vi.mocked(barApi.createReceipt).mockResolvedValue({ id: 'receipt-2', status: 'DRAFT' });
    const fd = new FormData();
    Object.entries({
      barPropertyId: 'property-1', barCurrency: 'KZT',
      lineCount: '2', supplierId: 'supplier-1', documentNumber: 'SF-8', documentDate: '2026-10-09',
      receivedDate: '2026-10-09',
      'productId.0': 'product-1', 'quantityUnits.0': '2', 'unitCost.0': '100', 'markup.0': '0',
      'productId.1': '', 'newName.1': 'Сок яблочный 1л', 'newCode.1': 'SOK-YABLOCHNYY-1L', 'newBarcode.1': '4870007654321',
      'quantityUnits.1': '10', 'unitCost.1': '780', 'markup.1': '35.00',
    }).forEach(([key, value]) => fd.set(key, value));
    const result = await createBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    // 780 тенге + 35 % = 1053 тенге, вверх до 10 тенге = 1060 тенге = 106000 тиын (Q-BAR-2)
    expect(barApi.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SOK-YABLOCHNYY-1L', name: 'Сок яблочный 1л', barcode: '4870007654321',
      markupBasis: 3500, salePriceMinor: '106000', minimumStockUnits: '0', unitsPerPackage: 1,
    }));
    expect(barApi.createReceipt).toHaveBeenCalledWith(expect.objectContaining({
      lines: [
        { productId: 'product-1', quantityUnits: '2', unitCostMinor: '10000', markupBasis: 0 },
        { productId: 'product-new', quantityUnits: '10', unitCostMinor: '78000', markupBasis: 3500 },
      ],
    }));
  });

  it('объект не в тенге: новый товар получает цену вверх до целой единицы, приход уходит в API (ADR-187)', async () => {
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-usd', currency: 'USD' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
    vi.mocked(barApi.createProduct).mockResolvedValue({ id: 'product-usd' } as never);
    const fd = new FormData();
    Object.entries({
      barPropertyId: 'property-usd', barCurrency: 'USD',
      lineCount: '1', supplierId: 'supplier-1', documentNumber: 'USD-1', documentDate: '2026-10-09',
      receivedDate: '2026-10-09',
      'productId.0': '', 'newName.0': 'Juice', 'newCode.0': 'JUICE', 'quantityUnits.0': '1', 'unitCost.0': '10.20', 'markup.0': '0',
    }).forEach(([key, value]) => fd.set(key, value));
    const result = await createBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    // 10,20 USD без наценки → вверх до целого доллара: 11,00 USD
    expect(barApi.createProduct).toHaveBeenCalledWith(expect.objectContaining({ salePriceMinor: '1100' }));
    expect(barApi.createReceipt).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
  });

  it('строка без товара и без названия не уходит в API', async () => {
    const fd = new FormData();
    Object.entries({
      barPropertyId: 'property-1', barCurrency: 'KZT',
      lineCount: '1', supplierId: 'supplier-1', documentNumber: 'SF-9', documentDate: '2026-10-09',
      receivedDate: '2026-10-09', 'productId.0': '', 'quantityUnits.0': '1', 'unitCost.0': '10', 'markup.0': '0',
    }).forEach(([key, value]) => fd.set(key, value));
    const result = await createBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toContain('Строка 1');
    expect(barApi.createProduct).not.toHaveBeenCalled();
    expect(barApi.createReceipt).not.toHaveBeenCalled();
  });

  it('не пропускает float и не отправляет запрос', async () => {
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
      expect.objectContaining({ amountMinor: '8050', method: 'BANK_TRANSFER_LEGAL', idempotencyKey: '00000000-0000-4000-8000-000000000025' }),
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
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
      unitCostMinor: null,
    });
  });

  it('излишек: цена вручную уходит в тиынах, ответ называет принятый излишек (ADR-175)', async () => {
    vi.mocked(barApi.inventoryCount).mockResolvedValue({
      id: 'count-2',
      systemUnits: '0',
      actualUnits: '3',
      differenceUnits: '3',
      costMinor: '75000',
    });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    Object.entries({ productId: 'product-1', actualUnits: '3', reason: 'Нашли ящик', surplusCost: '250' }).forEach(
      ([key, value]) => fd.set(key, value),
    );
    const result = await inventoryBarAction({ error: null, ok: 0 }, fd);
    expect(barApi.inventoryCount).toHaveBeenLastCalledWith({
      productId: 'product-1',
      actualUnits: '3',
      reason: 'Нашли ящик',
      unitCostMinor: '25000',
    });
    expect(result.message).toBe('Излишек 3 шт. принят на склад');
  });

  it('аудит 21.10.2026 п.2: пустой код товара берётся из названия, а не отказ браузера по-английски', async () => {
    vi.mocked(barApi.createProduct).mockResolvedValue({} as never);
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    fd.set('code', '');
    fd.set('name', 'Шампунь 500 мл');
    fd.set('unitsPerPackage', '1');
    fd.set('salePrice', '500');
    fd.set('minimumStockUnits', '0');
    const result = await createBarProductAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.createProduct).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHAMPUN-500-ML', name: 'Шампунь 500 мл' }));
  });

  it('пустое название товара: своя ошибка по-русски', async () => {
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    fd.set('name', ' ');
    fd.set('salePrice', '500');
    const result = await createBarProductAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBe('Укажите название товара');
    expect(barApi.createProduct).not.toHaveBeenCalled();
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
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    fd.set('idempotencyKey', '00000000-0000-4000-8000-000000000025');
    fd.set('name', 'Напитки');
    fd.set('markup', '35.25');
    await createBarCategoryAction({ error: null, ok: 0 }, fd);
    expect(barApi.createCategory).toHaveBeenCalledWith({
      name: 'Напитки',
      defaultMarkupBasis: 3525,
    });
  });

  it('скан: принимает только картинки и отдаёт разобранный документ', async () => {
    const scan = { supplierId: null, supplierName: 'ИП Иванов', documentNumber: 'SF-1', documentDate: '2026-10-09', lines: [{ productId: null, name: 'Сок', barcode: null, quantityUnits: '2', unitCostMinor: '78000' }], warnings: [] };
    vi.mocked(barApi.scanReceipt).mockResolvedValue(scan);
    const fd = new FormData();
    fd.set('document', new File(['fake'], 'invoice.jpg', { type: 'image/jpeg' }));
    const result = await scanBarReceiptAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(result.scan).toEqual(scan);
    expect(result.message).toContain('новых товаров: 1');
    expect(barApi.scanReceipt).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'invoice.jpg', mediaType: 'image/jpeg', dataBase64: expect.any(String) }));
  });

  it('скан: PDF и пустой файл не уходят в API', async () => {
    const pdf = new FormData();
    pdf.set('document', new File(['fake'], 'invoice.pdf', { type: 'application/pdf' }));
    expect((await scanBarReceiptAction({ error: null, ok: 0 }, pdf)).error).toContain('PDF');
    const empty = new FormData();
    expect((await scanBarReceiptAction({ error: null, ok: 0 }, empty)).error).toContain('Выберите фото');
    expect(barApi.scanReceipt).not.toHaveBeenCalled();
  });

  it('карточка товара: поля уходят в PATCH, цена отдельным маршрутом в minor units', async () => {
    const row = { id: 'product-1', code: 'COLA-05', name: 'Cola 0,5 ж/б', categoryId: null, barcode: '4870001234567', unitsPerPackage: 12, markupBasis: 3500, salePrice: '75000', minimumStockUnits: '8', active: true };
    vi.mocked(barApi.updateProduct).mockResolvedValue(row);
    vi.mocked(barApi.setProductPrice).mockResolvedValue(row);
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
    Object.entries({
      id: 'product-1', name: 'Cola 0,5 ж/б', categoryId: '', barcode: '4870001234567',
      unitsPerPackage: '12', markup: '35.00', minimumStockUnits: '8', salePrice: '750',
    }).forEach(([key, value]) => fd.set(key, value));
    const { updateBarProductAction } = await import('./actions');
    const result = await updateBarProductAction({ error: null, ok: 0 }, fd);
    expect(result.error).toBeNull();
    expect(barApi.updateProduct).toHaveBeenCalledWith('product-1', {
      name: 'Cola 0,5 ж/б', categoryId: null, barcode: '4870001234567',
      unitsPerPackage: 12, markupBasis: 3500, minimumStockUnits: '8',
    });
    expect(barApi.setProductPrice).toHaveBeenCalledWith('product-1', '75000');
  });

  it('сохраняет свою цену продажи в minor units', async () => {
    vi.mocked(barApi.setProductPrice).mockResolvedValue({ id: 'product-1', code: 'WATER', name: 'Вода', categoryId: null, barcode: null, unitsPerPackage: 1, markupBasis: null, salePrice: '85000', minimumStockUnits: '0', active: true });
    const fd = new FormData();
    fd.set('barPropertyId', 'property-1');
    fd.set('barCurrency', 'KZT');
    fd.set('retailRecoveryScope', JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'KZT', '2026-10-19T08:00:00.000Z']));
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
    vi.mocked(currentMe).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
      context: { vertical: 'HOSPITALITY', businessId: 'business-1', locationId: 'location-1' },
      expiresAt: '2099-01-01T00:00:00Z',
      sessionIssuedAt: '2026-10-19T08:00:00.000Z',
    } as Awaited<ReturnType<typeof currentMe>>);
    vi.mocked(selectedWorkspaceBranch).mockResolvedValue(null);
    vi.mocked(hotelApi.settings).mockResolvedValue({
      property: { id: 'property-1', currency: 'USD' },
    } as Awaited<ReturnType<typeof hotelApi.settings>>);
  });
  const form = () => {
    const fd = new FormData();
    Object.entries({
      barPropertyId: 'property-1',
      barCurrency: 'USD',
      retailRecoveryScope: JSON.stringify(['org-1', 'business-1', 'location-1', 'user-1', 'property-1', 'USD', '2026-10-19T08:00:00.000Z']),
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
