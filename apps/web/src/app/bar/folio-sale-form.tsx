'use client';
import { BarIntentRecovery } from './bar-intent-recovery';
import { useBarIntent } from './use-bar-intent';
import type { BarFolioRow, BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { sellBarToFolioAction } from './actions';

export function FolioSaleForm({ stock, folios, scope, readOnly }: { stock: BarStockRow[]; folios: BarFolioRow[]; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'FOLIO', sellBarToFolioAction);
  const available = stock.filter((item) => (item.active && BigInt(item.availableUnits) > 0n) || item.id === intent?.payload.productId);
  return <form action={dispatch} className="panel bar-folio-form">
    <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
    <Field label="Счет гостя"><Select name="folioId" required defaultValue={intent?.payload.folioId ?? ""}><option value="" disabled>Выберите гостя</option>{intent?.payload.folioId && !folios.some(row => row.id === intent.payload.folioId) && <option value={intent.payload.folioId}>Исходный счет операции</option>}{folios.map((folio) => <option key={folio.id} value={folio.id}>{folio.guestName}, {folio.confirmationNumber}{folio.unitCode ? `, ${folio.unitCode}` : ''}</option>)}</Select></Field>
    <Field label="Товар"><Select name="productId" required defaultValue={intent?.payload.productId ?? ""}><option value="" disabled>Выберите товар</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}, {item.availableUnits} шт.</option>)}</Select></Field>
    <Field label="Кол-во, шт."><Input name="quantityUnits" defaultValue={intent?.payload.quantityUnits ?? ""} inputMode="numeric" pattern="[0-9]+" required /></Field>
    </fieldset>
    <Button type="submit" disabled={readOnly || pending || !ready || !!storageError || (!intent && (available.length === 0 || folios.length === 0))}>{pending ? 'Добавляем…' : intent ? 'Проверить результат' : 'Добавить в счет'}</Button>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
