import 'reflect-metadata';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BAR_REPOSITORY, type BarCategoryInput, type BarProductInput, type BarReceiptInput, type BarRepository, type BarSupplierInput } from './bar.repository';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date = /^\d{4}-\d{2}-\d{2}$/;
const integer = (value: unknown, field: string): bigint => {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || BigInt(value) <= 0n)
    throw new BadRequestException(`${field}: нужно целое число больше нуля`);
  return BigInt(value);
};
const nonnegativeInteger = (value: unknown, field: string): bigint => {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new BadRequestException(`${field}: нужно целое неотрицательное число`);
  return BigInt(value);
};
const positiveNumber = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || Number(value) <= 0)
    throw new BadRequestException(`${field}: нужно целое число больше нуля`);
  return Number(value);
};
const optionalText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;

@Injectable()
export class BarService {
  constructor(@Inject(BAR_REPOSITORY) private readonly repo: BarRepository) {}
  categories() { return this.repo.categories(); }
  createCategory(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = optionalText(body.name);
    if (!name) throw new BadRequestException('Укажите название категории');
    const input: BarCategoryInput = { name, defaultMarkupBasis: Number(nonnegativeInteger(String(body.defaultMarkupBasis), 'Наценка')) };
    return this.repo.createCategory(input);
  }
  async setCategoryActive(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof body.active !== 'boolean') throw new BadRequestException('active: нужно true или false');
    const result = await this.repo.setCategoryActive(id, body.active);
    if (!result) throw new NotFoundException('Категория не найдена');
    return result;
  }
  products() { return this.repo.products(); }
  createProduct(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const code = optionalText(body.code);
    const name = optionalText(body.name);
    const categoryId = optionalText(body.categoryId);
    if (!code || !name) throw new BadRequestException('Укажите код и название товара');
    if (categoryId && !uuid.test(categoryId)) throw new BadRequestException('Категория указана неверно');
    const markupBasis = body.markupBasis === null || body.markupBasis === undefined
      ? null
      : Number(nonnegativeInteger(String(body.markupBasis), 'Наценка'));
    const input: BarProductInput = {
      code, name, categoryId, barcode: optionalText(body.barcode),
      unitsPerPackage: positiveNumber(body.unitsPerPackage, 'Единиц в упаковке'), markupBasis,
      salePriceMinor: integer(body.salePriceMinor, 'Цена продажи'),
      minimumStockUnits: nonnegativeInteger(body.minimumStockUnits, 'Минимальный остаток'),
    };
    return this.repo.createProduct(input);
  }
  async setProductActive(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof body.active !== 'boolean') throw new BadRequestException('active: нужно true или false');
    const result = await this.repo.setProductActive(id, body.active);
    if (!result) throw new NotFoundException('Товар не найден');
    return result;
  }
  async setProductPrice(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const result = await this.repo.setProductPrice(id, integer(body.salePriceMinor, 'Цена продажи'));
    if (!result) throw new NotFoundException('Товар не найден');
    return result;
  }
  suppliers() { return this.repo.suppliers(); }
  createSupplier(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = optionalText(body.name);
    if (!name) throw new BadRequestException('Укажите название поставщика');
    const input: BarSupplierInput = { name, phone: optionalText(body.phone), email: optionalText(body.email), details: optionalText(body.details) };
    return this.repo.createSupplier(input);
  }
  async setSupplierActive(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof body.active !== 'boolean') throw new BadRequestException('active: нужно true или false');
    const result = await this.repo.setSupplierActive(id, body.active);
    if (!result) throw new NotFoundException('Поставщик не найден');
    return result;
  }
  receipts() { return this.repo.receipts(); }
  stock() { return this.repo.stock(); }
  sales() { return this.repo.sales(); }
  folios() { return this.repo.folios(); }
  movements() { return this.repo.movements(); }
  report() { return this.repo.report(); }
  async sellRetail(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const method = typeof body.method === 'string' ? body.method : '';
    const idempotencyKey = optionalText(body.idempotencyKey);
    if (!uuid.test(productId)) throw new BadRequestException('Товар не выбран');
    if (!['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'KASPI', 'HALYK'].includes(method)) throw new BadRequestException('Способ оплаты не поддерживается');
    if (!idempotencyKey || idempotencyKey.length > 120) throw new BadRequestException('Нужен ключ повтора продажи');
    const result = await this.repo.sellRetail({ productId, quantityUnits: integer(body.quantityUnits, 'Количество'), method, idempotencyKey });
    if (result.kind === 'idempotency_conflict') throw new ConflictException('Этот ключ уже использован для другой продажи');
    if (result.kind === 'not_found') throw new NotFoundException('Товар не найден');
    if (result.kind === 'insufficient_stock') throw new ConflictException(`Недостаточно товара: доступно ${result.availableUnits}`);
    return result;
  }
  async sellToFolio(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const folioId = typeof body.folioId === 'string' ? body.folioId : '';
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const idempotencyKey = optionalText(body.idempotencyKey);
    if (!uuid.test(folioId)) throw new BadRequestException('Счет гостя не выбран');
    if (!uuid.test(productId)) throw new BadRequestException('Товар не выбран');
    if (!idempotencyKey || idempotencyKey.length > 120) throw new BadRequestException('Нужен ключ повтора продажи');
    const quantityUnits = integer(body.quantityUnits, 'Количество');
    if (quantityUnits > 2_147_483_647n) throw new BadRequestException('Количество слишком большое');
    const result = await this.repo.sellToFolio({ folioId, productId, quantityUnits, idempotencyKey });
    if (result.kind === 'idempotency_conflict') throw new ConflictException('Этот ключ уже использован для другой продажи');
    if (result.kind === 'folio_not_found') throw new NotFoundException('Открытый счет гостя не найден');
    if (result.kind === 'product_not_found') throw new NotFoundException('Товар не найден');
    if (result.kind === 'insufficient_stock') throw new ConflictException(`Недостаточно товара: доступно ${result.availableUnits}`);
    return result;
  }
  async reverseSale(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof body.restock !== 'boolean') throw new BadRequestException('restock: укажите, вернулся ли товар на склад');
    const reason = optionalText(body.reason);
    if (!reason) throw new BadRequestException('Укажите причину возврата');
    const result = await this.repo.reverseSale(id, body.restock, reason);
    if (result.kind === 'not_found') throw new NotFoundException('Продажа не найдена');
    if (result.kind === 'already_reversed') throw new ConflictException('Продажа уже возвращена');
    return result;
  }
  async writeOff(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const reason = optionalText(body.reason);
    if (!uuid.test(productId)) throw new BadRequestException('Товар не выбран');
    if (!reason) throw new BadRequestException('Укажите причину списания');
    const result = await this.repo.writeOff({ productId, quantityUnits: integer(body.quantityUnits, 'Количество'), reason });
    if (result.kind === 'not_found') throw new NotFoundException('Товар не найден');
    if (result.kind === 'insufficient_stock') throw new ConflictException(`Недостаточно товара: доступно ${result.availableUnits}`);
    return result;
  }
  async inventoryCount(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const reason = optionalText(body.reason);
    if (!uuid.test(productId)) throw new BadRequestException('Товар не выбран');
    if (!reason) throw new BadRequestException('Укажите причину пересчета');
    const result = await this.repo.inventoryCount({ productId, actualUnits: nonnegativeInteger(body.actualUnits, 'Фактический остаток'), reason });
    if (result.kind === 'not_found') throw new NotFoundException('Товар не найден');
    if (result.kind === 'surplus_requires_cost') throw new ConflictException(`Излишек не приходуем без решения о себестоимости. По системе ${result.systemUnits}`);
    return result;
  }
  createReceipt(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const supplierId = typeof body.supplierId === 'string' ? body.supplierId : '';
    const documentNumber = typeof body.documentNumber === 'string' ? body.documentNumber.trim() : '';
    const documentDate = typeof body.documentDate === 'string' ? body.documentDate : '';
    const receivedDate = typeof body.receivedDate === 'string' ? body.receivedDate : '';
    const currency = typeof body.currency === 'string' ? body.currency : '';
    if (!uuid.test(supplierId) || !documentNumber) throw new BadRequestException('Укажите поставщика и номер документа');
    if (!date.test(documentDate) || !date.test(receivedDate)) throw new BadRequestException('Укажите даты документа и приемки');
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('Валюта: три заглавные буквы');
    if (!Array.isArray(body.lines) || body.lines.length === 0) throw new BadRequestException('Добавьте хотя бы один товар');
    const input: BarReceiptInput = { supplierId, documentNumber, documentDate, receivedDate, currency, note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null, lines: body.lines.map((rawLine) => {
      const l = (rawLine && typeof rawLine === 'object' ? rawLine : {}) as Record<string, unknown>;
      const productId = typeof l.productId === 'string' ? l.productId : '';
      if (!uuid.test(productId)) throw new BadRequestException('Товар не выбран');
      const markup = nonnegativeInteger(String(l.markupBasis), 'Наценка');
      return { productId, quantityUnits: integer(l.quantityUnits, 'Количество'), unitCostMinor: integer(l.unitCostMinor, 'Цена закупки'), markupBasis: markup };
    }) };
    return this.repo.createReceipt(input);
  }
  async postReceipt(id: string) {
    const result = await this.repo.postReceipt(id);
    if (result.kind === 'not_found') throw new NotFoundException('Приход не найден');
    if (result.kind === 'already_posted') throw new ConflictException('Приход уже проведен');
    return result;
  }
  async payReceipt(id: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const method = typeof body.method === 'string' ? body.method : '';
    if (!['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_LEGAL', 'BANK_TRANSFER_PERSON', 'KASPI', 'HALYK'].includes(method)) throw new BadRequestException('Способ оплаты не поддерживается');
    const result = await this.repo.payReceipt(id, { amountMinor: integer(body.amountMinor, 'Сумма'), method, note: optionalText(body.note) });
    if (result.kind === 'not_found') throw new NotFoundException('Приход не найден');
    if (result.kind === 'not_posted') throw new ConflictException('Оплатить можно только проведенный приход');
    if (result.kind === 'overpayment') throw new ConflictException(`Сумма больше долга: осталось ${result.dueAmount}`);
    return result;
  }
}
