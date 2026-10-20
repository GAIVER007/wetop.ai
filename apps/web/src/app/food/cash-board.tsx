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
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { Segmented } from '../../components/segmented';
import { METHOD_RU, wholeTenge } from '../../lib/dashboard-format';
import { currencySign } from '../../lib/money';
import { FOOD_PAYMENT_METHODS, type FoodCashView, type FoodPaymentMethod } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { mutateCash } from '../cashbox/actions';
import { useConfirm } from '../../components/use-confirm';

type Kind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
const KIND_LABEL: Record<Kind, string> = { INCOME: 'Приход', EXPENSE: 'Расход', TRANSFER: 'Перевод' };
const methodName = (m: string) => METHOD_RU[m] ?? m;
const tenge = (v: string) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) * 100 : null);

function MethodSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FoodPaymentMethod;
  onChange: (m: FoodPaymentMethod) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value as FoodPaymentMethod)}>
        {FOOD_PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {methodName(m)}
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
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [kind, setKind] = useState<Kind>('INCOME');
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  const [methodTo, setMethodTo] = useState<FoodPaymentMethod>('KASPI');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [checkMethod, setCheckMethod] = useState<FoodPaymentMethod>('CASH');
  const [counted, setCounted] = useState('');
  const when = (iso: string) => localInput(iso, timezone).replace('T', ' ').slice(0, 16);
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
    if (minor === null) return setError('Сумма: целое число больше нуля');
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
          return {error:'Не удалось подтвердить операцию. Повторите с тем же черновиком.'};
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
    if (!/^\d+$/.test(counted)) return setError('Пересчитано: целое число');
    run(
      () => mutateCash(scopeKey, { kind: 'reconcile', body: { method: checkMethod, counted: Number(counted) * 100 } }),
      () => setCounted(''),
    );
  }
  const total = cash.balances.reduce((sum, b) => sum + BigInt(b.balanceMinor), 0n);
  const operations =
    cash.operations.length === 0 ? (
      <EmptyState title="Операций пока нет" />
    ) : (
      <Table>
        <thead>
          <tr>
            {['Когда', 'Вид', 'Способ', 'Сумма', 'Комментарий'].map((h) => (
              <th key={h}>{h}</th>
            ))}
            <th>
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cash.operations.map((o) => (
            <tr key={o.id} data-status={o.status}>
              <td>{when(o.occurredAt)}</td>
              <td>{o.employee ? 'Зарплата' : o.refund ? 'Возврат' : KIND_LABEL[o.kind]}</td>
              <td>
                {methodName(o.method)}
                {o.methodTo ? ` → ${methodName(o.methodTo)}` : ''}
              </td>
              <td>{wholeTenge(o.amountMinor, cash.currency)}</td>
              <td>
                {o.employee ? `${o.employee}, ${o.period}` : (o.note ?? '')}
                {o.appointmentId && o.appointmentStartsAt && (
                  <>
                    {' '}
                    <a
                      href={`/appointments?from=${localInput(o.appointmentStartsAt, timezone).slice(0, 10)}&to=${localInput(o.appointmentStartsAt, timezone).slice(0, 10)}&appointment=${o.appointmentId}`}
                    >
                      Запись
                    </a>
                  </>
                )}
                {o.status === 'VOIDED' && <small> (аннулирована)</small>}
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
                          title: `Аннулировать операцию на ${wholeTenge(o.amountMinor, cash.currency)}?`,
                          body: o.employee
                            ? `Выплата (${o.employee}) вернётся в «осталось», сама операция останется в журнале аннулированной.`
                            : 'Операция останется в журнале аннулированной, остаток способа пересчитается.',
                          confirmLabel: 'Аннулировать',
                          tone: 'danger',
                        }))
                      )
                        return;
                      run(() => mutateCash(scopeKey, { kind: 'void', id: o.id }), () => {});
                    }}
                  >
                    Аннулировать
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
      <EmptyState title="Оплат заказов пока нет" />
    ) : (
      <Table>
        <thead>
          <tr>
            {['Когда', 'Заказ', 'Способ', 'Сумма'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cash.payments.map((p) => (
            <tr key={p.id} data-status={p.status}>
              <td>{when(p.paidAt)}</td>
              <td>№{p.orderNumber}</td>
              <td>{methodName(p.method)}</td>
              <td>
                {wholeTenge(p.amountMinor, cash.currency)}
                {p.status === 'VOIDED' && <small> (аннулирован)</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  const checks =
    cash.reconciliations.length === 0 ? (
      <EmptyState title="Сверок пока не было" />
    ) : (
      <Table>
        <thead>
          <tr>
            {['Когда', 'Способ', 'По системе', 'Пересчитано', 'Разница'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cash.reconciliations.map((c) => (
            <tr key={c.id}>
              <td>{when(c.createdAt)}</td>
              <td>{methodName(c.method)}</td>
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
      <Stats min={170}>
        <Stat label="Всего в кассе" value={wholeTenge(String(total), cash.currency)} tone="info" testId="cash-total" />
        {cash.balances.map((b) => (
          <Stat
            key={b.method}
            label={methodName(b.method)}
            value={wholeTenge(b.balanceMinor, cash.currency)}
            testId={`cash-${b.method}`}
          />
        ))}
      </Stats>
      {write && (
        <div className="rest-cash-forms">
          <section className="food-form" aria-label="Операция кассы">
            <Segmented
              label="Вид операции"
              value={kind}
              options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              onChange={setKind}
            />
            <div className="food-form-row">
              <MethodSelect label={kind === 'TRANSFER' ? 'Откуда' : 'Способ'} value={method} onChange={setMethod} />
              {kind === 'TRANSFER' && <MethodSelect label="Куда" value={methodTo} onChange={setMethodTo} />}
              <Field label={`Сумма, ${currencySign(cash.currency)}`}>
                <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <Field label="Комментарий">
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="food-actions">
              <Button disabled={pending} onClick={operation}>
                Провести
              </Button>
            </div>
          </section>
          <section className="food-form" aria-label="Сверка кассы">
            <div className="food-form-row">
              <MethodSelect label="Сверка, способ" value={checkMethod} onChange={setCheckMethod} />
              <Field label={`Пересчитано, ${currencySign(cash.currency)}`}>
                <Input inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <div className="food-actions">
              <Button tone="secondary" disabled={pending} onClick={reconcile}>
                Сверить
              </Button>
            </div>
          </section>
        </div>
      )}
      <Tabs
        label="Касса"
        panels={[
          { id: 'operations', label: 'Операции', content: operations },
          ...(orders ? [{ id: 'payments', label: 'Оплаты заказов', content: payments }] : []),
          { id: 'checks', label: 'Сверки', content: checks },
        ]}
      />
    </div>
  );
}
