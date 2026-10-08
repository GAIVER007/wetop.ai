'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import { useEffect, useState } from 'react';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { sellBarRetailAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function SaleForm({ stock, context }: { context: BarFormContext; stock: BarStockRow[] }) {
  const [state, action, pending] = useBarAction(sellBarRetailAction, initial);
  const [key, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return (
    <form
      onSubmit={action}
      onChange={() => setKey(crypto.randomUUID())}
      className="panel bar-sale-form"
    >
      <BarContextFields context={context} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <Field label="Товар">
        <Select name="productId" required defaultValue="">
          <option value="" disabled>
            Выберите товар
          </option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}, остаток {item.availableUnits} шт.
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Кол-во, шт.">
        <Input name="quantityUnits" inputMode="numeric" pattern="[0-9]+" required />
      </Field>
      <Field label="Оплата">
        <Select name="method" defaultValue="CASH">
          <option value="CASH">Наличные</option>
          <option value="CARD_TERMINAL">Карта</option>
          <option value="KASPI">Kaspi</option>
          <option value="HALYK">Halyk</option>
          <option value="BANK_TRANSFER_PERSON">Перевод</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending || !key || available.length === 0}>
        {pending ? 'Продаем…' : 'Продать'}
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
