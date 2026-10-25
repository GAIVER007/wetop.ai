import Link from 'next/link';
import { Icon } from '../../components/icon';
import { EmptyState } from '../../components/ui';
import { LineChart } from '../../components/line-chart';
import { DonutShare } from '../../components/donut-share';
import { ShareBar } from '../../components/share-bar';
import type { PeriodOperations, PeriodReport } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { msg, translator, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';

const RU = translator('ru');

/**
 * «Финансы» по эталону владельца 13.10.2026 (`design/references/03_finance_analytics/finance_owner_2026-10-13.webp`,
 * DESIGN.md §21), без плиток (аудит 22.10.2026 P1-3b): итоги одной строкой, динамика доходов и расходов, структура
 * доходов, расходы по категориям, отчёты и переход в аналитику; пустой период: одна заглушка с первым шагом. Все числа из тех же ответов API, что раньше
 * («Начислено», кассовые поступления, возвраты и расходы); макетные суммы не переносятся.
 */

export interface DayFlow {
  date: string;
  income: bigint;
  /** Combined cash outflow: refunds plus cash expenses, not the expenses KPI. */
  expense: bigint;
  cashExpense: bigint;
}

/** Деньги по дням из ленты операций: проведённые оплаты и поступления против возвратов и расходов */
export function dailyFlow(rows: PeriodOperations['rows'], from: string, to: string): DayFlow[] {
  const days = new Map<string, { income: bigint; expense: bigint; cashExpense: bigint }>();
  for (let d = from; d <= to; d = nextDay(d)) {
    days.set(d, { income: 0n, expense: 0n, cashExpense: 0n });
  }
  for (const row of rows) {
    if (row.status !== 'COMPLETED' || row.kind === 'TRANSFER') continue;
    const day = days.get(row.localAt.slice(0, 10));
    if (!day) continue;
    if (row.kind === 'PAYMENT' || row.kind === 'INCOME') day.income += BigInt(row.amountMinor);
    else {
      day.expense += BigInt(row.amountMinor);
      if (row.kind === 'EXPENSE') day.cashExpense += BigInt(row.amountMinor);
    }
  }
  return [...days.entries()].map(([date, v]) => ({ date, ...v }));
}
const nextDay = (date: string) => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);

/** Итоги периода одной строкой (`money-summary`, как у салона и в «Кассе»): правило владельца «без плиток»,
 * аудит 22.10.2026 P1-3b. Метки прежних плиток и «Финансового обзора» сохранены на значениях. Возвраты отдельной
 * строкой (ADR-176); прибыль только когда известны все её части. */
export function FinanceTotals({
  charged,
  income,
  refunds,
  expense,
  balance,
  currency,
  t = RU,
}: {
  /** перевод подписей; по умолчанию русский (тесты рендерят без запроса) */
  t?: Translate;
  charged: bigint | null;
  income: bigint | null;
  refunds: bigint | null;
  expense: bigint | null;
  /** остаток на счетах за всё время, тиыны строкой; `null`: касса не загрузилась */
  balance: string | null;
  currency: string;
}) {
  const money = (v: bigint | null) =>
    v === null ? t('Нет данных') : formatMoney(v.toString(), currency);
  const profit =
    income !== null && refunds !== null && expense !== null ? income - refunds - expense : null;
  const item = (id: string, label: string, value: string) => (
    <div key={id}>
      <dt>{label}</dt>
      <dd data-testid={id}>{value}</dd>
    </div>
  );
  return (
    <dl className="money-summary" data-testid="cash-summary" aria-label={t('Деньги за период')}>
      {item('fin-charged', t('Общий доход'), money(charged))}
      {item('cash-period-income', t('Поступления'), money(income))}
      {item('cash-period-refunds', t('Возвраты'), money(refunds))}
      {item('cash-period-expense', t('Расходы'), money(expense))}
      {profit !== null && item('fin-profit', t('Чистая прибыль'), money(profit))}
      {balance !== null &&
        item('cash-balance', t('Остаток на счетах'), formatMoney(balance, currency))}
    </dl>
  );
}

/** «Начислено / Оплачено / Возвращено / К сбору» вкладки «Обзор» одной строкой вместо второго ряда плиток
 * (аудит 22.10.2026 P1-3b). Каждая сумма по-прежнему ведёт к строкам, из которых сложилась (drill-down F2). */
