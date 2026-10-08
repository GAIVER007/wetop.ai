'use server';
import { revalidatePath } from 'next/cache';
import { hotelApi } from '../../lib/hotel-api';
import { ApiError, barApi } from '../../lib/api';

export interface BarActionResult {
  error: string | null;
  ok: number;
  message?: string;
}
const value = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const describe = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error &&
        /^(Объект формы|Валюта формы|Ключ продажи|Цена|Сумма|Наценка)/.test(error.message)
      ? error.message
      : 'Не удалось выполнить действие. Проверьте результат перед повтором.';
async function verifyContext(fd: FormData) {
  const { property } = await hotelApi.settings();
  if (!property.id || value(fd, 'barPropertyId') !== property.id)
    throw new Error('Объект формы изменился. Откройте форму в выбранном объекте.');
  if (!property.currency || value(fd, 'barCurrency') !== property.currency)
    throw new Error('Валюта формы не совпадает с выбранным объектом. Обновите данные.');
  return property;
}
const saleKey = (fd: FormData) => {
  const key = value(fd, 'idempotencyKey');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))
    throw new Error('Ключ продажи отсутствует. Обновите форму.');
  return key;
};
const minor = (raw: string, field: string) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match)
    throw new Error(
      `${field}: укажите сумму в валюте операции, не более двух знаков после запятой`,
    );
  return (BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')).toString();
};
const basis = (raw: string) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('Наценка: укажите процент');
  return Number(BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0'));
};

export async function createBarReceiptAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    const context = await verifyContext(fd);
    const count = Number(value(fd, 'lineCount'));
    if (!Number.isSafeInteger(count) || count < 1)
      throw new Error('Цена: проверьте строки прихода');
    const lines = Array.from({ length: count }, (_, index) => ({
      productId: value(fd, `productId.${index}`),
      quantityUnits: value(fd, `quantityUnits.${index}`),
      unitCostMinor: minor(value(fd, `unitCost.${index}`), 'Цена закупки'),
      markupBasis: basis(value(fd, `markup.${index}`)),
    }));
    const receipt = await barApi.createReceipt({
      supplierId: value(fd, 'supplierId'),
      documentNumber: value(fd, 'documentNumber'),
      documentDate: value(fd, 'documentDate'),
      receivedDate: value(fd, 'receivedDate'),
      currency: context.currency,
      note: value(fd, 'note') || null,
      lines,
    });
    if (fd.get('postNow') === 'on') await barApi.postReceipt(receipt.id);
    revalidatePath('/bar');
    return {
      error: null,
      ok: Date.now(),
      message:
        fd.get('postNow') === 'on'
          ? 'Приход проведен, остатки обновлены'
          : 'Черновик прихода сохранен',
    };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function postBarReceiptAction(fd: FormData): Promise<BarActionResult> {
  try {
    await verifyContext(fd);

    await barApi.postReceipt(value(fd, 'id'));
    revalidatePath('/bar');

    return { error: null, ok: Date.now(), message: 'Изменение сохранено' };
  } catch (error) {
    return { error: describe(error), ok: 0 };
  }
}

