import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { Icon } from '../../../../components/icon';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import type { PlatformMoney } from '../../../../lib/api';
import { currentLocale, serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { MonthPicker } from './month-picker';
import { NotReady, loadMoney } from '../load-money';
import { CabinetShell, dayText, usd } from '../shell';
import { ExpenseForm, PaymentForm, VoidButton } from '../money-forms';
import { CATEGORY_LABEL } from '../categories';
import { FormDialog } from '../form-dialog';
import { percentText } from '../growth-parts';
import { formatInt } from '../../../../lib/dashboard-format';
import { monthLabel } from '../../../branches/month-picker';

/** Деньги компании WETOP (DATA_MODEL §63; вид от 30.10.2026: кнопки записи в окне, таблица по месяцам, поступления и расходы рядом, ожидаем и просрочено): доход, расходы и прибыль месяца в долларах, оплаты и расходы списком */
export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Деньги WETOP')}>
      <Suspense fallback={<LoadingState label={t('Считаем деньги…')} />}>
        <Money month={month} />
      </Suspense>
    </Page>
  );
}

async function Money({ month }: { month: string }) {
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
  return (
    <CabinetShell active="money" t={t} clients={view.clients.length}>
      <div className="cabinet__head cabinet-money__head">
        <MonthPicker month={month} locale={locale} />
        <div className="cabinet-money__actions">
          <FormDialog label={t('Записать оплату')} title={t('Оплата клиента')} testId="money-payment-dialog">
            <PaymentForm clients={view.clients} today={today} />
          </FormDialog>
          <FormDialog
            label={t('Записать расход')}
            title={t('Расход компании')}
            tone="secondary"
            testId="money-expense-dialog"
          >
            <ExpenseForm categories={view.categories} today={today} />
          </FormDialog>
        </div>
      </div>
      <Stats min={180}>
        <Stat
          label={t('Поступило')}
          value={usd(m.incomeCents)}
          hint={t('оплат за месяц: {n}', { n: formatInt(view.payments.filter((p) => !p.voided).length) })}
          icon={<Icon name="chart" />}
          tone="success"
          testId="money-income"
        />
        <Stat
          label={t('Расходы')}
          value={usd(m.expensesCents)}
          hint={t('записей за месяц: {n}', { n: formatInt(view.expenses.filter((e) => !e.voided).length) })}
          icon={<Icon name="money" />}
          testId="money-expenses"
        />
        <Stat
          label={t('Прибыль')}
          value={usd(m.profitCents)}
          tone={profitNegative ? 'danger' : 'success'}
          icon={<Icon name="analytics" />}
          testId="money-profit"
        />
        <Stat
          label={t('Ожидаем в месяц')}
          value={usd(sm.expectedMonthlyCents)}
          hint={t('по подпискам клиентов')}
          icon={<Icon name="booking" />}
          testId="money-expected"
        />
      </Stats>
      {sm.table && (
        <Panel title={t('Доходы и расходы по месяцам')} data-testid="money-table">
          <MonthTable table={sm.table} t={t} monthName={shortMonth} />
        </Panel>
      )}
      <div className="cabinet-money__pair">
        <Panel title={t('Поступления за месяц')} data-testid="money-payments">
          <PaymentsTable view={view} t={t} />
        </Panel>
        <Panel title={t('Расходы за месяц')} data-testid="money-expense-list">
          <ExpensesTable view={view} t={t} />
        </Panel>
      </div>
      <div className="cabinet-money__pair">
        <Panel title={t('Ожидаем оплату, 30 дней')} data-testid="money-upcoming">
          <DueTable
            rows={(sm.upcoming ?? []).map((u) => ({ ...u, late: false }))}
            empty={t('В ближайшие 30 дней оплат по подпискам нет')}
            t={t}
          />
        </Panel>
        <Panel title={t('Просрочено')} data-testid="money-overdue">
          <DueTable
            rows={sm.overdue.map((o) => ({ ...o, late: true }))}
            empty={t('Просроченных оплат нет')}
            t={t}
          />
        </Panel>
      </div>
    </CabinetShell>
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

function PaymentsTable({ view, t }: { view: Ready; t: Translate }) {
  if (view.payments.length === 0) return <EmptyState title={t('Оплат в этом месяце нет')} />;
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
        {view.payments.map((p) => (
          <tr key={p.id} className={p.voided ? 'cabinet__voided' : undefined}>
            <td>{dayText(p.paidOn)}</td>
            <td>
              {p.name}
              {(p.voided || p.note) && <div className="cabinet__sub muted">{p.voided ? t('отменена') : p.note}</div>}
            </td>
            <td className="num">{usd(p.amountCents)}</td>
            <td>{!p.voided && <VoidButton id={p.id} kind="payment" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function ExpensesTable({ view, t }: { view: Ready; t: Translate }) {
  if (view.expenses.length === 0) return <EmptyState title={t('Расходов в этом месяце нет')} />;
  return (
    <Table aria-label={t('Расходы компании')}>
      <thead>
        <tr>
          <th>{t('Дата')}</th>
          <th>{t('Статья')}</th>
          <th className="num">{t('Сумма')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {view.expenses.map((e) => (
          <tr key={e.id} className={e.voided ? 'cabinet__voided' : undefined}>
            <td>{dayText(e.spentOn)}</td>
            <td>
              {t(CATEGORY_LABEL[e.category])}
              {(e.voided || e.note) && <div className="cabinet__sub muted">{e.voided ? t('отменён') : e.note}</div>}
            </td>
            <td className="num">{usd(e.amountCents)}</td>
            <td>{!e.voided && <VoidButton id={e.id} kind="expense" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
