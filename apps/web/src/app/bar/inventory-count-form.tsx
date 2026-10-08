'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';

import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { inventoryBarAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function InventoryCountForm({
  stock,
  context,
}: {
  context: BarFormContext;
  stock: BarStockRow[];
}) {
  const [state, action, pending] = useBarAction(inventoryBarAction, initial);
  return (
    <form onSubmit={action} className="panel bar-sale-form">
      <BarContextFields context={context} />
      <Field label="Товар">
        <Select name="productId" required defaultValue="">
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
      <Field label="Факт, шт.">
        <Input name="actualUnits" inputMode="numeric" pattern="[0-9]+" required />
      </Field>
      <Field label="Причина">
        <Input name="reason" defaultValue="Пересчет смены" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Сверяем…' : 'Зафиксировать'}
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
