'use client';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import type { BarProductRow, BarSupplierRow } from '../../../../lib/api';
import { formatMoney, minorToInput } from '../../../../lib/money';
import { Button, Field, Input, Select, Textarea } from '../../../../components/ui';
import {
  createBarReceiptAction,
  scanBarReceiptAction,
  type BarActionResult,
  type BarScanActionResult,
} from '../../actions';

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
}

let lineKey = 0;
const emptyLine = (): LineDraft => ({ key: (lineKey += 1), mode: 'existing', productId: '', name: '', code: '', barcode: '', quantity: '', unitCost: '', markup: '0.00' });

const RU_LAT: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'Y', к: 'K',
  л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'H', ц: 'TS',
  ч: 'CH', ш: 'SH', щ: 'SCH', ъ: '', ы: 'Y', ь: '', э: 'E', ю: 'YU', я: 'YA',
};
/** Код карточки из названия: латиница, цифры и дефис, не длиннее 24 знаков; поле остаётся правимым */
export function suggestCode(name: string): string {
  const flat = [...name.toLowerCase()].map((ch) => RU_LAT[ch] ?? ch.toUpperCase()).join('');
  const code = flat.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/g, '');
  return code || 'TOVAR';
}

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
const divideRoundUp = (valueMinor: bigint, divisor: bigint) => (valueMinor + divisor - 1n) / divisor;
const roundUpToTenTenge = (minorUnits: bigint) => divideRoundUp(minorUnits, 1_000n) * 1_000n;

