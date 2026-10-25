'use client';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { salePriceFromMarkup } from '@pms/domain';
import { suggestCode } from '../../product-code';
import type { BarProductRow, BarSupplierRow } from '../../../../lib/api';
import { formatMoney, minorToInput } from '../../../../lib/money';
import { receiptMarkupInput } from '../../../../lib/bar-markup';
import { Button, Field, Input, Select, Textarea } from '../../../../components/ui';
import { BarContextFields, type BarFormContext } from '../../context';
import {
  createBarReceiptAction,
  scanBarReceiptAction,
  type BarActionResult,
  type BarScanActionResult,
} from '../../actions';
import { useT } from '../../../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };
const scanInitial: BarScanActionResult = { error: null, ok: 0 };

/** Строка прихода: товар из справочника или новая карточка, заводится вместе с документом */
interface LineDraft {
  key: number;
  mode: 'existing' | 'new';
  productId: string;
  name: string;
  code: string;
  barcode: string;
  quantity: string;
  unitCost: string;
  markup: string;
  /** наценку правили руками: закупка её больше не пересчитывает */
  markupTouched?: boolean;
}

let lineKey = 0;
const emptyLine = (): LineDraft => ({ key: (lineKey += 1), mode: 'existing', productId: '', name: '', code: '', barcode: '', quantity: '', unitCost: '', markup: '0.00' });

// код карточки из названия живёт в общем модуле: его зовёт и серверное действие «Новый товар»
export { suggestCode };

/** Фото уменьшается до 2000 px по длинной стороне: модели столько хватает, а отправка легче */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= 2000 && file.size <= 2 * 1024 * 1024) return file;
    const scale = Math.min(1, 2000 / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const parseMinor = (raw: string) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0') : null;
};
const parseBasis = parseMinor;

