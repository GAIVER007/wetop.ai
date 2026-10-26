'use server';
import { salePriceFromMarkup } from '@pms/domain';
import { revalidatePath } from 'next/cache';
import { suggestCode } from './product-code';
import { ApiError, barApi, type BarScanResult } from '../../lib/api';
import { loadBarContext } from './load-context';
import { currentMe } from '../../lib/desk-shell';
import { serverT } from '../../i18n/server';
import { msg, type Translate } from '../../i18n';

export interface BarActionResult { error: string | null; ok: number; message?: string }
/** Результат скана накладной: те же поля обратной связи плюс разобранный документ */
export interface BarScanActionResult extends BarActionResult { scan?: BarScanResult }
const value = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
/** Ошибка ввода формы: текст уже на языке человека, показывается как есть */
class FormError extends Error {}
const describe = (error: unknown, t: Translate) =>
  error instanceof ApiError
    ? t(error.message)
    : error instanceof FormError
      ? error.message
      : error instanceof Error &&
          /^(Объект формы|Валюта формы|Ключ продажи|Цена|Сумма|Наценка|Строка|Такой файл|Выберите фото|Файл больше|Автоматическая цена)/.test(error.message) // kk-allow: правила домена бара приходят по-русски
        ? t(error.message)
        : t('Не удалось выполнить действие. Проверьте результат перед повтором.');
async function verifyContext(fd: FormData, t: Translate) {
  const current = await loadBarContext();
  if (!current.propertyId || value(fd, 'barPropertyId') !== current.propertyId)
    throw new FormError(t('Объект формы изменился. Откройте форму в выбранном объекте.'));
  if (!current.currency || value(fd, 'barCurrency') !== current.currency)
    throw new FormError(t('Валюта формы не совпадает с выбранным объектом. Обновите данные.'));
  return current;
}
const saleKey = (fd: FormData, t: Translate, missing: string = msg('Ключ продажи отсутствует. Обновите форму.')) => {
  const key = value(fd, 'idempotencyKey');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key))
    throw new FormError(t(missing));
  return key;
};
const minor = (raw: string, field: string, t: Translate) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match)
    throw new FormError(
      t('{field}: укажите сумму в валюте операции, не более двух знаков после запятой', { field: t(field) }),
    );
  return (BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')).toString();
};
const basis = (raw: string, t: Translate) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match) throw new FormError(t('Наценка: укажите процент'));
  return Number(BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0'));
};
/** Цена продажи новой карточки: закупка плюс наценка в валюте филиала (Q-BAR-2, ADR-187) */
const salePriceOf = (unitCostMinor: string, markupBasis: number, currency: string) =>
  salePriceFromMarkup(BigInt(unitCostMinor), BigInt(markupBasis), currency).toString();
/** Раздел живёт на пяти подстраницах (ADR-157): после записи обновляются все */
const BAR_PATHS = ['/bar', '/bar/receipts', '/bar/receipts/new', '/bar/products', '/bar/suppliers', '/bar/operations'];
const revalidateBar = () => { for (const path of BAR_PATHS) revalidatePath(path); };

/** Допустимые типы документа для скана: то, что принимает вход моделей (PDF придёт отдельным срезом) */
const SCAN_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SCAN_MAX_BYTES = 8 * 1024 * 1024;