export function FinanceAccrualTotals({
  report,
  currency,
  due,
  dueFailed,
  hrefs,
  t = RU,
}: {
  /** перевод подписей; по умолчанию русский (тесты рендерят без запроса) */
  t?: Translate;

  report: Pick<PeriodReport, 'chargedMinor' | 'paidMinor' | 'refundedMinor'>;
  currency: string;
  /** «К сбору» из списка долгов (Q-206); `null`: список не загрузился */
  due: string | null;
  dueFailed: boolean;
  hrefs: { charged: string; paid: string; refunded: string; due: string };
}) {
  const item = (id: string, testId: string, label: string, href: string, value: string) => (
    <div key={id}>
      <dt>{label}</dt>
      <dd>
        <a href={href} className="fin-accrual-link" data-testid={`kpi-${id}`}>
          <span data-testid={testId}>{value}</span>
        </a>
      </dd>
    </div>
  );
  return (
    <dl className="money-summary" data-testid="finance-kpis" aria-label={t('Итоги периода')}>
      {item('charged', 'charged', t('Начислено'), hrefs.charged, formatMoney(report.chargedMinor, currency))}
      {item('paid', 'paid', t('Оплачено'), hrefs.paid, formatMoney(report.paidMinor, currency))}
      {item('refunded', 'refunded', t('Возвращено'), hrefs.refunded, formatMoney(report.refundedMinor, currency))}
      {item(
        'due',
        'balance',
        t('К сбору'),
        hrefs.due,
        due === null ? (dueFailed ? t('Список долгов не загрузился') : t('Нет данных')) : formatMoney(due, currency),
      )}
    </dl>
  );
}

/** Месяц без единой брони, оплаты, расхода и долга. Не загрузилось: не «пусто», ошибку видно отдельно */
export function financeMonthEmpty({
  report,
  ops,
  debts,
}: {
  report: Pick<PeriodReport, 'chargedMinor' | 'paidMinor' | 'refundedMinor'> | null;
  ops: Pick<
    PeriodOperations,
    'rows' | 'paidMinor' | 'incomeMinor' | 'refundedMinor' | 'expenseMinor'
  > | null;
  debts: { count: number } | null;
}): boolean {
  if (!report || !ops) return false;
  const zero = (v: string) => BigInt(v) === 0n;
  return (
    zero(report.chargedMinor) &&
    zero(report.paidMinor) &&
    zero(report.refundedMinor) &&
    ops.rows.length === 0 &&
    zero(ops.paidMinor) &&
    zero(ops.incomeMinor) &&
    zero(ops.refundedMinor) &&
    zero(ops.expenseMinor) &&
    (debts?.count ?? 0) === 0
  );
}

/** Пустой месяц: одна заглушка с первым шагом вместо нулевых итогов, графика и таблиц (аудит 22.10.2026 P1-3b) */
export function FinanceEmptyMonth({ t = RU }: { t?: Translate } = {}) {
  return (
    <EmptyState
      className="fin-month-empty"
      data-testid="finance-empty"
      title={t('За этот период денег ещё не было')}
      actions={
        <Link className="btn" href="/reservations/new">
          {t('Добавить первую бронь')}
        </Link>
      }
    >
      {t('Здесь появятся доходы, оплаты и расходы, когда пройдёт первая бронь или операция кассы.')}
    </EmptyState>
  );
}

export function FinanceDynamics({
  flow,
  currency,
  t = RU,
  locale = 'ru-RU',
}: {
  flow: DayFlow[];
  currency: string;
  t?: Translate;
  locale?: 'ru-RU' | 'kk-KZ';
}) {
  const shortDay = dateFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const labels = flow.map((d) => shortDay.format(new Date(`${d.date}T00:00:00Z`)));
  const sum = (key: 'income' | 'expense') => flow.reduce((a, d) => a + d[key], 0n).toString();
  return (
    <section className="fin-card fin-dynamics" aria-labelledby="fin-dynamics-title">
      <h2 id="fin-dynamics-title">{t('Динамика поступлений, возвратов и расходов')}</h2>
      <LineChart
        testId="fin-dynamics"
        labels={labels}
        format={(v) => formatMoney(String(Math.round(v)), currency)}
        // ось в целых тенге: шкала пустого периода (0..1 тиын) печатала «0,01 ₸» (аудит 22.10.2026 P1-3b)
        formatAxis={(v) => formatMoney(String(Math.round(v / 100) * 100), currency)}
        series={[
          {
            name: t('Поступления'),
            values: flow.map((d) => Number(d.income)),
            summary: formatMoney(sum('income'), currency),
          },
          {
            name: t('Возвраты и расходы'),
            values: flow.map((d) => Number(d.expense)),
            dashed: true,
            summary: formatMoney(sum('expense'), currency),
          },
        ]}
      />
    </section>
  );
}

