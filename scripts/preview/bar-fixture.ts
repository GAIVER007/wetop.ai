/**
 * Бар на подставном API (ADR-153): состояние в памяти для UI-тестов стойки без базы.
 * Товары, поставщики, приходы, продажи, движения и скан накладной; деньги: строки в тиынах.
 * Сбрасывается вместе с остальной фикстурой (`/__test/reset`).
 */

interface BarCategory { id: string; name: string; defaultMarkupBasis: number; active: boolean }
interface BarProduct {
  id: string; code: string; name: string; categoryId: string | null; barcode: string | null;
  unitsPerPackage: number; markupBasis: number | null; salePrice: string; minimumStockUnits: string;
  active: boolean; category: BarCategory | null;
  availableUnits: string; stockCostMinor: string;
}
interface BarSupplier { id: string; name: string; phone: string | null; email: string | null; details: string | null; active: boolean }
interface BarReceipt {
  id: string; documentNumber: string; documentDate: string; receivedDate: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED'; totalAmount: string; paidAmount: string; dueAmount: string;
  supplier: BarSupplier; _count: { lines: number };
}
interface BarSale {
  id: string; status: 'POSTED' | 'REVERSED'; totalRevenue: string; totalCost: string; createdAt: string;
  lines: Array<{ id: string; productId: string; quantityUnits: string; salePrice: string; revenue: string; cost: string; product: { name: string } }>;
}
interface BarMovement { id: string; kind: string; units: string; unitCost: string; amountMinor: string; note: string | null; createdAt: string; product: { name: string } }

