'use client';
import { useActionState, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Select } from '../../components/ui';
import { useMay } from '../../components/desk-access';
import { formatMoney } from '../../lib/money';
import { PaymentForm, RefundForm, methodRu } from '../reservations/[number]/finance-panel';
import { payAction, type FinanceActionResult } from '../reservations/[number]/finance-actions';
import { stayFinanceAction, type PreviewFolio } from './actions';

const INIT: FinanceActionResult = { error: null, ok: 0 };

export function PreviewFinance({
  number,
  itemId,
  onDraftChange,
  onPendingChange,
  onComplete,
  readOnly,
}: {
  readOnly: boolean;
  number: string;
  itemId: string;
  onDraftChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onComplete: () => void;
}) {
  const router = useRouter();
  const desk = useMay('desk') && !readOnly;
  const refunds = useMay('refunds') && !readOnly;
  const [folio, setFolio] = useState<PreviewFolio | null | undefined>(undefined);
  const [mode, setMode] = useState<'pay' | 'refund'>('pay');
  const [paymentId, setPaymentId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [refundPending, setRefundPending] = useState(false);
  const [result, setResult] = useState<FinanceActionResult>(INIT);
  const markDirty = useCallback(
    (value: boolean) => {
      setDirty(value);
      onDraftChange(value);
    },
    [onDraftChange],
  );
  useEffect(() => {
    let alive = true;
    void stayFinanceAction(number, itemId).then((next) => {
      if (alive) setFolio(next);
    });
    return () => {
      alive = false;
    };
  }, [number, itemId]);
  const completed = async (next: FinanceActionResult) => {
    setResult(next);
    if (next.error) return;
    markDirty(false);
    setFolio(await stayFinanceAction(number, itemId));
    onComplete();
    router.refresh();
  };
  const [payState, pay, payPending] = useActionState<FinanceActionResult, FormData>(
    async (previous, fd) => {
      if (!folio || folio.status !== 'OPEN' || !desk)
        return { ...previous, error: 'Оплата недоступна' };
      const next = await payAction(number, folio.id, previous, fd);
      await completed(next);
      return next;
    },
    INIT,
  );
  const busy = payPending || refundPending;
  useEffect(() => {
    onPendingChange(busy);
  }, [busy, onPendingChange]);
  if (folio === undefined) return <p role="status">Загружаю счёт…</p>;
  if (!folio) return <Alert>Не удалось загрузить счёт. Закройте и откройте окно повторно.</Alert>;
  const payment = folio.payments.find((p) => p.paymentId === paymentId) ?? folio.payments[0];
  return (
    <section className="stay-preview-finance" aria-label="Оплата и возврат">
      <div className="row">
        <Button
          type="button"
          tone="secondary"
          disabled={busy || dirty}
          aria-pressed={mode === 'pay'}
          onClick={() => setMode('pay')}
        >
          Оплата
        </Button>
        {refunds && (
          <Button
            type="button"
            tone="secondary"
            disabled={busy || dirty}
            aria-pressed={mode === 'refund'}
            onClick={() => setMode('refund')}
          >
            Возврат
          </Button>
        )}
      </div>
      {result.error && <Alert>{result.error}</Alert>}
      {result.ok > 0 && !result.error && (
        <p role="status" data-testid="preview-finance-result">
          {result.message ?? 'Возврат проведён.'}
        </p>
      )}
      {folio.status !== 'OPEN' ? (
        <p>Счёт закрыт. Финансовые действия недоступны.</p>
      ) : mode === 'pay' ? (
        desk ? (
          <PaymentForm
            key={`pay-${payState.ok}-${payState.attempt ?? 0}`}
            number={number}
            folio={folio}
            action={pay}
            values={payState.values}
            busy={busy}
            onDraftChange={markDirty}
          />
        ) : (
          <p>Нет права принимать оплату.</p>
        )
      ) : refunds && payment ? (
        <>
          <Field label="Платёж для возврата">
            <Select
              value={payment.paymentId}
              disabled={busy || dirty}
              onChange={(event) => setPaymentId(event.target.value)}
            >
              {folio.payments.map((p, index) => (
                <option key={p.paymentId} value={p.paymentId}>
                  Платёж {index + 1}, {methodRu(p.method)}, доступно{' '}
                  {formatMoney(p.remainingMinor, folio.currency)}
                </option>
              ))}
            </Select>
          </Field>
          <p>Доступно к возврату: {formatMoney(payment.remainingMinor, folio.currency)}</p>
          <RefundForm
            key={payment.paymentId}
            number={number}
            paymentId={payment.paymentId}
            folioId={folio.id}
            onResult={(next) => void completed(next)}
            onDraftChange={markDirty}
            onPendingChange={setRefundPending}
          />
        </>
      ) : (
        <p>Нет платежей с доступной суммой возврата.</p>
      )}
    </section>
  );
}
