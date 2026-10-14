'use client';
import { useActionState, useState } from 'react';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { inventoryBarAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function InventoryCountForm({ stock }: { stock: BarStockRow[] }) {
  const [productId, setProductId] = useState('');
  const selected = stock.find((item) => item.id === productId);
  const [state, action, pending] = useActionState(inventoryBarAction, initial);
  return (
    <form action={action} className="bar-sale-form">
      <Field label="Товар">
        <Select
          name="productId"
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="" disabled>
            Выберите товар
          </option>
          {stock
            .filter((item) => item.active)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}, по системе {item.availableUnits}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="По системе, шт.">
        <Input value={selected?.availableUnits ?? ''} readOnly aria-label="По системе, шт." />
      </Field>
      <Field label="Факт, шт.">
        <Input name="actualUnits" inputMode="numeric" pattern="[0-9]+" required />
      </Field>
      <Field label="Причина">
        <Input name="reason" defaultValue="Пересчет смены" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Сверяем…' : 'Зафиксировать пересчёт'}
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
