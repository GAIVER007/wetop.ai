'use client';
import { BarIntentRecovery } from './bar-intent-recovery';
import { useBarIntent } from './use-bar-intent';
import type { BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { sellBarRetailAction } from './actions';

/** «Быстрая продажа» одной строкой (макет владельца 09.10.2026): товар, количество, оплата, «Продать» */
export function SaleForm({ stock, scope, readOnly }: { stock: BarStockRow[]; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'RETAIL', sellBarRetailAction);
  const available = stock.filter((item) => (item.active && BigInt(item.availableUnits) > 0n) || item.id === intent?.payload.productId);
  return <form action={dispatch} className="bar-quick-form bar-sale-form">
    <div className="bar-inline">
      <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields bar-inline" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
      <span className="bar-select-search">
        <Icon name="search" width={16} height={16} />
        <Select name="productId" aria-label="Товар" required defaultValue={intent?.payload.productId ?? ""}>
          <option value="" disabled>Выберите товар</option>
          {available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}
        </Select>
      </span>
      <Input name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue={intent?.payload.quantityUnits ?? "1"} required className="bar-qty" />
      <Select name="method" aria-label="Способ оплаты" defaultValue={intent?.payload.method ?? "CASH"}>
        <option value="CASH">Наличные</option>
        <option value="CARD_TERMINAL">Карта</option>
        <option value="KASPI">Kaspi</option>
        <option value="HALYK">Halyk</option>
        <option value="BANK_TRANSFER_PERSON">Перевод</option>
      </Select>
      </fieldset>
      <Button type="submit" disabled={readOnly || pending || !ready || !!storageError || (!intent && available.length === 0)}><Icon name="cart" width={16} height={16} /> {pending ? 'Продаём…' : intent ? 'Проверить результат' : 'Продать'}</Button>
    </div>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
