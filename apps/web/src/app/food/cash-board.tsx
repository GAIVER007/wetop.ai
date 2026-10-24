'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
} from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { Segmented } from '../../components/segmented';
import { METHOD_RU, wholeTenge } from '../../lib/dashboard-format';
import { currencySign } from '../../lib/money';
import { FOOD_PAYMENT_METHODS, type FoodCashView, type FoodPaymentMethod } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { intlLocale, msg, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';
import { useLocale, useT } from '../../i18n/locale-provider';
import { mutateCash } from '../cashbox/actions';
import { useConfirm } from '../../components/use-confirm';
import { useBranchPaymentMethods } from '../branch-payment-methods/use-branch-methods';
import { branchMethodsShown } from '../branch-payment-methods/shown';

type Kind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
const KIND_LABEL: Record<Kind, string> = { INCOME: msg('Приход'), EXPENSE: msg('Расход'), TRANSFER: msg('Перевод') };
/** Названия способов из общего справочника `METHOD_RU`, перевод при показе */
const methodName = (t: Translate, m: string) => (METHOD_RU[m] ? t(METHOD_RU[m]) : m);
const tenge = (v: string) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) * 100 : null);

function MethodSelect({
  label,
  value,
  onChange,
  methods = FOOD_PAYMENT_METHODS,
}: {
  label: string;
  value: FoodPaymentMethod;
  onChange: (m: FoodPaymentMethod) => void;
  /** §21.7: приход и перевод «куда» только включёнными способами; расход, «откуда» и сверка всеми */
  methods?: readonly FoodPaymentMethod[];
}) {
  const t = useT();
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value as FoodPaymentMethod)}>
        {branchMethodsShown(FOOD_PAYMENT_METHODS, [...methods], value).map((m) => (
          <option key={m} value={m}>
            {methodName(t, m)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Касса филиала (§35.2): остатки считаются из платежей и операций, ошибка аннулируется */
export function CashBoard({
  scopeKey,
  timezone,
  write,
  refunds,
  cash,
  orders = true,
}: {
  scopeKey: string;
  timezone: string;
  write: boolean;
  refunds: boolean;
  cash: FoodCashView;
  /** Вкладка «Оплаты заказов»: у салона заказов нет (§48) */
  orders?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [kind, setKind] = useState<Kind>('INCOME');
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  const accepted = useBranchPaymentMethods(scopeKey);
  const [methodTo, setMethodTo] = useState<FoodPaymentMethod>('KASPI');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [checkMethod, setCheckMethod] = useState<FoodPaymentMethod>('CASH');
  const [counted, setCounted] = useState('');
  // «22 окт., 01:06» в поясе филиала, месяц на языке человека
  const dayFormat = dateFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: timezone });
  const when = (iso: string) => `${dayFormat.format(new Date(iso))}, ${localInput(iso, timezone).slice(11, 16)}`;
  /** Расход и возврат гостю уменьшают кассу: сумма со знаком «−» */
  const signed = (o: FoodCashView['operations'][number]) =>
    wholeTenge(o.kind === 'EXPENSE' ? `-${o.amountMinor}` : o.amountMinor, cash.currency);
  const run = (fn: () => ReturnType<typeof mutateCash>, reset: () => void) =>
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else {
        setError('');
        reset();
        router.refresh();
      }
    });
  function operation() {
    const minor = tenge(amount);
    if (minor === null) return setError(amount ? t('Сумма должна быть больше нуля') : t('Введите сумму'));
    let storageKey = '';
    run(
      async () => {
        try {
          const payload = JSON.stringify(['BRANCH_CASH',scopeKey,cash.currency,kind,method,kind === 'TRANSFER' ? methodTo : null,minor,note.trim() || null]);
          const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
          const hash = Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
          // Only an opaque draft digest and random key are persisted, never the note or PII.
          storageKey = `wetop:branch-cash:${scopeKey}:${hash}`;
          const idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
          sessionStorage.setItem(storageKey,idempotencyKey);
          return await mutateCash(scopeKey, {
            kind: 'operation',
            body: {kind,method,...(kind === 'TRANSFER' ? {methodTo} : {}),amount:minor,note:note.trim() || null,idempotencyKey,},
          });
        } catch {
          return {error:t('Не удалось подтвердить операцию. Повторите с тем же черновиком.')};
        }
      },
      () => {
        sessionStorage.removeItem(storageKey);
        setAmount('');
        setNote('');
      },
    );
  }
  function reconcile() {
    if (!/^\d+$/.test(counted)) return setError(counted ? t('Пересчитано: целое число') : t('Введите пересчитанную сумму'));
    run(
      () => mutateCash(scopeKey, { kind: 'reconcile', body: { method: checkMethod, counted: Number(counted) * 100 } }),
      () => setCounted(''),
    );
  }
  const total = cash.balances.reduce((sum, b) => sum + BigInt(b.balanceMinor), 0n);
  const operations =
    cash.operations.length === 0 ? (
      <EmptyState title={t('Операций пока нет')} />
    ) : (
      <Table>
        <thead>
          <tr>
            {[msg('Когда'), msg('Вид'), msg('Способ'), msg('Сумма'), msg('Комментарий')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
            <th>
              <span className="sr-only">{t('Действия')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cash.operations.map((o) => (
            <tr key={o.id} data-status={o.status}>
              <td>{when(o.occurredAt)}</td>
              <td>{o.employee ? t('Зарплата') : o.refund ? t('Возврат') : t(KIND_LABEL[o.kind])}</td>
              <td>
                {methodName(t, o.method)}
                {o.methodTo ? ` → ${methodName(t, o.methodTo)}` : ''}
              </td>
              <td>{signed(o)}</td>
              <td>
                {o.employee ? `${o.employee}, ${o.period}` : (o.note ?? '')}
                {o.appointmentId && o.appointmentStartsAt && (
                  <>
                    {' '}
                    <a
                      href={`/appointments?from=${localInput(o.appointmentStartsAt, timezone).slice(0, 10)}&to=${localInput(o.appointmentStartsAt, timezone).slice(0, 10)}&appointment=${o.appointmentId}`}
                    >
                      {t('Запись')}
                    </a>
                  </>
                )}
                {o.status === 'VOIDED' && <small> {t('(аннулирована)')}</small>}
              </td>
              <td>
                {refunds && o.status === 'COMPLETED' && (
                  <Button
                    tone="ghost"
                    disabled={pending}
                    onClick={async () => {
                      // деньги гаснут безвозвратно: аннулированная операция не воскресает (§35.2)
                      if (
                        !(await ask({
                          title: t('Аннулировать операцию на {sum}?', { sum: wholeTenge(o.amountMinor, cash.currency) }),
                          body: o.employee
                            ? t('Выплата ({name}) вернётся в «осталось», сама операция останется в журнале аннулированной.', { name: o.employee })
                            : t('Операция останется в журнале аннулированной, остаток способа пересчитается.'),
                          confirmLabel: t('Аннулировать'),
                          tone: 'danger',
                        }))
                      )
                        return;
                      run(() => mutateCash(scopeKey, { kind: 'void', id: o.id }), () => {});
                    }}
                  >
                    {t('Аннулировать')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  const payments =
    cash.payments.length === 0 ? (
      <EmptyState title={t('Оплат заказов пока нет')} />
    ) : (
      <Table>
        <thead>
          <tr>
            {[msg('Когда'), msg('Заказ'), msg('Способ'), msg('Сумма')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cash.payments.map((p) => (
            <tr key={p.id} data-status={p.status}>
              <td>{when(p.paidAt)}</td>
              <td>№{p.orderNumber}</td>
              <td>{methodName(t, p.method)}</td>
              <td>
                {wholeTenge(p.amountMinor, cash.currency)}
                {p.status === 'VOIDED' && <small> {t('(аннулирован)')}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  const checks =
    cash.reconciliations.length === 0 ? (
      <EmptyState title={t('Сверок пока не было')} />
    ) : (
      <Table>
        <thead>
          <tr>
            {[msg('Когда'), msg('Способ'), msg('По системе'), msg('Пересчитано'), msg('Разница')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cash.reconciliations.map((c) => (
            <tr key={c.id}>
              <td>{when(c.createdAt)}</td>
              <td>{methodName(t, c.method)}</td>
              <td>{wholeTenge(c.expectedMinor, cash.currency)}</td>
              <td>{wholeTenge(c.countedMinor, cash.currency)}</td>
              <td>{wholeTenge(String(BigInt(c.countedMinor) - BigInt(c.expectedMinor)), cash.currency)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <div className="food-workspace" data-testid="cash-board">
      {dialog}
      {error && <Alert>{error}</Alert>}
      {/* аудит 21.10.2026 п. 26: вместо ряда плиток итог строкой и остатки по способам в таблице */}
      <dl className="money-summary">
        <div>
          <dt>{t('Всего в кассе')}</dt>
          <dd data-testid="cash-total">{wholeTenge(String(total), cash.currency)}</dd>
        </div>
      </dl>
      {cash.balances.length > 0 && (
        <Table aria-label={t('Остатки по способам оплаты')} data-testid="cash-balances">
          <thead>
            <tr>
              <th>{t('Способ оплаты')}</th>
              <th>{t('Остаток')}</th>
            </tr>
          </thead>
          <tbody>
            {cash.balances.map((b) => (
              <tr key={b.method}>
                <td>{methodName(t, b.method)}</td>
                <td data-testid={`cash-${b.method}`}>{wholeTenge(b.balanceMinor, cash.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {write && (
        <div className="rest-cash-forms">
          <section className="panel food-form" aria-labelledby="cash-op-title">
            <h2 id="cash-op-title" className="panel__title">{t('Операция кассы')}</h2>
            <Segmented
              label={t('Вид операции')}
              value={kind}
              options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))}
              onChange={setKind}
            />
            <div className="food-form-row">
              <MethodSelect
                label={kind === 'TRANSFER' ? t('Откуда') : t('Способ')}
                value={method}
                onChange={setMethod}
                methods={kind === 'INCOME' ? accepted : FOOD_PAYMENT_METHODS}
              />
              {kind === 'TRANSFER' && <MethodSelect label={t('Куда')} value={methodTo} onChange={setMethodTo} methods={accepted} />}
              <Field label={t('Сумма, {currency}', { currency: currencySign(cash.currency) })}>
                <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <Field label={t('Комментарий')}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="food-actions">
              <Button disabled={pending} onClick={operation}>
                {t('Провести')}
              </Button>
            </div>
          </section>
          <section className="panel food-form" aria-labelledby="cash-check-title">
            <h2 id="cash-check-title" className="panel__title">{t('Сверка кассы')}</h2>
            <p className="muted">{t('Пересчитайте деньги одного способа: WETOP покажет разницу с остатком.')}</p>
            <div className="food-form-row">
              <MethodSelect label={t('Способ')} value={checkMethod} onChange={setCheckMethod} />
              <Field label={t('Пересчитано, {currency}', { currency: currencySign(cash.currency) })}>
                <Input inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <div className="food-actions">
              <Button tone="secondary" disabled={pending} onClick={reconcile}>
                {t('Сверить')}
              </Button>
            </div>
          </section>
        </div>
      )}
      <Tabs
        label={t('Касса')}
        panels={[
          { id: 'operations', label: t('Операции'), content: operations },
          ...(orders ? [{ id: 'payments', label: t('Оплаты заказов'), content: payments }] : []),
          { id: 'checks', label: t('Сверки'), content: checks },
        ]}
      />
    </div>
  );
}