let categories: BarCategory[] = [];
let products: BarProduct[] = [];
let suppliers: BarSupplier[] = [];
let receipts: BarReceipt[] = [];
let sales: BarSale[] = [];
let movements: BarMovement[] = [];
let sequence = 0;
const nextId = (prefix: string) => `${prefix}0000000-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;

export function resetBarFixture(): void {
  sequence = 0;
  const drinks: BarCategory = { id: nextId('c'), name: 'Напитки', defaultMarkupBasis: 3500, active: true };
  categories = [drinks];
  products = [
    {
      id: nextId('b'), code: 'COLA-05', name: 'Cola 0,5', categoryId: drinks.id, barcode: '4870001234567',
      unitsPerPackage: 12, markupBasis: null, salePrice: '70000', minimumStockUnits: '6', active: true,
      category: drinks, availableUnits: '12', stockCostMinor: '84000',
    },
    {
      id: nextId('b'), code: 'WATER-1', name: 'Вода 1 л', categoryId: null, barcode: null,
      unitsPerPackage: 1, markupBasis: 2000, salePrice: '35000', minimumStockUnits: '10', active: true,
      category: null, availableUnits: '4', stockCostMinor: '48000',
    },
  ];
  suppliers = [
    { id: nextId('d'), name: 'ТОО «Алматы Напитки»', phone: '+77010000000', email: null, details: null, active: true },
  ];
  receipts = [
    {
      id: nextId('e'), documentNumber: 'SF-77', documentDate: '2026-10-05', receivedDate: '2026-10-05',
      status: 'POSTED', totalAmount: '180000', paidAmount: '80000', dueAmount: '100000',
      supplier: suppliers[0]!, _count: { lines: 2 },
    },
  ];
  sales = [
    {
      id: nextId('f'), status: 'POSTED', totalRevenue: '70000', totalCost: '15000', createdAt: '2026-10-06T10:00:00.000Z',
      lines: [{ id: nextId('f'), productId: products[0]!.id, quantityUnits: '1', salePrice: '70000', revenue: '70000', cost: '15000', product: { name: 'Cola 0,5' } }],
    },
  ];
  movements = [
    { id: nextId('g'), kind: 'RECEIPT', units: '12', unitCost: '7000', amountMinor: '84000', note: 'SF-77', createdAt: '2026-10-05T09:00:00.000Z', product: { name: 'Cola 0,5' } },
    { id: nextId('g'), kind: 'SALE', units: '-1', unitCost: '15000', amountMinor: '15000', note: null, createdAt: '2026-10-06T10:00:00.000Z', product: { name: 'Cola 0,5' } },
  ];
}
resetBarFixture();

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const strOrNull = (value: unknown): string | null => (str(value) === '' ? null : str(value));

/** Обработчик фикстуры: `undefined`, не наш путь, дальше по цепочке */
export function barFixture(
  path: string,
  method: string,
  body: Record<string, unknown>,
): { status: number; data: unknown } | undefined {
  if (!path.startsWith('/bar/')) return undefined;
  const ok = (data: unknown) => ({ status: 200, data });
  if (method === 'GET') {
    if (path === '/bar/categories') return ok(categories);
    if (path === '/bar/products') return ok(products);
    if (path === '/bar/suppliers') return ok(suppliers);
    if (path === '/bar/receipts') return ok(receipts);
    if (path === '/bar/stock') return ok(products);
    if (path === '/bar/sales') return ok(sales);
    if (path === '/bar/movements') return ok(movements);
    if (path === '/bar/folios')
      return ok([{ id: '90000000-0000-4000-8000-000000000001', confirmationNumber: 'WTP-101', guestName: 'Айдана Тестова', unitCode: 'K-12' }]);
    if (path === '/bar/report')
      return ok({
        purchasesMinor: '180000', supplierPaidMinor: '80000', revenueMinor: '70000', costMinor: '15000',
        grossProfitMinor: '55000', writeOffMinor: '0', stockCostMinor: '132000', supplierDebtMinor: '100000',
      });
    return undefined;
  }
  if (method === 'POST' && path === '/bar/categories') {
    const category: BarCategory = { id: nextId('c'), name: str(body.name), defaultMarkupBasis: Number(body.defaultMarkupBasis ?? 0), active: true };
    categories.push(category);
    return ok(category);
  }
  if (method === 'POST' && path === '/bar/suppliers') {
    const supplier: BarSupplier = { id: nextId('d'), name: str(body.name), phone: strOrNull(body.phone), email: strOrNull(body.email), details: strOrNull(body.details), active: true };
    suppliers.push(supplier);
    return ok(supplier);
  }
  if (method === 'POST' && path === '/bar/products') {
    const code = str(body.code);
    if (products.some((product) => product.code === code))
      return { status: 409, data: { message: 'Товар с таким кодом уже есть' } };
    const category = categories.find((item) => item.id === body.categoryId) ?? null;
    const product: BarProduct = {
      id: nextId('b'), code, name: str(body.name), categoryId: category?.id ?? null,
      barcode: strOrNull(body.barcode), unitsPerPackage: Number(body.unitsPerPackage ?? 1),
      markupBasis: body.markupBasis === null || body.markupBasis === undefined ? null : Number(body.markupBasis),
      salePrice: str(body.salePriceMinor), minimumStockUnits: str(body.minimumStockUnits) || '0',
      active: true, category, availableUnits: '0', stockCostMinor: '0',
    };
    products.push(product);
    return ok(product);
  }
  const activeMatch = /^\/bar\/(categories|products|suppliers)\/([^/]+)\/active$/.exec(path);
  if (method === 'PATCH' && activeMatch) {
    const list: Array<{ id: string; active: boolean }> =
      activeMatch[1] === 'categories' ? categories : activeMatch[1] === 'products' ? products : suppliers;
    const row = list.find((item) => item.id === activeMatch[2]);
    if (!row) return { status: 404, data: { message: 'Не найдено' } };
    row.active = body.active === true;
    return ok(row);
  }
  const productMatch = /^\/bar\/products\/([^/]+)$/.exec(path);
  if (method === 'PATCH' && productMatch) {
    const product = products.find((item) => item.id === productMatch[1]);
    if (!product) return { status: 404, data: { message: 'Товар не найден' } };
    if (str(body.name) === '') return { status: 400, data: { message: 'Укажите название товара' } };
    const category = categories.find((item) => item.id === body.categoryId) ?? null;
    product.name = str(body.name);
    product.categoryId = category?.id ?? null;
    product.category = category;
    product.barcode = strOrNull(body.barcode);
    product.unitsPerPackage = Number(body.unitsPerPackage ?? product.unitsPerPackage);
    product.markupBasis = body.markupBasis === null || body.markupBasis === undefined ? null : Number(body.markupBasis);
    product.minimumStockUnits = str(body.minimumStockUnits) || product.minimumStockUnits;
    return ok(product);
  }
  const priceMatch = /^\/bar\/products\/([^/]+)\/price$/.exec(path);
  if (method === 'PATCH' && priceMatch) {
    const product = products.find((item) => item.id === priceMatch[1]);
    if (!product) return { status: 404, data: { message: 'Товар не найден' } };
    product.salePrice = str(body.salePriceMinor);
    return ok(product);
  }
  if (method === 'POST' && path === '/bar/receipts') {
    const supplier = suppliers.find((item) => item.id === body.supplierId);
    if (!supplier) return { status: 400, data: { message: 'Укажите поставщика и номер документа' } };
    const lines = Array.isArray(body.lines) ? (body.lines as Array<Record<string, unknown>>) : [];
    let total = 0n;
    for (const line of lines) total += BigInt(str(line.unitCostMinor) || '0') * BigInt(str(line.quantityUnits) || '0');
    const receipt: BarReceipt = {
      id: nextId('e'), documentNumber: str(body.documentNumber), documentDate: str(body.documentDate),
      receivedDate: str(body.receivedDate), status: 'DRAFT', totalAmount: total.toString(),
      paidAmount: '0', dueAmount: total.toString(), supplier, _count: { lines: lines.length },
    };
    receipts.unshift(receipt);
    return ok(receipt);
  }
  const postMatch = /^\/bar\/receipts\/([^/]+)\/post$/.exec(path);
  if (method === 'POST' && postMatch) {
    const receipt = receipts.find((item) => item.id === postMatch[1]);
    if (!receipt) return { status: 404, data: { message: 'Приход не найден' } };
    if (receipt.status === 'POSTED') return { status: 409, data: { message: 'Приход уже проведен' } };
    receipt.status = 'POSTED';
    return ok({ id: receipt.id, status: 'POSTED', lotsCreated: receipt._count.lines, movementsCreated: receipt._count.lines, pricesUpdated: receipt._count.lines });
  }
  const payMatch = /^\/bar\/receipts\/([^/]+)\/payments$/.exec(path);
  if (method === 'POST' && payMatch) {
    const receipt = receipts.find((item) => item.id === payMatch[1]);
    if (!receipt) return { status: 404, data: { message: 'Приход не найден' } };
    const amount = BigInt(str(body.amountMinor) || '0');
    if (amount > BigInt(receipt.dueAmount)) return { status: 409, data: { message: `Сумма больше долга: осталось ${receipt.dueAmount}` } };
    receipt.paidAmount = (BigInt(receipt.paidAmount) + amount).toString();
    receipt.dueAmount = (BigInt(receipt.dueAmount) - amount).toString();
    return ok({ id: nextId('h'), receiptId: receipt.id, paidAmount: receipt.paidAmount, dueAmount: receipt.dueAmount });
  }
  if (method === 'POST' && path === '/bar/receipts/scan') {
    const mediaType = str(body.mediaType);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType))
      return { status: 400, data: { message: 'Нужно фото накладной: JPG, PNG или WebP. PDF пока не принимается' } };
    // подставной ИИ: кола находится по штрихкоду, сок, новый товар, поставщик совпал по названию
    return ok({
      supplierId: suppliers[0]?.active ? suppliers[0].id : null,
      supplierName: 'ТОО Алматы Напитки',
      documentNumber: 'SF-123',
      documentDate: '2026-10-08',
      lines: [
        { productId: products[0]?.id ?? null, name: 'Кола 0,5 ж/б', barcode: '4870001234567', quantityUnits: '24', unitCostMinor: '35000' },
        { productId: null, name: 'Сок яблочный 1л', barcode: '4870007654321', quantityUnits: '10', unitCostMinor: '78000' },
      ],
      warnings: ['Количество колы пересчитано из упаковок: 2 упаковки по 12 штук'],
    });
  }
  if (method === 'POST' && path === '/bar/sales/retail') {
    const sale: BarSale = {
      id: nextId('f'), status: 'POSTED', totalRevenue: '70000', totalCost: '15000', createdAt: new Date().toISOString(),
      lines: [{ id: nextId('f'), productId: str(body.productId), quantityUnits: str(body.quantityUnits), salePrice: '70000', revenue: '70000', cost: '15000', product: { name: products.find((p) => p.id === body.productId)?.name ?? 'Товар' } }],
    };
    sales.unshift(sale);
    return ok({ id: sale.id, status: 'POSTED', revenueMinor: sale.totalRevenue, costMinor: sale.totalCost });
  }
  if (method === 'POST' && path === '/bar/sales/folio')
    return ok({ id: nextId('f'), status: 'POSTED', chargeId: nextId('h'), revenueMinor: '70000', costMinor: '15000' });
  const reverseMatch = /^\/bar\/sales\/([^/]+)\/reverse$/.exec(path);
  if (method === 'POST' && reverseMatch) {
    const sale = sales.find((item) => item.id === reverseMatch[1]);
    if (!sale) return { status: 404, data: { message: 'Продажа не найдена' } };
    sale.status = 'REVERSED';
    return ok({ id: sale.id, status: 'REVERSED', restocked: body.restock === true });
  }
  if (method === 'POST' && path === '/bar/write-offs')
    return ok({ id: nextId('g'), movementsCreated: 1, costMinor: '15000' });
  if (method === 'POST' && path === '/bar/inventory-counts')
    return ok({ id: nextId('g'), systemUnits: '12', actualUnits: str(body.actualUnits), differenceUnits: (BigInt(str(body.actualUnits) || '0') - 12n).toString(), costMinor: '0' });
  return undefined;
}
