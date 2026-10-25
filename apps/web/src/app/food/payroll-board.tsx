'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
} from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { MonthInput } from '../../components/date-field';
import { Tabs } from '../../components/tabs';
import { Segmented } from '../../components/segmented';
import { METHOD_RU } from '../../lib/dashboard-format';
import { currencySign, formatMoney, inputToMinor, minorToInput } from '../../lib/money';
import {
  FOOD_PAYMENT_METHODS,
  type FoodPaymentMethod,
  type PayModel,
  type PayrollRow,
  type PayrollView,
} from '../../lib/food-types';
import { mutateStaff } from './restaurant-actions';
import { useBranchPaymentMethods } from '../branch-payment-methods/use-branch-methods';
import { branchMethodsShown } from '../branch-payment-methods/shown';
import { msg, translator, type Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/** База процента: у ресторана закрытые заказы, у салона выполненные записи (§19.2) */
export type PayBasis = 'orders' | 'visits';
const BASIS = {
  orders: { percent: msg('Процент от заказов'), rate: msg('{n} % от заказов'), column: msg('Продажи') },
  visits: { percent: msg('Процент от записей'), rate: msg('{n} % от записей'), column: msg('Услуги') },
} as const;
const modelLabel = (t: Translate, model: PayModel, basis: PayBasis): string =>
  ({ FIXED: t('Оклад'), PERCENT: t(BASIS[basis].percent), FIXED_PLUS_PERCENT: t('Оклад + процент'), BONUS_ONLY: t('Только премии') })[model];
const MODELS: PayModel[] = ['FIXED', 'PERCENT', 'FIXED_PLUS_PERCENT', 'BONUS_ONLY'];

const currencyLabel = currencySign;

/** `t` переводит текст ошибки на язык человека; без него русский */
function payrollInputToMinor(value: string, currency: string, allowZero: boolean, t: Translate): number {
  const parsed = inputToMinor(value);
  if (parsed === null || parsed === '') throw new Error(t('Укажите сумму в {currency}', { currency: currencyLabel(currency) }));
  const minor = BigInt(parsed);
  if (!allowZero && minor === 0n) throw new Error(t('Сумма должна быть больше нуля'));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(t('Сумма слишком большая'));
  return Number(minor);
}

export const payrollSalaryInputToMinor = (value: string, currency: string, t: Translate = translator('ru')): number =>
  payrollInputToMinor(value, currency, true, t);

export const payrollPositiveInputToMinor = (value: string, currency: string, t: Translate = translator('ru')): number =>
  payrollInputToMinor(value, currency, false, t);

export const payrollMinorToInput = minorToInput;

function PayDrawer({
  scopeKey,
  row,
  basis,
  currency,
  close,
}: {
  scopeKey: string;
  row: PayrollRow;
  basis: PayBasis;
  currency: string;
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [model, setModel] = useState<PayModel>(row.model);
  const [fixed, setFixed] = useState(payrollMinorToInput(row.fixedMinor));
  const [percent, setPercent] = useState(String(row.percent));
  function submit() {
    setError('');
    const pct = Math.round(Number(percent));
    let fixedMinor: number;
    try {
      fixedMinor = payrollSalaryInputToMinor(fixed, currency, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Некорректная сумма'));
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError(t('Процент должен быть целым числом от 0 до 100'));
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'pay-settings',
        id: row.employeeId,
        body: { model, fixedMinor, percent: pct },
      });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={t('Оплата: {name}', { name: row.name })} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="pay-settings">
        {error && <Alert>{error}</Alert>}
        <Field label={t('Модель оплаты')}>
          <Select value={model} onChange={(e) => setModel(e.target.value as PayModel)}>
            {MODELS.map((value) => [value, modelLabel(t, value, basis)] as const).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="food-form-row">
          <Field label={t('Оклад за месяц, {currency}', { currency: currencyLabel(currency) })}>
            <Input type="number" inputMode="decimal" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
          </Field>
          <Field label={t(BASIS[basis].percent)}>
            <Input
              type="number"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </Field>
        </div>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            {t('Сохранить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function AdjustmentDrawer({
  scopeKey,
  month,
  currency,
  row,
  close,
}: {
  scopeKey: string;
  month: string;
  currency: string;
  row: PayrollRow;
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'bonus' | 'penalty'>('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  function submit() {
    setError('');
    let amountMinor: number;
    try {
      amountMinor = payrollPositiveInputToMinor(amount, currency, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Некорректная сумма'));
      return;
    }
    if (!reason.trim()) {
      setError(t('Нужны сумма больше нуля и причина'));
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'adjustment',
        id: row.employeeId,
        body: {
          period: month,
          amountMinor: (kind === 'bonus' ? 1 : -1) * amountMinor,
          reason: reason.trim(),
        },
      });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={t('Начисление: {name}', { name: row.name })} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="pay-adjustment">
        {error && <Alert>{error}</Alert>}
        <Segmented
          label={t('Вид начисления')}
          value={kind}
          options={[
            { value: 'bonus', label: t('Премия') },
            { value: 'penalty', label: t('Удержание') },
          ]}
          onChange={setKind}
        />
        <Field label={t('Сумма, {currency}', { currency: currencyLabel(currency) })}>
          <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('Причина')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            {t('Начислить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

/** Выплата из кассы филиала (§35.3): не больше остатка за месяц */
function PayoutDrawer({
  scopeKey,
  month,
  currency,
  row,
  close,
}: {
  scopeKey: string;
  month: string;
  currency: string;
  row: PayrollRow;
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  // §21.7: выплата только включёнными в филиале способами
  const accepted = useBranchPaymentMethods(scopeKey);
  const [amount, setAmount] = useState(payrollMinorToInput(row.remainingMinor));
  // One drawer is one payment intent; failures keep the same key.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  function submit() {
    let amountMinor: number;
    try {
      amountMinor = payrollPositiveInputToMinor(amount, currency, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Некорректная сумма'));
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'payout',
        id: row.employeeId,
        body: { period: month, method, amount: amountMinor, idempotencyKey },
      });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={t('Выплата: {name}', { name: row.name })} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="payout">
        {error && <Alert>{error}</Alert>}
        <p className="muted">
          {t('Начислено за месяц {total}, выплачено {paid}. Деньги уйдут расходом из кассы.', {
            total: formatMoney(row.totalMinor, currency),
            paid: formatMoney(row.paidMinor, currency),
          })}
        </p>
        <Field label={t('Способ')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as FoodPaymentMethod)}>
            {branchMethodsShown(FOOD_PAYMENT_METHODS, accepted, method).map((m) => (
              <option key={m} value={m}>
                {METHOD_RU[m] ? t(METHOD_RU[m]) : m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Сумма, {currency}', { currency: currencyLabel(currency) })}>
          <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            {t('Выплатить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

/** «Зарплата и финансы» по макету (ADR-159): фонд, премии, удержания, начислено (одни подписи у всех направлений, 23.10.2026); расчёт не хранится (§33.4) */
export function PayrollBoard({
  scopeKey,
  write,
  payroll,
  basis = 'orders',
}: {
  scopeKey: string;
  write: boolean;
  payroll: PayrollView;
  basis?: PayBasis;
}) {
  const t = useT();
  const router = useRouter();
  const [settings, setSettings] = useState<PayrollRow | null>(null);
  const [adjust, setAdjust] = useState<PayrollRow | null>(null);
  const [payout, setPayout] = useState<PayrollRow | null>(null);
  const names = new Map(payroll.rows.map((r) => [r.employeeId, r.name]));
  const remaining = payroll.rows.reduce((sum, r) => sum + BigInt(r.remainingMinor), 0n).toString();
  const money = (minor: string) => formatMoney(minor, payroll.currency);
  const staffTable = payroll.rows.length === 0 ? (
    <EmptyState title={t('Сотрудников пока нет')} />
  ) : (
    <Table>
      <thead>
        <tr>
          {[msg('Сотрудник'), msg('Модель'), msg('Ставка'), BASIS[basis].column, msg('Премии'), msg('Удержания'), msg('Начислено'), msg('Выплачено'), msg('Осталось')].map(
            (h) => (
              <th key={h}>{t(h)}</th>
            ),
          )}
          <th>
            <span className="sr-only">{t('Действия')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {payroll.rows.map((r) => (
          <tr key={r.employeeId}>
            <td>{r.name}</td>
            <td className="rest-pay-model">
              {modelLabel(t, r.model, basis)}
              {r.percent > 0 && <small>{t(BASIS[basis].rate, { n: r.percent })}</small>}
            </td>
            <td>{formatMoney(r.fixedMinor, payroll.currency)}</td>
            <td>{formatMoney(r.salesMinor, payroll.currency)}</td>
            <td>{formatMoney(r.bonusMinor, payroll.currency)}</td>
            <td>{formatMoney(r.penaltyMinor, payroll.currency)}</td>
            <td>
              <strong>{formatMoney(r.totalMinor, payroll.currency)}</strong>
            </td>
            <td>{formatMoney(r.paidMinor, payroll.currency)}</td>
            <td data-testid="payroll-remaining">{formatMoney(r.remainingMinor, payroll.currency)}</td>
            <td>
              {/* одна главная кнопка, остальное в меню (аудит 21.10.2026, п. 42) */}
              {write && (
                <span className="food-inline-actions">
                  {BigInt(r.remainingMinor) > 0n && (
                    <Button size="sm" onClick={() => setPayout(r)}>
                      {t('Выплатить')}
                    </Button>
                  )}
                  <ActionMenu
                    size="sm"
                    label={t('Ещё: {name}', { name: r.name })}
                    items={[
                      { label: t('Условия оплаты'), onSelect: () => setSettings(r) },
                      { label: t('Премия или удержание'), onSelect: () => setAdjust(r) },
                    ]}
                  />
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      {/* итоги месяца строкой под таблицей вместо плиток над ней (аудит 21.10.2026, п. 29) */}
      <tfoot>
        <tr>
          <th scope="row">{t('Итого')}</th>
          <td colSpan={3} data-testid="payroll-fund">
            {t('Фонд оплаты {sum}', { sum: money(payroll.totals.fundMinor) })}
          </td>
          <td data-testid="payroll-bonus">{money(payroll.totals.bonusMinor)}</td>
          <td data-testid="payroll-penalty">{money(payroll.totals.penaltyMinor)}</td>
          <td data-testid="payroll-total">
            <strong>{money(payroll.totals.payoutMinor)}</strong>
          </td>
          <td data-testid="payroll-paid">{money(payroll.totals.paidMinor)}</td>
          <td>{money(remaining)}</td>
          <td />
        </tr>
      </tfoot>
    </Table>
  );
  const adjustments =
    payroll.adjustments.length === 0 ? (
      <EmptyState title={t('Начислений в этом месяце нет')} />
    ) : (
      <Table>
        <thead>
          <tr>
            {[msg('Сотрудник'), msg('Сумма'), msg('Причина')].map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payroll.adjustments.map((a) => (
            <tr key={a.id}>
              <td>{names.get(a.employeeId) ?? '—'}</td>
              <td>{formatMoney(a.amountMinor, payroll.currency)}</td>
              <td>{a.reason}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <div className="food-workspace" data-testid="payroll-board">
      <div className="food-toolbar">
        <Field label={t('Месяц')}>
          {/* «октябрь 2026» по-русски поверх родного поля: браузер писал «October 2026» (аудит 21.10.2026, п. 4) */}
          <MonthInput
            value={payroll.month}
            onChange={(e) => {
              if (e.target.value) router.push(`/payroll?month=${e.target.value}`);
            }}
          />
        </Field>
      </div>
      <Tabs
        label={t('Зарплата')}
        panels={[
          { id: 'staff', label: t('Сотрудники'), content: staffTable },
          { id: 'adjustments', label: t('Начисления'), content: adjustments },
        ]}
      />
      {settings && <PayDrawer scopeKey={scopeKey} row={settings} basis={basis} currency={payroll.currency} close={() => setSettings(null)} />}
      {payout && (
        <PayoutDrawer
          scopeKey={scopeKey}
          month={payroll.month}
          currency={payroll.currency}
          row={payout}
          close={() => setPayout(null)}
        />
      )}
      {adjust && (
        <AdjustmentDrawer
          scopeKey={scopeKey}
          month={payroll.month}
          currency={payroll.currency}
          row={adjust}
          close={() => setAdjust(null)}
        />
      )}
    </div>
  );
}
