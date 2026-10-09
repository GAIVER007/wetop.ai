/**
 * Бар на подставном API (ADR-154): состояние в памяти для UI-тестов стойки без базы.
 * Наполнение повторяет макет владельца 09.10.2026 (товары, поставщики, приходы, популярные), чтобы снимок
 * сравнивался с макетом глазами. Деньги строками в тиынах. Сбрасывается вместе с фикстурой (`/__test/reset`).
 */

interface BarCategory { id: string; name: string; defaultMarkupBasis: number; active: boolean }
interface BarSupplier { id: string; name: string; phone: string | null; email: string | null; details: string | null; active: boolean }
interface BarProduct {
  id: string; code: string; name: string; categoryId: string | null; barcode: string | null;
  unitsPerPackage: number; markupBasis: number | null; salePrice: string; minimumStockUnits: string;
  active: boolean; category: BarCategory | null;
  availableUnits: string; stockCostMinor: string;
  lastUnitCostMinor: string | null; lastReceivedDate: string | null; lastSupplier: { id: string; name: string } | null;
  nearestExpiry: string | null;
}
interface BarReceipt {
  id: string; documentNumber: string; documentDate: string; receivedDate: string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED'; totalAmount: string; paidAmount: string; dueAmount: string;
  supplier: BarSupplier; _count: { lines: number };
}
interface BarSale {
  id: string; status: 'POSTED' | 'REVERSED'; totalRevenue: string; totalCost: string; createdAt: string;
  lines: Array<{ id: string; productId: string; quantityUnits: string; salePrice: string; revenue: string; cost: string; product: { name: string } }>;
}
interface BarMovement { id: string; productId: string; kind: string; units: string; unitCost: string; amountMinor: string; note: string | null; createdAt: string; product: { name: string } }

let categories: BarCategory[] = [];
let products: BarProduct[] = [];
let suppliers: BarSupplier[] = [];
let receipts: BarReceipt[] = [];
let sales: BarSale[] = [];
let movements: BarMovement[] = [];
let popular: Array<{ productId: string; name: string; units: string }> = [];
let sequence = 0;
const nextId = (prefix: string) => `${prefix}0000000-0000-4000-8000-${String((sequence += 1)).padStart(12, '0')}`;
/** Даты от «сегодня» объекта (UTC+5), чтобы отбор «за 30 дней» и месяц работали в любой день прогона */
const daysAgo = (days: number) => new Date(Date.now() + 5 * 3600_000 - days * 86_400_000).toISOString().slice(0, 10);

