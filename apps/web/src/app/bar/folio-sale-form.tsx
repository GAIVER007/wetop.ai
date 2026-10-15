'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';
import { useEffect, useState } from 'react';
import type { BarFolioRow, BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { sellBarToFolioAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

/**
 * «Добавить в счёт гостя» одной строкой (макет владельца 09.10.2026): гость, номер, товар, количество.
 * Гость и номер: два входа в один и тот же открытый счёт: выбор одного подставляет другой.
 * Отправка руками (useBarAction): отказ не стирает введённое; ключ продажи стабилен до успеха или правки формы (D-KEY).
 */
export function FolioSaleForm({ stock, folios, context }: { stock: BarStockRow[]; folios: BarFolioRow[]; context: BarFormContext }) {
  const [state, action, pending] = useBarAction(sellBarToFolioAction, initial);
  const [folioId, setFolioId] = useState('');
  const [key, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), [state.ok]);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  const units = folios.filter((folio) => folio.unitCode);
  return <form onSubmit={action} onChange={() => setKey(crypto.randomUUID())} className="bar-quick-form">
    <BarContextFields context={context} />
    <input type="hidden" name="idempotencyKey" value={key} />
    <div className="bar-inline bar-inline--folio">
      <Select name="folioId" aria-label="Гость" required value={folioId} onChange={(event) => setFolioId(event.target.value)}>
        <option value="" disabled>Выберите гостя</option>
        {folios.map((folio) => <option key={folio.id} value={folio.id}>{folio.guestName}, {folio.confirmationNumber}</option>)}
      </Select>
      <Select aria-label="Номер" value={folioId} onChange={(event) => setFolioId(event.target.value)}>
        <option value="">Номер</option>
        {units.map((folio) => <option key={folio.id} value={folio.id}>{folio.unitCode}</option>)}
      </Select>
      <Select name="productId" aria-label="Товар" required defaultValue="">
        <option value="" disabled>Выберите товар</option>
        {available.map((item) => <option key={item.id} value={item.id}>{item.name}, {item.availableUnits} шт.</option>)}
      </Select>
      <Input name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue="1" required className="bar-qty" />
      <Button type="submit" disabled={pending || !key || available.length === 0 || folios.length === 0}><Icon name="addGuest" width={16} height={16} /> {pending ? 'Добавляем…' : 'Добавить в счёт'}</Button>
    </div>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