export async function scanBarReceiptAction(_previous: BarScanActionResult, fd: FormData): Promise<BarScanActionResult> {
  const t = await serverT();
  try {
    const file = fd.get('document');
    if (!(file instanceof File) || file.size === 0) throw new FormError(t('Выберите фото накладной: JPG, PNG или WebP'));
    if (!SCAN_TYPES.includes(file.type)) throw new FormError(t('Такой файл не прочитать: нужно фото JPG, PNG или WebP. PDF пока не принимается'));
    if (file.size > SCAN_MAX_BYTES) throw new FormError(t('Файл больше 8 МБ: сфотографируйте документ заново или сожмите снимок'));
    const dataBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const scan = await barApi.scanReceipt({ fileName: file.name, mediaType: file.type, dataBase64 });
    const unknown = scan.lines.filter((line) => line.productId === null).length;
    return {
      error: null, ok: Date.now(), scan,
      message: scan.lines.length === 0
        ? t('В документе не нашлось товарных строк: проверьте снимок')
        : unknown > 0
          ? t('Распознано строк: {n}, новых товаров: {unknown}. Проверьте количество и цены перед проведением', { n: scan.lines.length, unknown })
          : t('Распознано строк: {n}. Проверьте количество и цены перед проведением', { n: scan.lines.length }),
    };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function createBarReceiptAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    const context = await verifyContext(fd, t);
    const count = Number(value(fd, 'lineCount'));
    if (!Number.isSafeInteger(count) || count < 1)
      throw new FormError(t('Цена: проверьте строки прихода'));
    // строка прихода: товар из справочника или новая карточка, которую заводим перед документом
    const lines: Array<{ productId: string; quantityUnits: string; unitCostMinor: string; markupBasis: number }> = [];
    for (let index = 0; index < count; index += 1) {
      const quantityUnits = value(fd, `quantityUnits.${index}`);
      const unitCostMinor = minor(value(fd, `unitCost.${index}`), msg('Цена закупки'), t);
      const markupBasis = basis(value(fd, `markup.${index}`), t);
      let productId = value(fd, `productId.${index}`);
      if (!productId) {
        const name = value(fd, `newName.${index}`);
        const code = value(fd, `newCode.${index}`);
        if (!name || !code) throw new FormError(t('Строка {n}: выберите товар или заполните название и код новой карточки', { n: index + 1 }));
        const product = await barApi.createProduct({
          code, name, categoryId: null, barcode: value(fd, `newBarcode.${index}`) || null,
          unitsPerPackage: 1, markupBasis, salePriceMinor: salePriceOf(unitCostMinor, markupBasis, context.currency),
          minimumStockUnits: '0',
        });
        productId = product.id;
      }
      lines.push({ productId, quantityUnits, unitCostMinor, markupBasis });
    }
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
    revalidateBar();
    return { error: null, ok: Date.now(), message: fd.get('postNow') === 'on' ? t('Приход проведен, остатки обновлены') : t('Черновик прихода сохранен') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function postBarReceiptAction(fd: FormData): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.postReceipt(value(fd, 'id'));
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Приход проведен, остатки обновлены') };
  } catch (error) {
    return { error: describe(error, t), ok: 0 };
  }
}

export async function sellBarRetailAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    const context = await verifyContext(fd, t);
    const me = await currentMe();
    const expected = [me.user?.organizationId ?? '', me.context?.businessId ?? '', me.context?.locationId ?? '', me.user?.id ?? '', context.propertyId, context.currency, me.sessionIssuedAt ?? ''];
    if (expected.some(part => !part) || value(fd, 'retailRecoveryScope') !== JSON.stringify(expected) || !Number.isFinite(Date.parse(me.expiresAt ?? '')) || Date.parse(me.expiresAt ?? '') <= Date.now())
      throw new FormError(t('Объект формы изменился. Обновите страницу и восстановите исходный контекст.'));
    const sale = await barApi.sellRetail({
      productId: value(fd, 'productId'),
      quantityUnits: value(fd, 'quantityUnits'),
      method: value(fd, 'method'),
      idempotencyKey: saleKey(fd, t),
    });
    revalidateBar();
    return {
      error: null,
      ok: Date.now(),
      message:
        sale.status === 'REVERSED'
          ? t('Эта продажа уже отменена. Повторного списания нет.')
          : t('Продажа записана, остаток и касса обновлены'),
    };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

/** «Меню бара» (§62.3): позиция меню с добавками за деньги кассы или в счёт гостя; ключ продажи из формы (D-KEY) */
export async function sellBarMenuAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    const folioId = value(fd, 'folioId');
    const modifierIds = fd.getAll('modifierIds').map((id) => String(id).trim()).filter(Boolean);
    const sale = await barApi.sellMenu({
      menuItemId: value(fd, 'menuItemId'),
      quantityUnits: value(fd, 'quantityUnits'),
      modifierIds,
      ...(folioId ? { folioId } : { method: value(fd, 'method') }),
      idempotencyKey: saleKey(fd, t),
    });
    revalidateBar();
    revalidatePath('/bar/menu');
    revalidatePath('/bar/consumables');
    return {
      error: null,
      ok: Date.now(),
      message:
        sale.status === 'REVERSED'
          ? t('Эта продажа уже отменена. Повторного списания нет.')
          : folioId
            ? t('Добавлено в счёт гостя, продукты списаны со склада кухни')
            : t('Продажа записана, касса и склад кухни обновлены'),
    };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function sellBarToFolioAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    // ключ продажи приходит из формы и не меняется между повторами: сервер различает повтор и новую продажу (D-KEY)
    const sale = await barApi.sellToFolio({
      folioId: value(fd, 'folioId'),
      productId: value(fd, 'productId'),
      quantityUnits: value(fd, 'quantityUnits'),
      idempotencyKey: saleKey(fd, t),
    });
    revalidateBar();
    return {
      error: null,
      ok: Date.now(),
      message:
        sale.status === 'REVERSED'
          ? t('Эта продажа уже отменена. Повторного списания нет.')
          : t('Товар добавлен в счет гостя, остаток обновлен'),
    };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function writeOffBarAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.writeOff({ productId: value(fd, 'productId'), quantityUnits: value(fd, 'quantityUnits'), reason: value(fd, 'reason') });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Товар списан, остаток обновлен') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function reverseBarSaleAction(fd: FormData): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.reverseSale(value(fd, 'id'), { restock: fd.get('restock') === 'true', reason: value(fd, 'reason') });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Изменение сохранено') };
  } catch (error) {
    return { error: describe(error, t), ok: 0 };
  }
}

