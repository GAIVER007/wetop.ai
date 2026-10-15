'use client';
import { useEffect, useState } from 'react';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import type { BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { barMethodRu } from '@pms/domain';
import { sellBarRetailAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

/** «Быстрая продажа» одной строкой (макет владельца 09.10.2026): товар, количество, оплата, «Продать».
 * Отправка руками (useBarAction): отказ не стирает введённое; ключ продажи стабилен до успеха или правки формы (D-KEY). */
export function SaleForm({ stock, context, methods }: { stock: BarStockRow[]; context: BarFormContext; methods: string[] }) {
  const [state, action, pending] = useBarAction(sellBarRetailAction, initial);
  const [key, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const [productId, setProductId] = useState('');
  const selected = stock.find((item) => item.id === productId);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form onSubmit={action} onChange={() => setKey(crypto.randomUUID())} className="bar-quick-form bar-retail-form" onReset={() => setProductId('')}>
    <BarContextFields context={context} />
    <input type="hidden" name="idempotencyKey" value={key} />
    <div className="bar-inline bar-retail-fields">
      <label className="bar-retail-field">
        <span className="bar-retail-label">Товар</span>
        <span className="bar-select-search">
          <Icon name="search" width={16} height={16} />
          <Select name="productId" aria-label="Товар" required defaultValue="" onChange={(event) => setProductId(event.target.value)}>
              <option value="" disabled>Выберите товар</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}
          </Select>
        </span>
      </label>
      <label className="bar-retail-field">
        <span className="bar-retail-label">Количество, шт.</span>
        <Input name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue="1" required className="bar-qty" />
      </label>
      {methods.length > 0 ? (
        <label className="bar-retail-field">
          <span className="bar-retail-label">Способ оплаты</span>
          {/* способы из настройки объекта (ADR-185): порядок её, выключенных нет */}
          <Select name="method" aria-label="Способ оплаты" defaultValue={methods[0]}>
            {methods.map((method) => <option key={method} value={method}>{barMethodRu(method)}</option>)}
          </Select>
        </label>
      ) : (
        <p role="status" className="bar-muted" data-testid="bar-no-methods">В настройках объекта нет способа оплаты, который принимает бар</p>
      )}
      {methods.length > 0 && <Button type="submit" disabled={pending || !key || available.length === 0}><Icon name="cart" width={16} height={16} /> {pending ? 'Продаём…' : 'Продать'}</Button>}
    </div>
    {selected && <p className="bar-retail-product-info"><b>{selected.name}</b><span>В наличии: {selected.availableUnits} шт.</span></p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