export function IncomeStructure({
  report,
  kindLabel,
  t = RU,
}: {
  report: PeriodReport | null;
  kindLabel: (kind: string) => string;
  t?: Translate;
}) {
  const currency = report?.currency ?? 'KZT';
  const items = (report?.chargesByKind ?? []).map((k) => ({ label: kindLabel(k.kind), valueMinor: k.amountMinor }));
  return (
    <section className="fin-card fin-structure" aria-labelledby="fin-structure-title">
      <h2 id="fin-structure-title">{t('Структура доходов')}</h2>
      {items.some((i) => BigInt(i.valueMinor) > 0n) ? (
        <DonutShare
          testId="fin-structure"
          items={items}
          centerLabel={t('Общий доход')}
          centerValue={formatMoney(report?.chargedMinor ?? '0', currency)}
          amount={(v) => formatMoney(v, currency)}
        />
      ) : (
        <p className="muted">{t('За период начислений нет.')}</p>
      )}
    </section>
  );
}

export function ExpenseCategories({
  ops,
  allHref,
  t = RU,
}: {
  ops: PeriodOperations | null;
  allHref: string;
  t?: Translate;
}) {
  const currency = ops?.currency ?? 'KZT';
  const byCategory = new Map<string, bigint>();
  for (const row of ops?.rows ?? []) {
    if (row.kind !== 'EXPENSE' || row.status !== 'COMPLETED') continue;
    const key = row.category ?? t('Прочие');
    byCategory.set(key, (byCategory.get(key) ?? 0n) + BigInt(row.amountMinor));
  }
  const rows = [...byCategory.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1));
  const total = rows.reduce((a, [, v]) => a + v, 0n);
  return (
    <section className="fin-card fin-expenses" aria-labelledby="fin-expenses-title">
      <header className="fin-card__head">
        <h2 id="fin-expenses-title">{t('Расходы по категориям')}</h2>
        <Link href={allHref}>
          {t('Все расходы')} <Icon name="arrow" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="muted">{t('Расходов за период нет.')}</p>
      ) : (
        <ul className="fin-expenses__list">
          {rows.slice(0, 5).map(([name, value]) => {
            const share = total > 0n ? Number((value * 1000n) / total) / 10 : 0;
            return (
              <li key={name}>
                <span className="fin-expenses__name">{name}</span>
                <strong>{formatMoney(value.toString(), currency)}</strong>
                <span className="muted">{Math.round(share)}%</span>
                <ShareBar label={t('{name}: доля расходов', { name })} value={share} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function FinanceReports({
  exportHref,
  from,
  to,
  t = RU,
}: {
  exportHref: string;
  from: string;
  to: string;
  t?: Translate;
}) {
  const range = `from=${from}&to=${to}`;
  const items: Array<{ href: string; title: string; action: string }> = [
    { href: `/reports/finance?${range}`, title: msg('Финансовый отчёт за период'), action: msg('Открыть') },
    { href: exportHref, title: msg('Движение денежных средств'), action: msg('Скачать CSV') },
    { href: `/reports/overview?${range}`, title: msg('Сводный отчёт'), action: msg('Открыть') },
  ];
  return (
    <section className="fin-card fin-reports" aria-labelledby="fin-reports-title">
      <h2 id="fin-reports-title">{t('Финансовые отчёты')}</h2>
      <ul>
        {items.map((i) => (
          <li key={i.title}>
            {/* CSV не страница: предзагрузка /finance/export отдавала 400 и держала сеть занятой (аудит 22.10.2026) */}
            <Link href={i.href} prefetch={false}>
              <Icon name="receipt" />
              <span>
                {t(i.title)}
                <small>{t(i.action)}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnalyticsCta({ t = RU }: { t?: Translate } = {}) {
  return (
    <section className="fin-card fin-cta" aria-labelledby="fin-cta-title">
      <Icon name="chart" className="fin-cta__icon" />
      <div>
        <h2 id="fin-cta-title">{t('Аналитика и прогнозы')}</h2>
        <p>{t('Загрузка, выручка, брони и каналы за период со сравнением и прогнозом загрузки.')}</p>
        <Link className="btn" href="/management/analytics">
          {t('Перейти к аналитике')} <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}