export function resetBarFixture(): void {
  sequence = 0;
  const drinks: BarCategory = { id: nextId('c'), name: 'Безалкогольные', defaultMarkupBasis: 8800, active: true };
  const juices: BarCategory = { id: nextId('c'), name: 'Соки', defaultMarkupBasis: 7800, active: true };
  const snacks: BarCategory = { id: nextId('c'), name: 'Снэки', defaultMarkupBasis: 10000, active: true };
  categories = [drinks, juices, snacks];
  const supplier = (name: string): BarSupplier => ({ id: nextId('d'), name, phone: '+77010000000', email: null, details: null, active: true });
  const foodMaster = supplier('FoodMaster');
  const globalDrinks = supplier('Global Drinks');
  const aquaTrade = supplier('Aqua Trade');
  const snackMarket = supplier('SnackMarket');
  suppliers = [aquaTrade, foodMaster, globalDrinks, snackMarket];
  const product = (code: string, name: string, category: BarCategory, from: BarSupplier, units: number, min: number, cost: number, price: number, barcode: string | null, received: number): BarProduct => ({
    id: nextId('b'), code, name, categoryId: category.id, barcode, unitsPerPackage: 1, markupBasis: null,
    salePrice: String(price * 100), minimumStockUnits: String(min), active: true, category,
    availableUnits: String(units), stockCostMinor: String(units * cost * 100),
    lastUnitCostMinor: String(cost * 100), lastReceivedDate: daysAgo(received), lastSupplier: { id: from.id, name: from.name },
    nearestExpiry: units > 0 ? daysAgo(-180) : null,
  });
  products = [
    product('CC-050', 'Coca-Cola 0.5', drinks, foodMaster, 24, 10, 320, 600, '4870001234567', 3),
    product('RB-025', 'Red Bull 0.25', drinks, globalDrinks, 5, 10, 550, 1000, null, 5),
    product('BA-050', 'Вода BonAqua 0.5', drinks, aquaTrade, 48, 20, 180, 400, null, 10),
    product('RICH-02', 'Сок Rich 0.2', juices, foodMaster, 12, 10, 450, 800, null, 3),
    product('LAYS-90', "Чипсы Lay's 90г", snacks, snackMarket, 0, 10, 500, 1000, null, 13),
    product('SN-50', 'Шоколад Snickers', snacks, snackMarket, 18, 10, 350, 700, null, 13),
  ];
  const receipt = (number: string, from: BarSupplier, days: number, lines: number, total: number, paid: boolean): BarReceipt => ({
    id: nextId('e'), documentNumber: number, documentDate: daysAgo(days), receivedDate: daysAgo(days), status: 'POSTED',
    totalAmount: String(total * 100), paidAmount: paid ? String(total * 100) : '0', dueAmount: paid ? '0' : String(total * 100),
    supplier: from, _count: { lines },
  });
  receipts = [
    receipt('П-000123', foodMaster, 3, 12, 45600, true),
    receipt('П-000122', globalDrinks, 5, 8, 68400, false),
    receipt('П-000121', aquaTrade, 10, 15, 32500, true),
    receipt('П-000120', snackMarket, 13, 20, 96300, true),
  ];
  const cola = products[0]!;
  sales = [
    {
      id: nextId('f'), status: 'POSTED', totalRevenue: '60000', totalCost: '32000', createdAt: `${daysAgo(1)}T10:00:00.000Z`,
      lines: [{ id: nextId('f'), productId: cola.id, quantityUnits: '1', salePrice: '60000', revenue: '60000', cost: '32000', product: { name: cola.name } }],
    },
  ];
  movements = [
    { id: nextId('g'), productId: cola.id, kind: 'RECEIPT', units: '25', unitCost: '32000', amountMinor: '800000', note: 'П-000123', createdAt: `${daysAgo(3)}T09:00:00.000Z`, product: { name: cola.name } },
    { id: nextId('g'), productId: cola.id, kind: 'SALE', units: '-1', unitCost: '32000', amountMinor: '32000', note: null, createdAt: `${daysAgo(1)}T10:00:00.000Z`, product: { name: cola.name } },
  ];
  popular = [
    { productId: cola.id, name: cola.name, units: '142' },
    { productId: products[2]!.id, name: products[2]!.name, units: '96' },
    { productId: products[1]!.id, name: products[1]!.name, units: '78' },
    { productId: products[4]!.id, name: products[4]!.name, units: '64' },
    { productId: products[3]!.id, name: products[3]!.name, units: '53' },
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
    if (path === '/bar/report') {
      const debt = receipts.filter((r) => r.status === 'POSTED').reduce((sum, r) => sum + BigInt(r.dueAmount), 0n);
      const stockCost = products.filter((p) => p.active).reduce((sum, p) => sum + BigInt(p.stockCostMinor), 0n);
      return ok({
        purchasesMinor: '24280000', supplierPaidMinor: (24280000n - debt).toString(), revenueMinor: '124560000', costMinor: '62220000',
        grossProfitMinor: '62340000', writeOffMinor: '0', stockCostMinor: stockCost.toString(), supplierDebtMinor: debt.toString(),
        month: {
          monthStart: `${daysAgo(0).slice(0, 7)}-01`, purchasesMinor: '41280000', purchasesPrevMinor: '36857143',
          revenueMinor: '124560000', revenuePrevMinor: '105559322', grossProfitMinor: '62340000',
          purchasesGrowth: 12, revenueGrowth: 18,
        },
        popular,
      });
    }
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
      lastUnitCostMinor: null, lastReceivedDate: null, lastSupplier: null, nearestExpiry: null,
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
      supplierId: suppliers.find((item) => item.name === 'FoodMaster' && item.active)?.id ?? null,
      supplierName: 'FoodMaster',
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
