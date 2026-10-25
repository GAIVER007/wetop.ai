'use client';
import { useState } from 'react';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { inventoryBarAction, type BarActionResult } from './actions';
import { useT } from '../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };
export function InventoryCountForm({ stock, context }: { stock: BarStockRow[]; context: BarFormContext }) {
  const t = useT();
  const [productId, setProductId] = useState('');
  const selected = stock.find((item) => item.id === productId);
  const [state, action, pending] = useBarAction(inventoryBarAction, initial);
  return (
    <form onSubmit={action} onReset={() => setProductId('')} className="bar-sale-form">
      <BarContextFields context={context} />
      <Field label={t('Товар')}>
        <Select
          name="productId"
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="" disabled>
            {t('Выберите товар')}
          </option>
          {stock
            .filter((item) => item.active)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {t('{name}, по системе {n}', { name: item.name, n: item.availableUnits })}
              </option>
            ))}
        </Select>
      </Field>
      <Field label={t('По системе, шт.')}>
        <Input value={selected?.availableUnits ?? ''} readOnly aria-label={t('По системе, шт.')} />
      </Field>
      <Field label={t('Факт, шт.')}>
        <Input name="actualUnits" inputMode="numeric" pattern="[0-9]+" required />
      </Field>
      <Field
        label={t('Цена излишка за шт.')}
        controlId="bar-surplus-cost"
        hint={t('Нужна, только если на складе пусто. Иначе излишек примем по средней цене остатка')}
      >
        <Input name="surplusCost" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" />
      </Field>
      <Field label={t('Причина')}>
        <Input name="reason" defaultValue={t('Пересчет смены')} required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? t('Сверяем…') : t('Зафиксировать пересчёт')}
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
