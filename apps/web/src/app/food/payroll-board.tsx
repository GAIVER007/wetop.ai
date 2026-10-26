'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import {
  Alert,
  Badge,
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
  orders: {
    percent: msg('Процент от заказов'),
    rate: msg('{n} % от заказов'),
    column: msg('% с заказов'),
    only: msg('Доля от закрытых заказов сотрудника'),
    plus: msg('Оклад плюс доля от заказов'),
    hint: msg('От суммы закрытых заказов сотрудника за месяц, от 1 до 100'),
    example: msg('{percent} % от заказов на {sales}'),
  },
  visits: {
    percent: msg('Процент от записей'),
    rate: msg('{n} % от записей'),
    column: msg('% с записей'),
    only: msg('Доля от выполненных записей специалиста'),
    plus: msg('Оклад плюс доля от записей'),
    hint: msg('От суммы выполненных записей специалиста за месяц, от 1 до 100'),
    example: msg('{percent} % от записей на {sales}'),
  },
} as const;

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

/** Способы оплаты в окне (владелец 25.10.2026): три понятных, премии и удержания отдельной кнопкой, не способ оплаты */
export const PAY_CHOICES = ['FIXED', 'PERCENT', 'FIXED_PLUS_PERCENT'] as const satisfies readonly PayModel[];
export type PayChoice = (typeof PAY_CHOICES)[number];
const CHOICE = {
  FIXED: { title: msg('Только оклад'), note: msg('Одна сумма каждый месяц') },
  PERCENT: { title: msg('Только процент'), note: null },
  FIXED_PLUS_PERCENT: { title: msg('Оклад + процент'), note: null },
} as const;
/** Какие поля нужны способу: только оклад, только процент, оба */
export const payFields = (model: PayChoice) => ({
  fixed: model === 'FIXED' || model === 'FIXED_PLUS_PERCENT',
  percent: model === 'PERCENT' || model === 'FIXED_PLUS_PERCENT',
});
/** Прежняя «только премии» открывается как «Только оклад»: способа без оплаты в окне нет */
export const payChoiceOf = (model: PayModel): PayChoice => (model === 'BONUS_ONLY' ? 'FIXED' : model);

/**
 * Что уйдёт на сервер из окна оплаты: поля только выбранного способа, у остальных ноль. Пустое или нулевое поле
 * выбранного способа это ошибка с понятной фразой, а не молча сохранённый ноль.
 */
export function paySettingsBody(
  model: PayChoice,
  fixed: string,
  percent: string,
  currency: string,
  t: Translate = translator('ru'),
): { model: PayChoice; fixedMinor: number; percent: number } {
  const need = payFields(model);
  const fixedMinor = need.fixed ? payrollPositiveInputToMinor(fixed, currency, t) : 0;
  let pct = 0;
  if (need.percent) {
    pct = Number(percent.trim().replace(',', '.'));
    if (!percent.trim() || !Number.isInteger(pct) || pct < 1 || pct > 100)
      throw new Error(t('Процент: целое число от 1 до 100'));
  }
  return { model, fixedMinor, percent: pct };
}

