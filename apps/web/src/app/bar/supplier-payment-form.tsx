'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Select } from '../../components/ui';
import { payBarSupplierAction, type BarActionResult } from './actions';
import { barMethodRu } from '@pms/domain';

const initial: BarActionResult = { error: null, ok: 0 };
const tenge = (minor: string) => {
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return fraction === '00' ? whole.toString() : `${whole}.${fraction}`;
};
export function SupplierPaymentForm({ receiptId, dueAmount, methods }: { receiptId: string; dueAmount: string; methods: string[] }) {
  const [state, action, pending] = useActionState(payBarSupplierAction, initial);
  // способы из настройки объекта (ADR-185); счёт организации остаётся умолчанием поставщика, пока объект его не выключил
  const preferred = methods.includes('BANK_TRANSFER_LEGAL') ? 'BANK_TRANSFER_LEGAL' : methods[0];
  if (methods.length === 0) return <p role="status" className="bar-muted" data-testid="bar-no-methods">В настройках объекта нет способа оплаты, который принимает бар</p>;
  return <form action={action} className="bar-payment-form">
    <input type="hidden" name="receiptId" value={receiptId} />
    <Field label="Сумма, ₸"><Input name="amount" inputMode="decimal" defaultValue={tenge(dueAmount)} required /></Field>
    <Field label="Способ"><Select name="method" defaultValue={preferred}>{methods.map((method) => <option key={method} value={method}>{barMethodRu(method)}</option>)}</Select></Field>
    <Button type="submit" size="xs" disabled={pending}>{pending ? 'Запись…' : 'Оплатить'}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
