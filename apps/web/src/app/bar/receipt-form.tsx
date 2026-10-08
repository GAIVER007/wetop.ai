'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import { useEffect, useState } from 'react';
import type { BarProductRow, BarSupplierRow } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';
import { createBarReceiptAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function ReceiptForm({
  products,
  suppliers,
  today,
  context,
}: {
  context: BarFormContext;
  products: BarProductRow[];
  suppliers: BarSupplierRow[];
  today: string;
}) {
  const [state, action, pending] = useBarAction(createBarReceiptAction, initial);
  const [lines, setLines] = useState([0]);
  useEffect(() => {
    if (state.ok) setLines([0]);
  }, [state.ok]);
  return (
    <form onSubmit={action} className="panel bar-receipt-form">
      <BarContextFields context={context} />
      <input type="hidden" name="lineCount" value={lines.length} />
      <div className="bar-form-grid">
        <Field label="Поставщик" controlId="bar-supplier">
          <Select name="supplierId" id="bar-supplier" required defaultValue="">
            <option value="" disabled>
              Выберите
            </option>
            {suppliers
              .filter((x) => x.active)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Номер счет-фактуры" controlId="bar-document">
          <Input name="documentNumber" id="bar-document" required />
        </Field>
        <Field label="Дата документа" controlId="bar-document-date">
          <Input
            type="date"
            name="documentDate"
            id="bar-document-date"
            defaultValue={today}
            required
          />
        </Field>
        <Field label="Дата приемки" controlId="bar-received-date">
          <Input
            type="date"
            name="receivedDate"
            id="bar-received-date"
            defaultValue={today}
            required
          />
        </Field>
      </div>
      <div className="bar-lines" aria-label="Товары прихода">
        {lines.map((line, index) => (
          <ReceiptLine
            key={`${state.ok}:${line}`}
            index={index}
            products={products}
            currency={context.currency}
            {...(lines.length > 1
              ? { remove: () => setLines((xs) => xs.filter((x) => x !== line)) }
              : {})}
          />
        ))}
      </div>
      <Button
        type="button"
        tone="secondary"
        onClick={() => setLines((xs) => [...xs, Math.max(...xs) + 1])}
      >
        Добавить товар
      </Button>
      <Field label="Комментарий" controlId="bar-note">
        <Textarea name="note" id="bar-note" rows={2} />
      </Field>
      <label className="bar-check">
        <input type="checkbox" name="postNow" defaultChecked /> Сразу провести и добавить на склад
      </label>
      {state.error && (
        <p role="alert" className="bar-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="bar-success">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || products.length === 0 || suppliers.length === 0}>
        {pending ? 'Сохраняем…' : 'Сохранить приход'}
      </Button>
    </form>
  );
}
function ReceiptLine({
  index,
  products,
  remove,
  currency,
}: {
  index: number;
  currency: string;
  products: BarProductRow[];
  remove?: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const product = products.find((x) => x.id === productId);
  const inheritedMarkup = product?.markupBasis ?? product?.category?.defaultMarkupBasis ?? 0;
  const [markup, setMarkup] = useState('0.00');
  useEffect(() => setMarkup((inheritedMarkup / 100).toFixed(2)), [inheritedMarkup, productId]);
  const parsedCost = parseMinor(unitCost);
  const parsedQuantity = /^\d+$/.test(quantity) ? BigInt(quantity) : null;
  const parsedMarkup = parseBasis(markup);
  const purchaseAmount =
    parsedCost !== null && parsedQuantity !== null ? parsedCost * parsedQuantity : null;
  const recommendedPrice =
    currency === 'KZT' && parsedCost !== null && parsedMarkup !== null
      ? roundUpToTenTenge(divideRoundUp(parsedCost * (10_000n + parsedMarkup), 10_000n))
      : null;
  return (
    <div className="bar-line">
      <Field label="Товар">
        <Select
          name={`productId.${index}`}
          required
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="" disabled>
            Выберите товар
          </option>
          {products
            .filter((x) => x.active)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Кол-во, шт.">
        <Input
          name={`quantityUnits.${index}`}
          inputMode="numeric"
          pattern="[0-9]+"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </Field>
      <Field label={`Закупка за 1 шт., ${currency}`}>
        <Input
          name={`unitCost.${index}`}
          inputMode="decimal"
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          required
        />
      </Field>
      <Field label="Наценка, %">
        <Input
          name={`markup.${index}`}
          inputMode="decimal"
          value={markup}
          onChange={(event) => setMarkup(event.target.value)}
          required
        />
      </Field>
      {remove && (
        <Button type="button" tone="ghost" onClick={remove} aria-label="Убрать товар">
          Убрать
        </Button>
      )}
      <div className="bar-line-calculation" aria-live="polite">
        <span>
          Сумма закупки:{' '}
          <b>
            {purchaseAmount === null
              ? 'Введите количество и цену'
              : formatMoney(purchaseAmount, currency)}
          </b>
        </span>
        <span>
          Рекомендованная продажа:{' '}
          <b>
            {currency !== 'KZT'
              ? 'Автоматическая цена для этой валюты ещё не утверждена'
              : recommendedPrice === null
                ? 'Введите цену и наценку'
                : formatMoney(recommendedPrice, currency)}
          </b>
        </span>
        {currency === 'KZT' && (
          <small>
            После проведения рекомендованная цена станет текущей. Ее можно изменить в остатках.
          </small>
        )}
      </div>
    </div>
  );
}

function parseMinor(raw: string) {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0') : null;
}

function parseBasis(raw: string) {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0') : null;
}

const divideRoundUp = (value: bigint, divisor: bigint) => (value + divisor - 1n) / divisor;
const roundUpToTenTenge = (minor: bigint) => divideRoundUp(minor, 1_000n) * 1_000n;