function PayDrawer({
  scopeKey,
  row,
  basis,
  currency,
  month,
  close,
}: {
  scopeKey: string;
  row: PayrollRow;
  basis: PayBasis;
  currency: string;
  month: string;
  close: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [model, setModel] = useState<PayChoice>(payChoiceOf(row.model));
  const [fixed, setFixed] = useState(BigInt(row.fixedMinor) > 0n ? payrollMinorToInput(row.fixedMinor) : '');
  const [percent, setPercent] = useState(row.percent > 0 ? String(row.percent) : '');
  const need = payFields(model);
  const sales = BigInt(row.salesMinor);
  const fixedMinor = (() => {
    const v = inputToMinor(fixed);
    return need.fixed && v ? BigInt(v) : 0n;
  })();
  const pct = need.percent && /^\d{1,3}$/.test(percent.trim()) ? Math.min(100, Number(percent)) : 0;
  const percentPart = (sales * BigInt(pct) + 50n) / 100n;
  const money = (minor: bigint | string) => formatMoney(minor, currency);
  function submit() {
    setError('');
    let body: ReturnType<typeof paySettingsBody>;
    try {
      body = paySettingsBody(model, fixed, percent, currency, t);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Некорректная сумма'));
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, { kind: 'pay-settings', id: row.employeeId, body });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={t('Оплата: {name}', { name: row.name })} drawer className="food-drawer pay-drawer" trapFocus>
      <div className="food-form pay-form" data-testid="pay-settings">
        {error && <Alert>{error}</Alert>}
        <fieldset className="pay-choices">
          <legend>{t('Как платим')}</legend>
          {PAY_CHOICES.map((value) => (
            <label key={value} className="pay-choice">
              <input type="radio" name="pay-model" value={value} checked={model === value} onChange={() => setModel(value)} />
              <span className="pay-choice__title">{t(CHOICE[value].title)}</span>
              <span className="pay-choice__note">
                {CHOICE[value].note ? t(CHOICE[value].note) : t(value === 'PERCENT' ? BASIS[basis].only : BASIS[basis].plus)}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="food-form-row">
          {need.fixed && (
            <Field
              label={t('Оклад за месяц, {currency}', { currency: currencyLabel(currency) })}
              controlId={`pay-fixed-${row.employeeId}`}
              hint={t('Платится каждый месяц, даже без продаж')}
            >
              <Input id={`pay-fixed-${row.employeeId}`} type="number" inputMode="decimal" min={0.01} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </Field>
          )}
          {need.percent && (
            <Field label={t(BASIS[basis].percent)} controlId={`pay-percent-${row.employeeId}`} hint={t(BASIS[basis].hint)}>
              <Input id={`pay-percent-${row.employeeId}`} type="number" inputMode="numeric" min={1} max={100} step={1} value={percent} onChange={(e) => setPercent(e.target.value)} />
            </Field>
          )}
        </div>
        <p className="pay-example" data-testid="pay-example">
          {t('Расчёт за {month}:', { month: monthName(month, t) })}{' '}
          {need.fixed && <span>{t('оклад {sum}', { sum: money(fixedMinor) })}</span>}
          {need.fixed && need.percent && ' + '}
          {need.percent && (
            <span>
              {t(BASIS[basis].example, { percent: pct, sales: money(sales) })} = {money(percentPart)}
            </span>
          )}
          {' = '}
          <strong>{money(fixedMinor + percentPart)}</strong>
        </p>
        <p className="hint">{t('Премии и удержания добавляются отдельно: «Ещё» → «Премия или удержание».')}</p>
        <div className="food-actions pay-form__actions">
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
          <Button disabled={pending} onClick={submit}>
            {t('Сохранить')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

const MONTHS = [
  msg('январь'), msg('февраль'), msg('март'), msg('апрель'), msg('май'), msg('июнь'),
  msg('июль'), msg('август'), msg('сентябрь'), msg('октябрь'), msg('ноябрь'), msg('декабрь'),
];
/** «2026-10» → «октябрь 2026» */
export function monthName(month: string, t: Translate = translator('ru')): string {
  const [y, m] = month.split('-');
  const name = MONTHS[Number(m) - 1];
  return name ? `${t(name)} ${y}` : month;
}
/** Соседний месяц: «2026-10», -1 → «2026-09» */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Месяц зарплаты в строке заголовка (вариант A, 25.10.2026): стрелки и поле месяца, одна строка без подписи сверху */
export function PayrollMonthNav({ month }: { month: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <span className="payroll-month">
      <Button tone="secondary" size="sm" aria-label={t('Прошлый месяц')} onClick={() => router.push(`/payroll?month=${shiftMonth(month, -1)}`)}>
        <span aria-hidden="true">‹</span>
      </Button>
      <MonthInput
        aria-label={t('Месяц')}
        value={month}
        onChange={(e) => {
          if (e.target.value) router.push(`/payroll?month=${e.target.value}`);
        }}
      />
      <Button tone="secondary" size="sm" aria-label={t('Следующий месяц')} onClick={() => router.push(`/payroll?month=${shiftMonth(month, 1)}`)}>
        <span aria-hidden="true">›</span>
      </Button>
    </span>
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

/** Оплата сотрудника не задана: ни оклада, ни процента (новый сотрудник или прежняя «только премии») */
export const payUnset = (r: Pick<PayrollRow, 'fixedMinor' | 'percent'>) => BigInt(r.fixedMinor) === 0n && r.percent === 0;

/** «3 000 QAR + 30 %», «40 % от записей», «Оклад 3 000 QAR» */
function payTerms(t: Translate, r: PayrollRow, basis: PayBasis, currency: string): string {
  const fixed = formatMoney(r.fixedMinor, currency);
  if (r.model === 'FIXED_PLUS_PERCENT') return t('{fixed} + {n} %', { fixed, n: r.percent });
  if (r.model === 'PERCENT') return t(BASIS[basis].rate, { n: r.percent });
  return t('Оклад {fixed}', { fixed });
}

/**
 * «Зарплата» салона и ресторана, вариант A владельца 25.10.2026: месяц в строке заголовка, четыре итога месяца
 * строкой, плотная таблица (как платим, оклад, процент, премии, удержания, начислено, выплачено, осталось), ноль
 * прочерком, итог внизу. Одна главная кнопка в строке: «Выплатить» или «Настроить», остальное в меню. Расчёт не
 * хранится (§33.4).
 */
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
  const [settings, setSettings] = useState<PayrollRow | null>(null);
  const [adjust, setAdjust] = useState<PayrollRow | null>(null);
  const [payout, setPayout] = useState<PayrollRow | null>(null);
  const names = new Map(payroll.rows.map((r) => [r.employeeId, r.name]));
  const remaining = payroll.rows.reduce((sum, r) => sum + BigInt(r.remainingMinor), 0n).toString();
  const unset = payroll.rows.filter(payUnset).length;
  const money = (minor: string) => formatMoney(minor, payroll.currency);
  const cell = (minor: string) => (BigInt(minor) === 0n ? <span className="muted">—</span> : money(minor));
  const totals = (
    <dl className="payroll-totals" data-testid="payroll-totals">
      <div>
        <dt>{t('Начислено')}</dt>
        <dd data-testid="payroll-sum-total">{money(payroll.totals.payoutMinor)}</dd>
      </div>
      <div>
        <dt>{t('Выплачено')}</dt>
        <dd data-testid="payroll-sum-paid">{money(payroll.totals.paidMinor)}</dd>
      </div>
      <div>
        <dt>{t('Осталось выплатить')}</dt>
        <dd className={BigInt(remaining) > 0n ? 'payroll-totals__due' : undefined} data-testid="payroll-due">
          {money(remaining)}
        </dd>
      </div>
      <div>
        <dt>{t('Без настройки оплаты')}</dt>
        <dd className={unset > 0 ? 'payroll-totals__warn' : undefined} data-testid="payroll-unset">
          {unset}
        </dd>
      </div>
    </dl>
  );
  const staffTable = payroll.rows.length === 0 ? (
    <EmptyState title={t('Сотрудников пока нет')} />
  ) : (
    <Table className="payroll-table">
      <thead>
        <tr>
          <th>{t('Сотрудник')}</th>
          <th>{t('Как платим')}</th>
          <th className="num">{t('Оклад')}</th>
          <th className="num">{t(BASIS[basis].column)}</th>
          {[msg('Премии'), msg('Удержания'), msg('Начислено'), msg('Выплачено'), msg('Осталось')].map((h) => (
            <th key={h} className="num">
              {t(h)}
            </th>
          ))}
          <th>
            <span className="sr-only">{t('Действия')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {payroll.rows.map((r) => {
          const due = BigInt(r.remainingMinor) > 0n;
          const blank = payUnset(r);
          return (
            <tr key={r.employeeId}>
              <th scope="row">{r.name}</th>
              <td className="rest-pay-model">
                {blank ? <Badge tone="warn">{t('Не настроено')}</Badge> : payTerms(t, r, basis, payroll.currency)}
              </td>
              <td className="num">{cell(r.baseMinor)}</td>
              <td className="num">
                {cell(r.percentMinor)}
              </td>
              <td className="num payroll-plus">{cell(r.bonusMinor)}</td>
              <td className="num payroll-minus">{cell(r.penaltyMinor)}</td>
              <td className="num">
                <strong>{cell(r.totalMinor)}</strong>
              </td>
              <td className="num">{cell(r.paidMinor)}</td>
              <td className="num" data-testid="payroll-remaining">
                {due ? <strong className="payroll-due">{money(r.remainingMinor)}</strong> : BigInt(r.totalMinor) > 0n ? <span className="payroll-done">{money(r.remainingMinor)}</span> : <span className="muted">—</span>}
              </td>
              <td>
                {/* одна главная кнопка, остальное в меню (аудит 21.10.2026, п. 42) */}
                {write && (
                  <span className="food-inline-actions">
                    {due ? (
                      <Button size="sm" onClick={() => setPayout(r)}>
                        {t('Выплатить')}
                      </Button>
                    ) : blank ? (
                      <Button size="sm" tone="secondary" onClick={() => setSettings(r)}>
                        {t('Настроить')}
                      </Button>
                    ) : null}
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
          );
        })}
      </tbody>
      {/* итоги месяца строкой под таблицей (аудит 21.10.2026, п. 29) */}
      <tfoot>
        <tr>
          <th scope="row">{t('Итого')}</th>
          <td colSpan={3} data-testid="payroll-fund">
            {t('Фонд оплаты {sum}', { sum: money(payroll.totals.fundMinor) })}
          </td>
          <td className="num" data-testid="payroll-bonus">{money(payroll.totals.bonusMinor)}</td>
          <td className="num" data-testid="payroll-penalty">{money(payroll.totals.penaltyMinor)}</td>
          <td className="num" data-testid="payroll-total">
            <strong>{money(payroll.totals.payoutMinor)}</strong>
          </td>
          <td className="num" data-testid="payroll-paid">{money(payroll.totals.paidMinor)}</td>
          <td className="num">{money(remaining)}</td>
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
    <div className="food-workspace payroll-workspace" data-testid="payroll-board">
      {totals}
      <Tabs
        label={t('Зарплата')}
        panels={[
          { id: 'staff', label: t('Сотрудники'), content: staffTable },
          { id: 'adjustments', label: t('Начисления'), content: adjustments },
        ]}
      />
      {settings && (
        <PayDrawer
          scopeKey={scopeKey}
          row={settings}
          basis={basis}
          currency={payroll.currency}
          month={payroll.month}
          close={() => setSettings(null)}
        />
      )}
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
