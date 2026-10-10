'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import { useEffect, useState } from 'react';
import type { BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { sellBarRetailAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

/** «Быстрая продажа» одной строкой (макет владельца 09.10.2026): товар, количество, оплата, «Продать».
 * Отправка руками (useBarAction): отказ не стирает введённое; ключ продажи стабилен до успеха или правки формы (D-KEY). */
export function SaleForm({ stock, context }: { stock: BarStockRow[]; context: BarFormContext }) {
  const [state, action, pending] = useBarAction(sellBarRetailAction, initial);
  const [key, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form onSubmit={action} onChange={() => setKey(crypto.randomUUID())} className="bar-quick-form">
    <BarContextFields context={context} />
    <input type="hidden" name="idempotencyKey" value={key} />
    <div className="bar-inline">
      <span className="bar-select-search">
        <Icon name="search" width={16} height={16} />
        <Select name="productId" aria-label="Товар" required defaultValue="">
          <option value="" disabled>Выберите товар</option>
          {available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}
        </Select>
      </span>
      <Input name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue="1" required className="bar-qty" />
      <Select name="method" aria-label="Способ оплаты" defaultValue="CASH">
        <option value="CASH">Наличные</option>
        <option value="CARD_TERMINAL">Карта</option>
        <option value="KASPI">Kaspi</option>
        <option value="HALYK">Halyk</option>
        <option value="BANK_TRANSFER_PERSON">Перевод</option>
      </Select>
      <Button type="submit" disabled={pending || !key || available.length === 0}><Icon name="cart" width={16} height={16} /> {pending ? 'Продаём…' : 'Продать'}</Button>
    </div>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
