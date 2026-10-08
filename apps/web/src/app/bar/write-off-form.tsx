'use client';
import { BarIntentRecovery } from './bar-intent-recovery';
import { useBarIntent } from './use-bar-intent';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { writeOffBarAction } from './actions';

export function WriteOffForm({ stock, scope, readOnly }: { stock: BarStockRow[]; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'WRITE_OFF', writeOffBarAction);
  const available = stock.filter((item) => (item.active && BigInt(item.availableUnits) > 0n) || item.id === intent?.payload.productId);
  return <form action={dispatch} className="panel bar-sale-form">
    <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
    <Field label="Товар"><Select name="productId" required defaultValue={intent?.payload.productId ?? ""}><option value="" disabled>Выберите товар</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}</Select></Field>
    <Field label="Кол-во, шт."><Input name="quantityUnits" defaultValue={intent?.payload.quantityUnits ?? ""} inputMode="numeric" pattern="[0-9]+" required /></Field>
    <Field label="Причина"><Select name="reason" required defaultValue={intent?.payload.reason ?? ""}><option value="" disabled>Выберите</option><option>Порча</option><option>Бой</option><option>Истек срок</option><option>Угощение</option><option>Нужды объекта</option><option>Иное</option></Select></Field>
    </fieldset>
    <Button type="submit" tone="warning" disabled={readOnly || pending || !ready || !!storageError || (!intent && available.length === 0)}>{pending ? 'Списываем…' : intent ? 'Проверить результат' : 'Списать'}</Button>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
