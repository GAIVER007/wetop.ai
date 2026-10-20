import Link from 'next/link';
import { Icon, type IconName } from '../../components/icon';
import { Stat } from '../../components/ui';
import { LineChart } from '../../components/line-chart';
import { DonutShare } from '../../components/donut-share';
import { ShareBar } from '../../components/share-bar';
import type { PeriodOperations, PeriodReport } from '../../lib/api';
import { deltaPercent, type Delta } from '../../lib/dashboard-format';
import { formatMoney } from '../../lib/money';

/**
 * «Финансы» по эталону владельца 13.10.2026 (`design/references/03_finance_analytics/finance_owner_2026-10-13.webp`,
 * DESIGN.md §21): четыре плитки денег со сравнением и линией по дням, динамика доходов и расходов, структура
 * доходов, расходы по категориям, отчёты и переход в аналитику. Все числа из тех же ответов API, что раньше
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

/** Линия по дням в плитке: только рисунок, смысл держит число плитки (скрыт от программы чтения) */
function Spark({ values, tone }: { values: number[]; tone: 'primary' | 'success' | 'danger' | 'violet' }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(2)},${(28 - ((v - min) / span) * 24).toFixed(2)}`)
    .join(' ');
  return (
    <svg className={`fin-spark fin-spark--${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={points} />
    </svg>
  );
}

function delta(current: bigint | null, previous: bigint | null): Delta | undefined {
  if (current === null || previous === null || previous === 0n) return undefined;
  const d = deltaPercent(current, previous);
  return { ...d, text: `${d.text} к прошлому периоду` };
}

export function FinanceKpis({
  charged,
  prevCharged,
  income,
  prevIncome,
  expense,
  prevExpense,
  profit,
  prevProfit,
  currency,
  flow,
}: {
  charged: bigint | null;
  prevCharged: bigint | null;
  income: bigint | null;
  prevIncome: bigint | null;
  expense: bigint | null;
  prevExpense: bigint | null;
  profit: bigint | null;
  prevProfit: bigint | null;
  currency: string;
  flow: DayFlow[];
}) {
  const money = (v: bigint | null) => (v === null ? '–' : formatMoney(v.toString(), currency));
  const tile = (
    id: string,
    label: string,
    icon: IconName,
    tone: 'info' | 'success' | 'danger' | 'neutral',
    value: bigint | null,
    prev: bigint | null,
    spark: number[],
    sparkTone: 'primary' | 'success' | 'danger' | 'violet',
  ) => {
    const d = delta(value, prev);
    return (
      <div className="fin-kpi" key={id}>
        <Stat
          icon={<Icon name={icon} />}
          tone={tone}
          label={label}
          value={money(value)}
          testId={`fin-${id}`}
          {...(d ? { delta: d } : { hint: 'нет базы для сравнения' })}
        />
        <Spark values={spark} tone={sparkTone} />
      </div>
    );
  };
  const inc = flow.map((d) => Number(d.income));
  const exp = flow.map((d) => Number(d.expense));
  const cashExp = flow.map((d) => Number(d.cashExpense));
  return (
    <section className="fin-kpis" aria-label="Деньги за период">
      {tile('charged', 'Общий доход', 'receipt', 'info', charged, prevCharged, [], 'primary')}
      {tile('income', 'Поступления', 'money', 'success', income, prevIncome, inc, 'success')}
      {tile('expense', 'Расходы', 'coins', 'danger', expense, prevExpense, cashExp, 'danger')}
      {tile(
        'profit',
        'Чистая прибыль',
        'chart',
        'neutral',
        profit,
        prevProfit,
        inc.map((v, i) => v - (exp[i] ?? 0)),
        'violet',
      )}
    </section>
  );
}

