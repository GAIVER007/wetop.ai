'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Grid, Input, Select } from '../../../components/ui';
import { type FinanceFolio } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { useMoneyReview } from './money-review';
import { payGroupAction, type FinanceActionResult } from './finance-actions';

export function GroupPayment({
  number,
  folios,
  methods,
}: {
  number: string;
  folios: FinanceFolio[];
  methods: Array<[string, string]>;
}) {
  const open = folios.filter((f) => f.status === 'OPEN');
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    payGroupAction.bind(
      null,
      number,
      open.map((f) => f.id),
    ),
    { error: null, ok: 0 },
  );
  const { review, onSubmit, onChange } = useMoneyReview(pending);
  if (open.length < 2) return null;
  const values = state.values ?? {};
  return (
    <details className="panel">
      <summary className="bold">Один платёж на несколько счетов</summary>
      <form
        key={`${state.ok}-${state.attempt ?? 0}`}
        action={action}
        onSubmit={onSubmit}
        onChangeCapture={onChange}
        className="stack"
        data-testid="group-payment-form"
      >
        <p className="hint">
          Введите общую сумму и распределите её по счетам. Пустая строка исключает счёт из платежа.
          Сумма распределений должна совпадать с общей.
        </p>
        <Grid>
          <Field label="Способ оплаты">
            <Select name="method" defaultValue={values['method'] ?? 'CASH'}>
              {methods.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Общая сумма, ${open[0]!.currency}`}>
            <Input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={values['amount'] ?? ''}
              placeholder="10000.00"
            />
          </Field>
        </Grid>
        {open.map((f, i) => (
          <Field
            key={f.id}
            label={`Счёт ${i + 1}: ${f.stay.accommodationTypeName}, ${displayDate(f.stay.arrivalDate)} → ${displayDate(f.stay.departureDate)}, баланс ${formatMoney(f.balanceMinor, f.currency)}`}
          >
            <Input
              name={`allocation.${f.id}`}
              aria-label={`На счёт ${i + 1}`}
              inputMode="decimal"
              defaultValue={values[`allocation.${f.id}`] ?? ''}
              placeholder="Сумма на этот счёт"
            />
          </Field>
        ))}
        <Field label="Примечание к платежу">
          <Input name="note" defaultValue={values['note'] ?? ''} />
        </Field>
        {review && (
          <section aria-label="Проверка общего платежа">
            <p>
              Общая сумма: {review.amount} {open[0]!.currency}. Способ:{' '}
              {methods.find(([code]) => code === review.method)?.[1]}.
            </p>
            {open.map(
              (f, i) =>
                review[`allocation.${f.id}`] && (
                  <p key={f.id}>
                    Счёт {i + 1}, {f.stay.accommodationTypeName}: {review[`allocation.${f.id}`]}{' '}
                    {f.currency}
                  </p>
                ),
            )}
            {review.note && <p>Примечание: {review.note}</p>}
            <p className="hint">Платёж ещё не проведён. Проверьте распределение и подтвердите.</p>
          </section>
        )}
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok > 0 && !state.error && (
          <p role="status" className="ok-text">
            Платёж принят. Балансы обновлены.
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Выполняется…'
            : review
              ? 'Подтвердить общий платёж'
              : 'Проверить общий платёж'}
        </Button>
      </form>
    </details>
  );
}
