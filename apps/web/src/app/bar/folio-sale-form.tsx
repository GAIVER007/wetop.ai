'use client';
import { useState } from 'react';
import { useBarIntent } from './use-bar-intent';
import { BarIntentRecovery } from './bar-intent-recovery';
import type { BarFolioRow, BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { sellBarToFolioAction } from './actions';

/**
 * «Добавить в счёт гостя» одной строкой (макет владельца 09.10.2026): гость, номер, товар, количество.
 * Гость и номер: два входа в один и тот же открытый счёт: выбор одного подставляет другой.
 */
export function FolioSaleForm({ stock, folios, scope, readOnly }: { stock: BarStockRow[]; folios: BarFolioRow[]; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'FOLIO', sellBarToFolioAction);
  const [folioId, setFolioId] = useState('');
  const available = stock.filter((item) => (item.active && BigInt(item.availableUnits) > 0n) || item.id === intent?.payload.productId);
  const units = folios.filter((folio) => folio.unitCode);
  return <form action={dispatch} className="bar-quick-form bar-folio-form">
    <div className="bar-inline bar-inline--folio">
      <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields bar-inline bar-inline--folio" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
      <Select name="folioId" aria-label="Гость" required value={intent?.payload.folioId ?? folioId} onChange={(event) => setFolioId(event.target.value)}>
        <option value="" disabled>Выберите гостя</option>
        {intent?.payload.folioId && !folios.some(row => row.id === intent.payload.folioId) && <option value={intent.payload.folioId}>Исходный счёт операции</option>}
        {folios.map((folio) => <option key={folio.id} value={folio.id}>{folio.guestName}, {folio.confirmationNumber}</option>)}
      </Select>
      <Select aria-label="Номер" value={intent?.payload.folioId ?? folioId} onChange={(event) => setFolioId(event.target.value)}>
        <option value="">Номер</option>
        {units.map((folio) => <option key={folio.id} value={folio.id}>{folio.unitCode}</option>)}
      </Select>
      <Select name="productId" aria-label="Товар" required defaultValue={intent?.payload.productId ?? ""}>
        <option value="" disabled>Выберите товар</option>
        {available.map((item) => <option key={item.id} value={item.id}>{item.name}, {item.availableUnits} шт.</option>)}
      </Select>
      <Input name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue={intent?.payload.quantityUnits ?? "1"} required className="bar-qty" />
      </fieldset>
      <Button type="submit" disabled={readOnly || pending || !ready || !!storageError || (!intent && (available.length === 0 || folios.length === 0))}><Icon name="addGuest" width={16} height={16} /> {pending ? 'Добавляем…' : intent ? 'Проверить результат' : 'Добавить в счёт'}</Button>
    </div>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
