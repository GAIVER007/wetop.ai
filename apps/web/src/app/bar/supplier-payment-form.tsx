'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Select } from '../../components/ui';
import { payBarSupplierAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
const tenge = (minor: string) => {
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return fraction === '00' ? whole.toString() : `${whole}.${fraction}`;
};
export function SupplierPaymentForm({ receiptId, dueAmount }: { receiptId: string; dueAmount: string }) {
  const [state, action, pending] = useActionState(payBarSupplierAction, initial);
  return <form action={action} className="bar-payment-form">
    <input type="hidden" name="receiptId" value={receiptId} />
    <Field label="Сумма, ₸"><Input name="amount" inputMode="decimal" defaultValue={tenge(dueAmount)} required /></Field>
    <Field label="Способ"><Select name="method" defaultValue="BANK_TRANSFER_LEGAL"><option value="BANK_TRANSFER_LEGAL">Счет организации</option><option value="CASH">Наличные</option><option value="CARD_TERMINAL">Карта</option><option value="KASPI">Kaspi</option><option value="HALYK">Halyk</option><option value="BANK_TRANSFER_PERSON">Перевод</option></Select></Field>
    <Button type="submit" size="xs" disabled={pending}>{pending ? 'Запись…' : 'Оплатить'}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