export function NewReceipt({ products, suppliers, today }: { products: BarProductRow[]; suppliers: BarSupplierRow[]; today: string }) {
  const [state, action, pending] = useActionState(createBarReceiptAction, initial);
  const [scanState, scanDispatch, scanPending] = useActionState(scanBarReceiptAction, scanInitial);
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()]);
  const [supplierId, setSupplierId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(today);
  const [supplierGuess, setSupplierGuess] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
      const markup = product ? (product.markupBasis ?? product.category?.defaultMarkupBasis ?? 0) : 0;
      return {
        key: (lineKey += 1),
        mode: product ? 'existing' as const : 'new' as const,
        productId: product?.id ?? '',
        name: line.name,
        code: product ? '' : suggestCode(line.name),
        barcode: line.barcode ?? '',
        quantity: line.quantityUnits,
        unitCost: minorToInput(line.unitCostMinor),
        markup: (markup / 100).toFixed(2),
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
      <section className="bar-scan" aria-label="Распознавание накладной">
        <div className="bar-scan-row">
          <Field label="Фото накладной или счёта-фактуры" hint="JPG, PNG или WebP до 8 МБ. ИИ прочитает документ и заполнит строки, проверка и проведение остаются за вами." controlId="bar-scan-file">
            {/* без name: файл уходит только в действие скана, а не со всем приходом */}
            <input ref={fileInput} id="bar-scan-file" type="file" accept="image/jpeg,image/png,image/webp" className="inp bar-scan-input" />
          </Field>
          <Button type="button" tone="secondary" onClick={scan} disabled={scanPending}>{scanPending ? 'Читаю документ…' : 'Распознать и заполнить'}</Button>
        </div>
        {scanState.error && <p role="alert" className="bar-error">{scanState.error}</p>}
        {scanState.message && !scanState.error && <p role="status" className="bar-success">{scanState.message}</p>}
        {scanState.scan && scanState.scan.warnings.length > 0 && (
          <ul className="bar-scan-warnings">{scanState.scan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        )}
      </section>
      <input type="hidden" name="lineCount" value={lines.length} />
      <div className="bar-form-grid">
        <Field label="Поставщик" controlId="bar-supplier" {...(supplierGuess ? { hint: `В документе: «${supplierGuess}». Такого поставщика ещё нет: заведите его на вкладке «Поставщики»` } : {})}>
          <Select name="supplierId" id="bar-supplier" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="" disabled>Выберите</option>
            {suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </Select>
        </Field>
        <Field label="Номер счёта-фактуры" controlId="bar-document"><Input name="documentNumber" id="bar-document" required value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /></Field>
        <Field label="Дата документа" controlId="bar-document-date"><Input type="date" name="documentDate" id="bar-document-date" required value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></Field>
        <Field label="Дата приёмки" controlId="bar-received-date"><Input type="date" name="receivedDate" id="bar-received-date" defaultValue={today} required /></Field>
      </div>
      <div className="bar-lines" aria-label="Товары прихода">
        {lines.map((line, index) => (
          <ReceiptLine
            key={line.key}
            index={index}
            line={line}
            products={products}
            onChange={(part) => patch(line.key, part)}
            {...(lines.length > 1 ? { remove: () => setLines((all) => all.filter((item) => item.key !== line.key)) } : {})}
          />
        ))}
      </div>
      <div className="bar-line-actions">
        <Button type="button" tone="secondary" onClick={() => setLines((all) => [...all, emptyLine()])}>Добавить строку</Button>
        <Button type="button" tone="ghost" onClick={() => setLines((all) => [...all, { ...emptyLine(), mode: 'new' }])}>Строка с новым товаром</Button>
      </div>
      <Field label="Комментарий" controlId="bar-note"><Textarea name="note" id="bar-note" rows={2} /></Field>
      <label className="bar-check"><input type="checkbox" name="postNow" defaultChecked /> Сразу провести и добавить на склад</label>
      {state.error && <p role="alert" className="bar-error">{state.error}</p>}
      {state.message && <p role="status" className="bar-success">{state.message}</p>}
      <Button type="submit" disabled={pending || suppliers.length === 0}>{pending ? 'Сохраняем…' : 'Сохранить приход'}</Button>
    </form>
  );
}

function ReceiptLine({ index, line, products, onChange, remove }: {
  index: number;
  line: LineDraft;
  products: BarProductRow[];
  onChange: (part: Partial<LineDraft>) => void;
  remove?: () => void;
}) {
  const product = products.find((item) => item.id === line.productId);
  const parsedCost = parseMinor(line.unitCost);
  const parsedQuantity = /^\d+$/.test(line.quantity) ? BigInt(line.quantity) : null;
  const parsedMarkup = parseBasis(line.markup);
  const purchaseAmount = parsedCost !== null && parsedQuantity !== null ? parsedCost * parsedQuantity : null;
  const recommendedPrice = parsedCost !== null && parsedMarkup !== null
    ? roundUpToTenTenge(divideRoundUp(parsedCost * (10_000n + parsedMarkup), 10_000n))
    : null;
  const pickProduct = (productId: string) => {
    const picked = products.find((item) => item.id === productId);
    const markup = picked ? (picked.markupBasis ?? picked.category?.defaultMarkupBasis ?? 0) : 0;
    onChange({ productId, markup: (markup / 100).toFixed(2) });
  };
  return <div className="bar-line" data-line-mode={line.mode}>
    {line.mode === 'existing' ? (
      <Field label="Товар">
        <Select name={`productId.${index}`} required value={line.productId} onChange={(event) => pickProduct(event.target.value)}>
          <option value="" disabled>Выберите товар</option>
          {products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </Field>
    ) : (
      <div className="bar-line-new">
        <Field label="Новый товар: название"><Input name={`newName.${index}`} required value={line.name} onChange={(event) => onChange({ name: event.target.value, code: suggestCode(event.target.value) })} /></Field>
        <Field label="Код карточки"><Input name={`newCode.${index}`} required value={line.code} onChange={(event) => onChange({ code: event.target.value })} /></Field>
        <Field label="Штрихкод"><Input name={`newBarcode.${index}`} value={line.barcode} onChange={(event) => onChange({ barcode: event.target.value })} /></Field>
      </div>
    )}
    <Field label="Кол-во, шт."><Input name={`quantityUnits.${index}`} inputMode="numeric" pattern="[0-9]+" value={line.quantity} onChange={(event) => onChange({ quantity: event.target.value })} required /></Field>
    <Field label="Закупка за 1 шт., ₸"><Input name={`unitCost.${index}`} inputMode="decimal" value={line.unitCost} onChange={(event) => onChange({ unitCost: event.target.value })} required /></Field>
    <Field label="Наценка, %"><Input name={`markup.${index}`} inputMode="decimal" value={line.markup} onChange={(event) => onChange({ markup: event.target.value })} required /></Field>
    <div className="bar-line-tools">
      <Button type="button" tone="ghost" size="xs" onClick={() => onChange(line.mode === 'existing' ? { mode: 'new', productId: '', code: line.code || suggestCode(line.name) } : { mode: 'existing' })}>
        {line.mode === 'existing' ? 'Нет в списке' : 'Выбрать из списка'}
      </Button>
      {remove && <Button type="button" tone="ghost" size="xs" onClick={remove} aria-label={`Убрать строку ${index + 1}`}>Убрать</Button>}
    </div>
    <div className="bar-line-calculation" aria-live="polite">
      <span>Сумма закупки: <b>{purchaseAmount === null ? 'Введите количество и цену' : formatMoney(purchaseAmount)}</b></span>
      <span>Рекомендованная продажа: <b>{recommendedPrice === null ? 'Введите цену и наценку' : formatMoney(recommendedPrice)}</b></span>
      {line.mode === 'new'
        ? <small>Карточка товара создастся вместе с приходом: рекомендованная цена станет ценой продажи.</small>
        : <small>{product ? 'После проведения рекомендованная цена станет текущей. Её можно изменить во вкладке «Товары».' : 'Выберите товар или нажмите «Нет в списке», чтобы создать карточку.'}</small>}
    </div>
  </div>;
}
