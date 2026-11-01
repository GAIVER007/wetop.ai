import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import type { PlatformExpenseCategory, PlatformMoney } from '../../../../lib/api';
import { currentLocale, serverT } from '../../../../i18n/server';
import { msg, type Translate } from '../../../../i18n';
import Link from 'next/link';
import { KpiStrip } from '../kpi-strip';
import { ExpensesTab } from './expenses-tab';
import { MonthPicker } from './month-picker';
import { NotReady, loadMoney } from '../load-money';
import { CabinetShell, dayText, usd } from '../shell';
import { ExpenseForm, PaymentForm, VoidButton } from '../money-forms';
import { CATEGORY_LABEL } from '../categories';
import { FormDialog } from '../form-dialog';
import { percentText } from '../growth-parts';
import { formatInt } from '../../../../lib/dashboard-format';
import { monthLabel } from '../../../branches/month-picker';

/** Вид «Б» (владелец 01.11.2026): вкладки Обзор, Поступления, Расходы (бывший раздел), По месяцам; полоса цифр сверху.
 * Деньги компании WETOP (DATA_MODEL §63; вид от 30.10.2026: кнопки записи в окне, таблица по месяцам, поступления и расходы рядом, ожидаем и просрочено): доход, расходы и прибыль месяца в долларах, оплаты и расходы списком */
export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  const tab: MoneyTab = TABS.find((x) => x.key === q['tab'])?.key ?? 'overview';
  const category = typeof q['category'] === 'string' ? q['category'] : '';
  return (
    <Page width="full" title={t('Деньги WETOP')}>
      <Suspense fallback={<LoadingState label={t('Считаем деньги…')} />}>
        <Money month={month} tab={tab} category={category} />
      </Suspense>
    </Page>
  );
}

type MoneyTab = 'overview' | 'in' | 'out' | 'months';
const TABS: Array<{ key: MoneyTab; label: string }> = [
  { key: 'overview', label: msg('Обзор') },
  { key: 'in', label: msg('Поступления') },
  { key: 'out', label: msg('Расходы') },
  { key: 'months', label: msg('По месяцам') },
];

