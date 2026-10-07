'use client';
import { BarIntentRecovery } from './bar-intent-recovery';
import { useBarIntent } from './use-bar-intent';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { sellBarRetailAction } from './actions';

export function SaleForm({ stock, scope, readOnly }: { stock: BarStockRow[]; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'RETAIL', sellBarRetailAction);
  const available = stock.filter((item) => (item.active && BigInt(item.availableUnits) > 0n) || item.id === intent?.payload.productId);
  return <form action={dispatch} className="panel bar-sale-form">
    <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
    <Field label="Товар"><Select name="productId" required defaultValue={intent?.payload.productId ?? ""}><option value="" disabled>Выберите товар</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}</Select></Field>
    <Field label="Кол-во, шт."><Input name="quantityUnits" defaultValue={intent?.payload.quantityUnits ?? ""} inputMode="numeric" pattern="[0-9]+" required /></Field>
    <Field label="Оплата"><Select name="method" defaultValue={intent?.payload.method ?? "CASH"}><option value="CASH">Наличные</option><option value="CARD_TERMINAL">Карта</option><option value="KASPI">Kaspi</option><option value="HALYK">Halyk</option><option value="BANK_TRANSFER_PERSON">Перевод</option></Select></Field>
    </fieldset>
    <Button type="submit" disabled={readOnly || pending || !ready || !!storageError || (!intent && available.length === 0)}>{pending ? 'Продаем…' : intent ? 'Проверить результат' : 'Продать'}</Button>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
