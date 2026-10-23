'use client';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';

import type { BarStockRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { writeOffBarAction, type BarActionResult } from './actions';
import { useDeskVertical } from '../../components/desk-access';
import { stockWords } from '../../lib/stock-words';

const initial: BarActionResult = { error: null, ok: 0 };
export function WriteOffForm({
  stock,
  context,
}: {
  context: BarFormContext;
  stock: BarStockRow[];
}) {
  const [state, action, pending] = useBarAction(writeOffBarAction, initial);
  const reasons = stockWords(useDeskVertical()).writeOffReasons;
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form onSubmit={action} className="bar-sale-form">
    <BarContextFields context={context} />
    <Field label="Товар"><Select name="productId" required defaultValue=""><option value="" disabled>Выберите товар</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}</Select></Field>
    <Field label="Кол-во, шт."><Input name="quantityUnits" inputMode="numeric" pattern="[0-9]+" required /></Field>
    <Field label="Причина"><Select name="reason" required defaultValue=""><option value="" disabled>Выберите</option>{reasons.map((reason) => <option key={reason}>{reason}</option>)}</Select></Field>
    <Button type="submit" tone="warning" disabled={pending || available.length === 0}>{pending ? 'Списываем…' : 'Списать'}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