async function Money({ month, tab, category }: { month: string; tab: MoneyTab; category: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  const { view, error } = await loadMoney(month, t);
  if (!view)
    return (
      <CabinetShell active="money" t={t}>
        {error}
      </CabinetShell>
    );
  if (!view.ready)
    return (
      <CabinetShell active="money" t={t}>
        <NotReady t={t} />
      </CabinetShell>
    );
  const today = new Date().toISOString().slice(0, 10);
  const sm = view.summary;
  const m = sm.month;
  const profitNegative = m.profitCents.startsWith('-');
  const shortMonth = (mm: string) => monthLabel(mm, locale).split(' ')[0]!.slice(0, 3);
  const income = BigInt(m.incomeCents);
  const margin = income > 0n ? Number((BigInt(m.profitCents) * 1000n) / income) : null;
  const href = (k: MoneyTab) => `/platform/cabinet/money?month=${month}${k === 'overview' ? '' : `&tab=${k}`}`;
  const live = view.payments.filter((p) => !p.voided);
  return (
    <CabinetShell active="money" t={t} clients={view.clients.length}>
      <div className="cabinet__head cabinet-money__head">
        <nav className="glass-tabs" aria-label={t('Разделы денег')}>
          {TABS.map((x) => (
            <Link key={x.key} href={href(x.key)} aria-current={x.key === tab ? 'page' : undefined} prefetch={false} data-testid={`money-tab-${x.key}`}>
              {t(x.label)}
            </Link>
          ))}
        </nav>
        <div className="cabinet-money__actions">
          <MonthPicker month={month} locale={locale} base={tab === 'overview' ? '/platform/cabinet/money' : `/platform/cabinet/money?tab=${tab}`} />
          <FormDialog label={t('+ Оплата')} title={t('Оплата клиента')} testId="money-payment-dialog">
            <PaymentForm clients={view.clients} today={today} />
          </FormDialog>
          <FormDialog label={t('− Расход')} title={t('Расход компании')} tone="secondary" testId="money-expense-dialog">
            <ExpenseForm categories={view.categories} today={today} />
          </FormDialog>
        </div>
      </div>
      {tab !== 'out' && (
        <KpiStrip
          testId="money-strip"
          items={[
            { id: 'income', label: t('Поступило'), value: usd(m.incomeCents), hint: t('оплат: {n}', { n: formatInt(live.length) }), tone: 'success' },
            { id: 'expenses', label: t('Расходы'), value: usd(m.expensesCents), hint: t('записей: {n}', { n: formatInt(view.expenses.filter((e) => !e.voided).length) }), tone: 'danger' },
            { id: 'profit', label: t('Прибыль'), value: usd(m.profitCents), hint: margin === null ? undefined : t('маржа {p}', { p: signedPercent(margin) }), tone: profitNegative ? 'danger' : undefined },
            { id: 'expected', label: t('Ожидаем в месяц'), value: usd(sm.expectedMonthlyCents), hint: t('по тарифам клиентов') },
          ]}
        />
      )}
      {tab === 'overview' && (
        <>
          {/* один экран 1440×900 (владелец 01.11.2026): поступления, статьи и просрочка в ряд, ниже ожидаем и месяцы */}
          <div className="cabinet-money__pair cabinet-money__pair--three">
            <Panel data-testid="money-payments">
              <div className="cabinet__panel-head">
                <b className="panel__title">{t('Последние поступления')}</b>
                <Link className="btn btn--secondary btn--sm" href={href('in')} prefetch={false}>
                  {t('Все')}
                </Link>
              </div>
              <PaymentsTable view={view} t={t} limit={5} />
            </Panel>
            <Panel data-testid="money-expense-list">
              <div className="cabinet__panel-head">
                <b className="panel__title">{t('Расходы по статьям')}</b>
                <Link className="btn btn--secondary btn--sm" href={href('out')} prefetch={false}>
                  {t('Все')}
                </Link>
              </div>
              <CategoryBars view={view} t={t} />
            </Panel>
            <Panel title={t('Просрочено')} data-testid="money-overdue">
              <DueTable rows={sm.overdue.map((o) => ({ ...o, late: true }))} empty={t('Просроченных оплат нет')} t={t} />
            </Panel>
          </div>
          <div className="cabinet-money__pair">
            <Panel title={t('Ожидаем оплату, 30 дней')} data-testid="money-upcoming">
              <DueTable rows={(sm.upcoming ?? []).map((u) => ({ ...u, late: false }))} empty={t('В ближайшие 30 дней оплат по тарифам нет')} t={t} />
            </Panel>
            {sm.table && (
              <Panel title={t('По месяцам')} data-testid="money-months">
                <MonthsShort table={sm.table} t={t} monthName={(mm) => monthLabel(mm, locale).split(' ')[0]!} />
              </Panel>
            )}
          </div>
        </>
      )}
      {tab === 'in' && (
        <Panel title={t('Поступления за месяц')} data-testid="money-payments">
          <PaymentsTable view={view} t={t} />
        </Panel>
      )}
      {tab === 'out' && <ExpensesTab view={view} month={month} category={category} t={t} />}
      {tab === 'months' && sm.table && (
        <Panel title={t('Доходы и расходы по месяцам')} data-testid="money-table">
          <MonthTable table={sm.table} t={t} monthName={shortMonth} />
        </Panel>
      )}
    </CabinetShell>
  );
}

/** «По месяцам» в обзоре: поступило, расходы, прибыль, маржа; свежий месяц сверху, пустые месяцы не показываем */
function MonthsShort({ table, t, monthName }: { table: NonNullable<Ready['summary']['table']>; t: Translate; monthName: (m: string) => string }) {
  const rows = table.months
    .map((mm, i) => {
      const out = table.categories.reduce((n, c) => n + BigInt(c.cents[i] ?? '0'), 0n);
      return { mm, income: table.income[i] ?? '0', out: String(out), profit: table.profit[i] ?? '0', margin: table.margin[i] ?? null };
    })
    .filter((r) => r.income !== '0' || r.out !== '0')
    .reverse();
  if (rows.length === 0) return <EmptyState title={t('Денег пока не было')} />;
  return (
    <Table aria-label={t('По месяцам')} className="cabinet__days">
      <thead>
        <tr>
          <th>{t('Месяц')}</th>
          <th className="num">{t('Поступило')}</th>
          <th className="num">{t('Расходы')}</th>
          <th className="num">{t('Прибыль')}</th>
          <th className="num">{t('Маржа')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.mm}>
            <td>{monthName(r.mm)}</td>
            <td className="num cabinet__plus">{usd(r.income)}</td>
            <td className="num cabinet__minus">{usd(r.out)}</td>
            <td className="num" data-negative={r.profit.startsWith('-') || undefined}>
              <b>{usd(r.profit)}</b>
            </td>
            <td className="num">{r.margin === null ? '' : signedPercent(r.margin)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Статьи расходов месяца полосками с суммой: самая крупная сверху */
function CategoryBars({ view, t }: { view: Ready; t: Translate }) {
  const by = new Map<string, bigint>();
  for (const e of view.expenses) if (!e.voided) by.set(e.category, (by.get(e.category) ?? 0n) + BigInt(e.amountCents));
  const rows = [...by].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  if (rows.length === 0) return <EmptyState title={t('Расходов в этом месяце нет')} />;
  const top = rows[0]![1];
  return (
    <ul className="cabinet-expenses__bars cabinet-expenses__bars--plain">
      {rows.map(([c, v]) => (
        <li key={c}>
          <span className="cabinet-expenses__name">{t(CATEGORY_LABEL[c as PlatformExpenseCategory])}</span>
          <span className="cabinet-expenses__sum">{usd(String(v))}</span>
          <span className="cabinet-expenses__bar" aria-hidden="true">
            <span style={{ inlineSize: `${Math.max(2, Number((v * 100n) / top))}%` }} /* slop-allow: inline-style ширина полосы = доля статьи */ />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Доход, каждая статья расходов, прибыль и маржа по шести месяцам; выбранный месяц последним, справа итог */
function MonthTable({
  table,
  t,
  monthName,
}: {
  table: NonNullable<Ready['summary']['table']>;
  t: Translate;
  monthName: (m: string) => string;
}) {
  return (
    <Table aria-label={t('Доходы и расходы по месяцам')} className="cabinet-money__table">
      <thead>
        <tr>
          <th>{t('Статья')}</th>
          {table.months.map((mm) => (
            <th key={mm} className="num">
              {monthName(mm)}
            </th>
          ))}
          <th className="num">{t('Итого')}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="cabinet-money__income">
          <td>{t('Доход: оплаты клиентов')}</td>
          {table.income.map((c, i) => (
            <td key={table.months[i]} className="num">
              {usd(c)}
            </td>
          ))}
          <td className="num">
            <b>{usd(table.totals.incomeCents)}</b>
          </td>
        </tr>
        {table.categories.map((c) => (
          <tr key={c.category}>
            <td>{t(CATEGORY_LABEL[c.category])}</td>
            {c.cents.map((v, i) => (
              <td key={table.months[i]} className="num">
                {v === '0' ? '' : usd(`-${v}`)}
              </td>
            ))}
            <td className="num">
              <b>{usd(`-${c.totalCents}`)}</b>
            </td>
          </tr>
        ))}
        <tr className="cabinet-money__profit">
          <td>{t('Прибыль')}</td>
          {table.profit.map((v, i) => (
            <td key={table.months[i]} className="num" data-negative={v.startsWith('-') || undefined}>
              {usd(v)}
            </td>
          ))}
          <td className="num" data-negative={table.totals.profitCents.startsWith('-') || undefined}>
            <b>{usd(table.totals.profitCents)}</b>
          </td>
        </tr>
        <tr className="cabinet-money__margin">
          <td>{t('Маржа')}</td>
          {table.margin.map((v, i) => (
            <td key={table.months[i]} className="num">
              {v === null ? '' : signedPercent(v)}
            </td>
          ))}
          <td />
        </tr>
      </tbody>
    </Table>
  );
}

/** Десятые доли процента со знаком: `-3285` в «−328,5%» */
function signedPercent(tenths: number): string {
  return `${tenths < 0 ? '\u2212' : ''}${percentText(Math.abs(tenths))}`;
}

function DueTable({
  rows,
  empty,
  t,
}: {
  rows: Array<{ organizationId: string; name: string; paidUntil: string | null; monthlyCents: string; late: boolean }>;
  empty: string;
  t: Translate;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  const total = rows.reduce((n, r) => n + BigInt(r.monthlyCents), 0n);
  return (
    <Table aria-label={empty}>
      <thead>
        <tr>
          <th>{t('Клиент')}</th>
          <th>{t('Оплачено до')}</th>
          <th className="num">{t('Сумма')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.organizationId} data-late={r.late || undefined}>
            <td>{r.name}</td>
            <td>{r.paidUntil ? dayText(r.paidUntil) : t('не задано')}</td>
            <td className="num">{usd(r.monthlyCents)}</td>
          </tr>
        ))}
        <tr className="cabinet-money__profit">
          <td>{t('Всего: {n}', { n: formatInt(rows.length) })}</td>
          <td />
          <td className="num">{usd(String(total))}</td>
        </tr>
      </tbody>
    </Table>
  );
}

type Ready = Extract<PlatformMoney, { ready: true }>;

function PaymentsTable({ view, t, limit }: { view: Ready; t: Translate; limit?: number }) {
  if (view.payments.length === 0) return <EmptyState title={t('Оплат в этом месяце нет')} />;
  const rows = limit ? view.payments.filter((p) => !p.voided).slice(0, limit) : view.payments;
  return (
    <Table aria-label={t('Оплаты клиентов')}>
      <thead>
        <tr>
          <th>{t('Дата')}</th>
          <th>{t('Клиент')}</th>
          <th className="num">{t('Сумма')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className={p.voided ? 'cabinet__voided' : undefined}>
            <td>{dayText(p.paidOn)}</td>
            <td>
              {p.name}
              {(p.voided || p.note) && <div className="cabinet__sub muted">{p.voided ? t('отменена') : p.note}</div>}
            </td>
            <td className="num cabinet__plus">+{usd(p.amountCents)}</td>
            <td>{!p.voided && !limit && <VoidButton id={p.id} kind="payment" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
