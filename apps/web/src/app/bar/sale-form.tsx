'use client';
import { useActionState, useState } from 'react';
import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { sellBarRetailAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
export function SaleForm({ stock }: { stock: BarStockRow[] }) {
  const [state, action, pending] = useActionState(sellBarRetailAction, initial);
  const [productId, setProductId] = useState('');
  const [quantityUnits, setQuantityUnits] = useState('');
  const [method, setMethod] = useState('CASH');
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form action={action} onReset={(event) => event.preventDefault()} className="panel bar-sale-form">
    <Field label="Товар"><Select name="productId" value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="" disabled>Выберите товар</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}</Select></Field>
    <Field label="Кол-во, шт."><Input name="quantityUnits" value={quantityUnits} onChange={(event) => setQuantityUnits(event.target.value)} inputMode="numeric" pattern="[0-9]+" required /></Field>
    <Field label="Оплата"><Select name="method" value={method} onChange={(event) => setMethod(event.target.value)}><option value="CASH">Наличные</option><option value="CARD_TERMINAL">Карта</option><option value="KASPI">Kaspi</option><option value="HALYK">Halyk</option><option value="BANK_TRANSFER_PERSON">Перевод</option></Select></Field>
    <Button type="submit" disabled={pending || available.length === 0}>{pending ? 'Продаем…' : 'Продать'}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