export async function payBarSupplierAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.payReceipt(value(fd, 'receiptId'), { amountMinor: minor(value(fd, 'amount'), msg('Сумма'), t), method: value(fd, 'method'), note: value(fd, 'note') || null, idempotencyKey: saleKey(fd, t, msg('Ключ оплаты отсутствует. Обновите форму.')) });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Оплата поставщику записана в кассе') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function inventoryBarAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    const surplusCost = value(fd, 'surplusCost');
    const result = await barApi.inventoryCount({
      productId: value(fd, 'productId'),
      actualUnits: value(fd, 'actualUnits'),
      reason: value(fd, 'reason'),
      unitCostMinor: surplusCost ? minor(surplusCost, msg('Цена излишка'), t) : null,
    });
    revalidateBar();
    const diff = result.differenceUnits;
    return {
      error: null,
      ok: Date.now(),
      message: diff === '0' ? t('Остаток сошелся') : diff.startsWith('-') ? t('Недостача {n} шт. зафиксирована', { n: diff.slice(1) }) : t('Излишек {n} шт. принят на склад', { n: diff }),
    };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function createBarCategoryAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.createCategory({ name: value(fd, 'name'), defaultMarkupBasis: basis(value(fd, 'markup'), t) });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Категория добавлена') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function createBarSupplierAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.createSupplier({ name: value(fd, 'name'), phone: value(fd, 'phone') || null, details: value(fd, 'details') || null });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Поставщик добавлен') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

export async function createBarProductAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    const markup = value(fd, 'markup');
    const name = value(fd, 'name').trim();
    if (!name) return { error: t('Укажите название товара'), ok: _previous.ok };
    await barApi.createProduct({
      // пустой код берём из названия, как в приходе (аудит 21.10.2026 п.2)
      code: value(fd, 'code').trim() || suggestCode(name),
      name,
      categoryId: value(fd, 'categoryId') || null,
      barcode: value(fd, 'barcode') || null,
      unitsPerPackage: Number(value(fd, 'unitsPerPackage')),
      markupBasis: markup ? basis(markup, t) : null,
      salePriceMinor: minor(value(fd, 'salePrice'), msg('Цена продажи'), t),
      minimumStockUnits: value(fd, 'minimumStockUnits'),
    });
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Товар добавлен') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

/** Карточка товара с обзора (ADR-157, макет владельца): поля карточки и, если заполнена, цена продажи */
export async function updateBarProductAction(_previous: BarActionResult, fd: FormData): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    const id = value(fd, 'id');
    const markup = value(fd, 'markup');
    await barApi.updateProduct(id, {
      name: value(fd, 'name'), categoryId: value(fd, 'categoryId') || null,
      barcode: value(fd, 'barcode') || null, unitsPerPackage: Number(value(fd, 'unitsPerPackage') || '1'),
      markupBasis: markup ? basis(markup, t) : null,
      minimumStockUnits: value(fd, 'minimumStockUnits') || '0',
    });
    const salePrice = value(fd, 'salePrice');
    if (salePrice) await barApi.setProductPrice(id, minor(salePrice, msg('Цена продажи'), t));
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Карточка товара сохранена') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}

/** Отмеченные строки доски в архив разом (макет: флажки строк); история и остатки сохраняются */
export async function archiveBarProductsAction(ids: string[]): Promise<BarActionResult> {
  const t = await serverT();
  try {
    for (const id of ids) await barApi.setProductActive(id, false);
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('В архив: {n}', { n: ids.length }) };
  } catch (error) {
    revalidateBar();
    return { error: describe(error, t), ok: 0 };
  }
}

export async function toggleBarCatalogAction(fd: FormData): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);

    const id = value(fd, 'id');
    const active = value(fd, 'active') === 'true';
    const kind = value(fd, 'kind');
    if (kind === 'category') await barApi.setCategoryActive(id, active);
    else if (kind === 'product') await barApi.setProductActive(id, active);
    else if (kind === 'supplier') await barApi.setSupplierActive(id, active);
    revalidatePath('/bar');

    return { error: null, ok: Date.now(), message: t('Изменение сохранено') };
  } catch (error) {
    return { error: describe(error, t), ok: 0 };
  }
}

export async function setBarProductPriceAction(
  _previous: BarActionResult,
  fd: FormData,
): Promise<BarActionResult> {
  const t = await serverT();
  try {
    await verifyContext(fd, t);
    await barApi.setProductPrice(value(fd, 'id'), minor(value(fd, 'salePrice'), msg('Цена продажи'), t));
    revalidateBar();
    return { error: null, ok: Date.now(), message: t('Своя цена продажи сохранена') };
  } catch (error) {
    return { error: describe(error, t), ok: _previous.ok };
  }
}
