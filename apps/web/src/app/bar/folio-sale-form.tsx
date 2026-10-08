'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import { useEffect, useState } from 'react';
import type { BarFolioRow, BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { sellBarToFolioAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function FolioSaleForm({
  stock,
  folios,
  context,
}: {
  context: BarFormContext;
  stock: BarStockRow[];
  folios: BarFolioRow[];
}) {
  const [state, action, pending] = useBarAction(sellBarToFolioAction, initial);
  const [key, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return (
    <form
      onSubmit={action}
      onChange={() => setKey(crypto.randomUUID())}
      className="panel bar-folio-form"
    >
      <BarContextFields context={context} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <Field label="Счет гостя">
        <Select name="folioId" required defaultValue="">
          <option value="" disabled>
            Выберите гостя
          </option>
          {folios.map((folio) => (
            <option key={folio.id} value={folio.id}>
              {folio.guestName}, {folio.confirmationNumber}
              {folio.unitCode ? `, ${folio.unitCode}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Товар">
        <Select name="productId" required defaultValue="">
          <option value="" disabled>
            Выберите товар
          </option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}, {item.availableUnits} шт.
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Кол-во, шт.">
        <Input name="quantityUnits" inputMode="numeric" pattern="[0-9]+" required />
      </Field>
      <Button
        type="submit"
        disabled={pending || !key || available.length === 0 || folios.length === 0}
      >
        {pending ? 'Добавляем…' : 'Добавить в счет'}
      </Button>
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
    </form>
  );
}
