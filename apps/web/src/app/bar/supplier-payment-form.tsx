'use client';
import { BarIntentRecovery } from './bar-intent-recovery';
import { useBarIntent } from './use-bar-intent';
import { Badge, Button, Field, Input, Select } from '../../components/ui';
import { payBarSupplierAction } from './actions';

const tenge = (minor: string) => {
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return fraction === '00' ? whole.toString() : `${whole}.${fraction}`;
};
export function SupplierPaymentForm({ receiptId, dueAmount, scope, readOnly }: { receiptId: string; dueAmount: string; scope: string; readOnly: boolean }) {
  const { state, dispatch, pending, intent, storageError, ready, newIntent } = useBarIntent(scope, 'SUPPLIER_PAYMENT', payBarSupplierAction, receiptId);
  if (ready && !intent && BigInt(dueAmount) <= 0n) return <Badge tone="ok">Оплачено</Badge>;
  return <form action={dispatch} className="bar-payment-form">
    <fieldset key={intent?.key ?? 'new'} className="bar-intent-fields" disabled={readOnly || pending || !!intent || !!storageError || !ready}>
    <input type="hidden" name="receiptId" value={receiptId} />
    <Field label="Сумма, ₸"><Input name="amount" inputMode="decimal" defaultValue={intent?.payload.amount ?? tenge(dueAmount)} required /></Field>
    <Field label="Способ"><Select name="method" defaultValue={intent?.payload.method ?? "BANK_TRANSFER_LEGAL"}><option value="BANK_TRANSFER_LEGAL">Счет организации</option><option value="CASH">Наличные</option><option value="CARD_TERMINAL">Карта</option><option value="KASPI">Kaspi</option><option value="HALYK">Halyk</option><option value="BANK_TRANSFER_PERSON">Перевод</option></Select></Field>
    </fieldset>
    <Button type="submit" size="xs" disabled={readOnly || pending || !ready || !!storageError || (!intent && BigInt(dueAmount) <= 0n)}>{pending ? 'Запись…' : intent ? 'Проверить результат' : 'Оплатить'}</Button>
    {intent && <BarIntentRecovery disabled={pending || readOnly} onNewIntent={newIntent} />}
    {storageError && <p role="alert" className="bar-error">{storageError}</p>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
