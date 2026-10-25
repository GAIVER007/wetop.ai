'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Grid, Input, Select } from '../../../components/ui';
import { type FinanceFolio } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { useMoneyReview } from './money-review';
import { intlLocale } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';
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
  const t = useT();
  const locale = useLocale();
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
      <summary className="bold">{t('Один платёж на несколько счетов')}</summary>
      <form
        key={`${state.ok}-${state.attempt ?? 0}`}
        action={action}
        onSubmit={onSubmit}
        onChangeCapture={onChange}
        className="stack"
        data-testid="group-payment-form"
      >
        <p className="hint">
          {t(
            'Введите общую сумму и распределите её по счетам. Пустая строка исключает счёт из платежа. Сумма распределений должна совпадать с общей.',
          )}
        </p>
        <Grid>
          <Field label={t('Способ оплаты')}>
            <Select name="method" defaultValue={values['method'] ?? 'CASH'}>
              {methods.map(([code, name]) => (
                <option key={code} value={code}>
                  {t(name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Общая сумма, {currency}', { currency: open[0]!.currency })}>
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
            label={t('Счёт {n}: {category}, {from} → {to}, баланс {balance}', {
              n: i + 1,
              category: f.stay.accommodationTypeName,
              from: displayDate(f.stay.arrivalDate, 'short', intlLocale(locale)),
              to: displayDate(f.stay.departureDate, 'short', intlLocale(locale)),
              balance: formatMoney(f.balanceMinor, f.currency),
            })}
          >
            <Input
              name={`allocation.${f.id}`}
              aria-label={t('На счёт {n}', { n: i + 1 })}
              inputMode="decimal"
              defaultValue={values[`allocation.${f.id}`] ?? ''}
              placeholder={t('Сумма на этот счёт')}
            />
          </Field>
        ))}
        <Field label={t('Примечание к платежу')}>
          <Input name="note" defaultValue={values['note'] ?? ''} />
        </Field>
        {review && (
          <section aria-label={t('Проверка общего платежа')}>
            <p>
              {t('Общая сумма: {amount} {currency}. Способ: {method}.', {
                amount: review.amount ?? '',
                currency: open[0]!.currency,
                method: t(methods.find(([code]) => code === review.method)?.[1] ?? ''),
              })}
            </p>
            {open.map(
              (f, i) =>
                review[`allocation.${f.id}`] && (
                  <p key={f.id}>
                    {t('Счёт {n}, {category}: {amount} {currency}', {
                      n: i + 1,
                      category: f.stay.accommodationTypeName,
                      amount: review[`allocation.${f.id}`] ?? '',
                      currency: f.currency,
                    })}
                  </p>
                ),
            )}
            {review.note && <p>{t('Примечание: {note}', { note: review.note })}</p>}
            <p className="hint">{t('Платёж ещё не проведён. Проверьте распределение и подтвердите.')}</p>
          </section>
        )}
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok > 0 && !state.error && (
          <p role="status" className="ok-text">
            {t('Платёж принят. Балансы обновлены.')}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending
            ? t('Выполняется…')
            : review
              ? t('Подтвердить общий платёж')
              : t('Проверить общий платёж')}
        </Button>
      </form>
    </details>
  );
}