const SHORT_DAY = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function FinanceDynamics({ flow, currency }: { flow: DayFlow[]; currency: string }) {
  const labels = flow.map((d) => SHORT_DAY.format(new Date(`${d.date}T00:00:00Z`)));
  const sum = (key: 'income' | 'expense') => flow.reduce((a, d) => a + d[key], 0n).toString();
  return (
    <section className="fin-card fin-dynamics" aria-labelledby="fin-dynamics-title">
      <h2 id="fin-dynamics-title">Динамика поступлений, возвратов и расходов</h2>
      <LineChart
        testId="fin-dynamics"
        labels={labels}
        format={(v) => formatMoney(String(Math.round(v)), currency)}
        series={[
          {
            name: 'Поступления',
            values: flow.map((d) => Number(d.income)),
            summary: formatMoney(sum('income'), currency),
          },
          {
            name: 'Возвраты и расходы',
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
}: {
  report: PeriodReport | null;
  kindLabel: (kind: string) => string;
}) {
  const currency = report?.currency ?? 'KZT';
  const items = (report?.chargesByKind ?? []).map((k) => ({ label: kindLabel(k.kind), valueMinor: k.amountMinor }));
  return (
    <section className="fin-card fin-structure" aria-labelledby="fin-structure-title">
      <h2 id="fin-structure-title">Структура доходов</h2>
      {items.some((i) => BigInt(i.valueMinor) > 0n) ? (
        <DonutShare
          testId="fin-structure"
          items={items}
          centerLabel="Общий доход"
          centerValue={formatMoney(report?.chargedMinor ?? '0', currency)}
          amount={(v) => formatMoney(v, currency)}
        />
      ) : (
        <p className="muted">За период начислений нет.</p>
      )}
    </section>
  );
}

export function ExpenseCategories({
  ops,
  allHref,
}: {
  ops: PeriodOperations | null;
  allHref: string;
}) {
  const currency = ops?.currency ?? 'KZT';
  const byCategory = new Map<string, bigint>();
  for (const row of ops?.rows ?? []) {
    if (row.kind !== 'EXPENSE' || row.status !== 'COMPLETED') continue;
    const key = row.category ?? 'Прочие';
    byCategory.set(key, (byCategory.get(key) ?? 0n) + BigInt(row.amountMinor));
  }
  const rows = [...byCategory.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1));
  const total = rows.reduce((a, [, v]) => a + v, 0n);
  return (
    <section className="fin-card fin-expenses" aria-labelledby="fin-expenses-title">
      <header className="fin-card__head">
        <h2 id="fin-expenses-title">Расходы по категориям</h2>
        <Link href={allHref}>
          Все расходы <Icon name="arrow" />
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="muted">Расходов за период нет.</p>
      ) : (
        <ul className="fin-expenses__list">
          {rows.slice(0, 5).map(([name, value]) => {
            const share = total > 0n ? Number((value * 1000n) / total) / 10 : 0;
            return (
              <li key={name}>
                <span className="fin-expenses__name">{name}</span>
                <strong>{formatMoney(value.toString(), currency)}</strong>
                <span className="muted">{Math.round(share)}%</span>
                <ShareBar label={`${name}: доля расходов`} value={share} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function FinanceReports({ exportHref, from, to }: { exportHref: string; from: string; to: string }) {
  const range = `from=${from}&to=${to}`;
  const items: Array<{ href: string; title: string; action: string }> = [
    { href: `/reports/finance?${range}`, title: 'Финансовый отчёт за период', action: 'Открыть' },
    { href: exportHref, title: 'Движение денежных средств', action: 'Скачать CSV' },
    { href: `/reports/overview?${range}`, title: 'Сводный отчёт', action: 'Открыть' },
  ];
  return (
    <section className="fin-card fin-reports" aria-labelledby="fin-reports-title">
      <h2 id="fin-reports-title">Финансовые отчёты</h2>
      <ul>
        {items.map((i) => (
          <li key={i.title}>
            <Link href={i.href}>
              <Icon name="receipt" />
              <span>
                {i.title}
                <small>{i.action}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnalyticsCta() {
  return (
    <section className="fin-card fin-cta" aria-labelledby="fin-cta-title">
      <Icon name="chart" className="fin-cta__icon" />
      <div>
        <h2 id="fin-cta-title">Аналитика и прогнозы</h2>
        <p>Загрузка, выручка, брони и каналы за период со сравнением и прогнозом загрузки.</p>
        <Link className="btn" href="/management/analytics">
          Перейти к аналитике <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}
