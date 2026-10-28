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
import { CATEGORY_LABEL, ExpenseForm, PaymentForm, VoidButton } from '../money-forms';

/** Деньги компании WETOP (DATA_MODEL §63): доход, расходы и прибыль месяца в долларах, оплаты и расходы списком */
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
  const m = view.summary.month;
  const profitNegative = m.profitCents.startsWith('-');
  return (
    <CabinetShell
      active="money"
      t={t}
      clients={view.clients.length}
      side={
        <Panel title={t('Записать оплату')}>
          <PaymentForm clients={view.clients} today={today} />
        </Panel>
      }
    >
      <div className="cabinet__head">
        <MonthPicker month={month} locale={locale} />
      </div>
      <Stats min={180}>
        <Stat
          label={t('Доход')}
          value={usd(m.incomeCents)}
          icon={<Icon name="chart" />}
          tone="success"
          testId="money-income"
        />
        <Stat
          label={t('Расходы')}
          value={usd(m.expensesCents)}
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
          value={usd(view.summary.expectedMonthlyCents)}
          hint={t('по подпискам клиентов')}
          icon={<Icon name="booking" />}
          testId="money-expected"
        />
      </Stats>
      <div className="cabinet__grid">
        <Panel title={t('Оплаты клиентов')} data-testid="money-payments">
          <PaymentsTable view={view} t={t} />
        </Panel>
        <Panel title={t('Расходы компании')} data-testid="money-expense-list">
          <ExpensesTable view={view} t={t} />
          <ExpenseForm categories={view.categories} today={today} />
        </Panel>
      </div>
    </CabinetShell>
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
          <th>{t('Сумма')}</th>
          <th>{t('Заметка')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {view.payments.map((p) => (
          <tr key={p.id} className={p.voided ? 'cabinet__voided' : undefined}>
            <td>{dayText(p.paidOn)}</td>
            <td>{p.name}</td>
            <td>{usd(p.amountCents)}</td>
            <td>{p.voided ? t('отменена') : p.note}</td>
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
          <th>{t('Сумма')}</th>
          <th>{t('Заметка')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {view.expenses.map((e) => (
          <tr key={e.id} className={e.voided ? 'cabinet__voided' : undefined}>
            <td>{dayText(e.spentOn)}</td>
            <td>{t(CATEGORY_LABEL[e.category])}</td>
            <td>{usd(e.amountCents)}</td>
            <td>{e.voided ? t('отменён') : e.note}</td>
            <td>{!e.voided && <VoidButton id={e.id} kind="expense" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