export async function sellBarRetailAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    const sale = await barApi.sellRetail({
      productId: value(fd, 'productId'),
      quantityUnits: value(fd, 'quantityUnits'),
      method: value(fd, 'method'),
      idempotencyKey: saleKey(fd),
    });
    revalidatePath('/bar');
    return {
      error: null,
      ok: Date.now(),
      message:
        sale.status === 'REVERSED'
          ? 'Эта продажа уже отменена. Повторного списания нет.'
          : 'Продажа записана, остаток и касса обновлены',
    };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function sellBarToFolioAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    const sale = await barApi.sellToFolio({
      folioId: value(fd, 'folioId'),
      productId: value(fd, 'productId'),
      quantityUnits: value(fd, 'quantityUnits'),
      idempotencyKey: saleKey(fd),
    });
    revalidatePath('/bar');
    return {
      error: null,
      ok: Date.now(),
      message:
        sale.status === 'REVERSED'
          ? 'Эта продажа уже отменена. Повторного списания нет.'
          : 'Товар добавлен в счет гостя, остаток обновлен',
    };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function writeOffBarAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    await barApi.writeOff({
      productId: value(fd, 'productId'),
      quantityUnits: value(fd, 'quantityUnits'),
      reason: value(fd, 'reason'),
    });
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Товар списан, остаток обновлен' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function reverseBarSaleAction(fd: FormData): Promise<BarActionResult> {
  try {
    await verifyContext(fd);

    await barApi.reverseSale(value(fd, 'id'), {
      restock: fd.get('restock') === 'true',
      reason: value(fd, 'reason'),
    });
    revalidatePath('/bar');

    return { error: null, ok: Date.now(), message: 'Изменение сохранено' };
  } catch (error) {
    return { error: describe(error), ok: 0 };
  }
}

export async function payBarSupplierAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    await barApi.payReceipt(value(fd, 'receiptId'), {
      amountMinor: minor(value(fd, 'amount'), 'Сумма'),
      method: value(fd, 'method'),
      note: value(fd, 'note') || null,
    });
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Оплата поставщику записана в кассе' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function inventoryBarAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    const result = await barApi.inventoryCount({
      productId: value(fd, 'productId'),
      actualUnits: value(fd, 'actualUnits'),
      reason: value(fd, 'reason'),
    });
    revalidatePath('/bar');
    return {
      error: null,
      ok: Date.now(),
      message:
        result.differenceUnits === '0'
          ? 'Остаток сошелся'
          : `Недостача ${result.differenceUnits.replace('-', '')} шт. зафиксирована`,
    };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function createBarCategoryAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    await barApi.createCategory({
      name: value(fd, 'name'),
      defaultMarkupBasis: basis(value(fd, 'markup')),
    });
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Категория добавлена' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function createBarSupplierAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    await barApi.createSupplier({
      name: value(fd, 'name'),
      phone: value(fd, 'phone') || null,
      email: value(fd, 'email') || null,
      details: value(fd, 'details') || null,
    });
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Поставщик добавлен' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function createBarProductAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    const markup = value(fd, 'markup');
    await barApi.createProduct({
      code: value(fd, 'code'),
      name: value(fd, 'name'),
      categoryId: value(fd, 'categoryId') || null,
      barcode: value(fd, 'barcode') || null,
      unitsPerPackage: Number(value(fd, 'unitsPerPackage')),
      markupBasis: markup ? basis(markup) : null,
      salePriceMinor: minor(value(fd, 'salePrice'), 'Цена продажи'),
      minimumStockUnits: value(fd, 'minimumStockUnits'),
    });
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Товар добавлен' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}

export async function toggleBarCatalogAction(fd: FormData): Promise<BarActionResult> {
  try {
    await verifyContext(fd);

    const id = value(fd, 'id');
    const active = value(fd, 'active') === 'true';
    const kind = value(fd, 'kind');
    if (kind === 'category') await barApi.setCategoryActive(id, active);
    else if (kind === 'product') await barApi.setProductActive(id, active);
    else if (kind === 'supplier') await barApi.setSupplierActive(id, active);
    revalidatePath('/bar');

    return { error: null, ok: Date.now(), message: 'Изменение сохранено' };
  } catch (error) {
    return { error: describe(error), ok: 0 };
  }
}

export async function setBarProductPriceAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  try {
    await verifyContext(fd);
    await barApi.setProductPrice(value(fd, 'id'), minor(value(fd, 'salePrice'), 'Цена продажи'));
    revalidatePath('/bar');
    return { error: null, ok: Date.now(), message: 'Своя цена продажи сохранена' };
  } catch (error) {
    return { error: describe(error), ok: _previous.ok };
  }
}