export function NewReceipt({ products, suppliers, today, context }: { products: BarProductRow[]; suppliers: BarSupplierRow[]; today: string; context: BarFormContext }) {
  const t = useT();
  const [state, action, pending] = useActionState(createBarReceiptAction, initial);
  const [scanState, scanDispatch, scanPending] = useActionState(scanBarReceiptAction, scanInitial);
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()]);
  const [supplierId, setSupplierId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(today);
  const [supplierGuess, setSupplierGuess] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  useEffect(() => {
    if (state.ok) {
      setLines([emptyLine()]);
      setDocumentNumber('');
      setSupplierGuess(null);
    }
  }, [state.ok]);
  // распознанный документ встаёт в форму: человек проверяет и правит, ничего не проводится само
  const applied = useRef(0);
  useEffect(() => {
    const scan = scanState.scan;
    if (!scanState.ok || scanState.ok === applied.current || !scan) return;
    applied.current = scanState.ok;
    if (scan.supplierId) setSupplierId(scan.supplierId);
    setSupplierGuess(scan.supplierId ? null : scan.supplierName);
    if (scan.documentNumber) setDocumentNumber(scan.documentNumber);
    if (scan.documentDate) setDocumentDate(scan.documentDate);
    if (scan.lines.length > 0) setLines(scan.lines.map((line) => {
      const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
      return {
        key: (lineKey += 1),
        mode: product ? 'existing' as const : 'new' as const,
        productId: product?.id ?? '',
        name: line.name,
        code: product ? '' : suggestCode(line.name),
        barcode: line.barcode ?? '',
        quantity: line.quantityUnits,
        unitCost: minorToInput(line.unitCostMinor),
        // без своей наценки держим заданную цену продажи товара (аудит салона 22.10.2026)
        markup: receiptMarkupInput(product, minorToInput(line.unitCostMinor)),
      };
    }));
  }, [scanState.ok, scanState.scan, products]);
  const scan = () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    void shrink(file).then((prepared) => {
      const fd = new FormData();
      fd.set('document', prepared);
      startTransition(() => scanDispatch(fd));
    });
  };
  const patch = (key: number, part: Partial<LineDraft>) =>
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...part } : line)));
  return (
    <form action={action} className="panel bar-receipt-form">
      <section className="bar-scan" aria-label={t('Распознавание накладной')}>
        <div className="bar-scan-row">
          {/* без name: файл уходит только в действие скана, а не со всем приходом. Своя кнопка вместо «Choose File»
              браузера (аудит 21.10.2026 п.30): кнопка не может жить внутри label, поэтому поле собрано без Field */}
          <div className="field">
            <label htmlFor="bar-scan-file">{t('Фото накладной или счёта-фактуры')}</label>
            <input ref={fileInput} id="bar-scan-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-describedby="bar-scan-file-hint" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')} />
            <div className="bar-file-picker">
              <Button type="button" tone="secondary" onClick={() => fileInput.current?.click()}>{t('Выбрать фото')}</Button>
              <Button type="button" onClick={scan} disabled={scanPending || !fileName}>{scanPending ? t('Читаю документ…') : t('Распознать и заполнить')}</Button>
              <span aria-live="polite">{fileName || t('Фото не выбрано')}</span>
            </div>
            <span className="field__hint" id="bar-scan-file-hint">{t('JPG, PNG или WebP до 8 МБ. ИИ прочитает документ и заполнит строки, проверка и проведение остаются за вами.')}</span>
          </div>
        </div>
        {scanState.error && <p role="alert" className="bar-error">{scanState.error}</p>}
        {scanState.message && !scanState.error && <p role="status" className="bar-success">{scanState.message}</p>}
        {scanState.scan && scanState.scan.warnings.length > 0 && (
          <ul className="bar-scan-warnings">{scanState.scan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        )}
      </section>
      <BarContextFields context={context} />
      <input type="hidden" name="lineCount" value={lines.length} />
      <div className="bar-form-grid">
        <Field label={t('Поставщик')} controlId="bar-supplier" {...(supplierGuess ? { hint: t('В документе: «{name}». Такого поставщика ещё нет: заведите его на вкладке «Поставщики»', { name: supplierGuess }) } : {})}>
          <Select name="supplierId" id="bar-supplier" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="" disabled>{t('Выберите')}</option>
            {suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </Select>
        </Field>
        <Field label={t('Номер счёта-фактуры')} controlId="bar-document"><Input name="documentNumber" id="bar-document" required value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></Field>
        <Field label={t('Дата документа')} controlId="bar-document-date"><Input type="date" lang="ru" name="documentDate" id="bar-document-date" required value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></Field>
        <Field label={t('Дата приёмки')} controlId="bar-received-date"><Input type="date" lang="ru" name="receivedDate" id="bar-received-date" defaultValue={today} required /></Field>
      </div>
      <div className="bar-lines" aria-label={t('Товары прихода')}>
        {lines.map((line, index) => (
          <ReceiptLine
            key={line.key}
            index={index}
            line={line}
            products={products}
            currency={context.currency}
            onChange={(part) => patch(line.key, part)}
            {...(lines.length > 1 ? { remove: () => setLines((all) => all.filter((item) => item.key !== line.key)) } : {})}
          />
        ))}
      </div>
      <div className="bar-line-actions">
        <Button type="button" tone="secondary" onClick={() => setLines((all) => [...all, emptyLine()])}>{t('Добавить строку')}</Button>
        <Button type="button" tone="ghost" onClick={() => setLines((all) => [...all, { ...emptyLine(), mode: 'new' }])}>{t('Строка с новым товаром')}</Button>
      </div>
      <Field label={t('Комментарий')} controlId="bar-note"><Textarea name="note" id="bar-note" rows={2} /></Field>
      <label className="bar-check"><input type="checkbox" name="postNow" defaultChecked /> {t('Сразу провести и добавить на склад')}</label>
      {state.error && <p role="alert" className="bar-error">{state.error}</p>}
      {state.message && <p role="status" className="bar-success">{state.message}</p>}
      <Button type="submit" disabled={pending || suppliers.length === 0}>{pending ? t('Сохраняем…') : t('Сохранить приход')}</Button>
    </form>
  );
}

function ReceiptLine({ index, line, products, currency, onChange, remove }: {
  index: number;
  line: LineDraft;
  products: BarProductRow[];
  /** Валюта объекта (D-CUR): подписи сумм; цена по наценке утверждена только для тенге */
  currency: string;
  onChange: (part: Partial<LineDraft>) => void;
  remove?: () => void;
}) {
  const t = useT();
  const product = products.find((item) => item.id === line.productId);
  const parsedCost = parseMinor(line.unitCost);
  const parsedQuantity = /^\d+$/.test(line.quantity) ? BigInt(line.quantity) : null;
  const parsedMarkup = parseBasis(line.markup);
  const purchaseAmount = parsedCost !== null && parsedQuantity !== null ? parsedCost * parsedQuantity : null;
  // то же правило, что при проведении прихода: валюта филиала (ADR-187); пустая закупка цены не даёт
  const recommendedPrice = parsedCost !== null && parsedCost > 0n && parsedMarkup !== null
    ? salePriceFromMarkup(parsedCost, parsedMarkup, currency)
    : null;
  // наценка по товару: своя или категории, иначе та, что сохраняет заданную цену продажи (аудит салона 22.10.2026)
  const pickProduct = (productId: string) => {
    const picked = products.find((item) => item.id === productId);
    onChange({ productId, markup: receiptMarkupInput(picked, line.unitCost), markupTouched: false });
  };
  const changeCost = (unitCost: string) =>
    onChange(product && !line.markupTouched ? { unitCost, markup: receiptMarkupInput(product, unitCost) } : { unitCost });
  return <div className="bar-line" data-line-mode={line.mode}>
    {line.mode === 'existing' ? (
      <Field label={t('Товар')}>
        <Select name={`productId.${index}`} required value={line.productId} onChange={(event) => pickProduct(event.target.value)}>
          <option value="" disabled>{t('Выберите товар')}</option>
          {products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
    ) : (
      <div className="bar-line-new">
        <Field label={t('Новый товар: название')}><Input name={`newName.${index}`} required value={line.name} onChange={(event) => onChange({ name: event.target.value, code: suggestCode(event.target.value) })} /></Field>
        <Field label={t('Код карточки')}><Input name={`newCode.${index}`} required value={line.code} onChange={(event) => onChange({ code: event.target.value })} /></Field>
        <Field label={t('Штрихкод')}><Input name={`newBarcode.${index}`} value={line.barcode} onChange={(event) => onChange({ barcode: event.target.value })} /></Field>
      </div>
    )}
    <Field label={t('Кол-во, шт.')}><Input name={`quantityUnits.${index}`} inputMode="numeric" pattern="[0-9]+" value={line.quantity} onChange={(event) => onChange({ quantity: event.target.value })} required /></Field>
    <Field label={t('Закупка за 1 шт., {currency}', { currency: currency === 'KZT' ? '₸' : currency })}><Input name={`unitCost.${index}`} inputMode="decimal" value={line.unitCost} onChange={(event) => changeCost(event.target.value)} required /></Field>
    <Field label={t('Наценка, %')}><Input name={`markup.${index}`} inputMode="decimal" value={line.markup} onChange={(event) => onChange({ markup: event.target.value, markupTouched: true })} required /></Field>
    <div className="bar-line-tools">
      <Button type="button" tone="secondary" onClick={() => onChange(line.mode === 'existing' ? { mode: 'new', productId: '', code: line.code || suggestCode(line.name) } : { mode: 'existing' })}>
        {line.mode === 'existing' ? t('Нет в списке') : t('Выбрать из списка')}
      </Button>
      {remove && <Button type="button" tone="ghost" onClick={remove} aria-label={t('Убрать строку {n}', { n: index + 1 })}>{t('Убрать')}</Button>}
    </div>
    <div className="bar-line-calculation" aria-live="polite">
      <span>{t('Сумма закупки:')} <b>{purchaseAmount === null ? t('Введите количество и цену') : formatMoney(purchaseAmount, currency)}</b></span>
      <span>{t('Рекомендованная продажа:')} <b>{recommendedPrice === null ? t('Введите цену и наценку') : formatMoney(recommendedPrice, currency)}</b></span>
      {line.mode === 'new'
        ? <small>{t('Карточка товара создастся вместе с приходом: рекомендованная цена станет ценой продажи.')}</small>
        : <small>{product ? t('После проведения рекомендованная цена станет текущей. Её можно изменить во вкладке «Товары».') : t('Выберите товар или нажмите «Нет в списке», чтобы создать карточку.')}</small>}
    </div>
  </div>;
}
