import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { Icon } from '../../../../components/icon';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import type { PlatformExpenseCategory, PlatformMoney } from '../../../../lib/api';
import { currentLocale, serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { MonthPicker } from '../money/month-picker';
import { NotReady, loadMoney } from '../load-money';
import { CabinetShell, dayText, usd } from '../shell';
import { ExpenseForm, VoidButton } from '../money-forms';
import { CATEGORY_LABEL } from '../categories';
import { FormDialog } from '../form-dialog';
import { percentText } from '../growth-parts';
import { formatInt } from '../../../../lib/dashboard-format';

/**
 * Расходы компании WETOP (владелец 30.10.2026: «раздел расходы, там будем видеть все расходы и добавлять расходы»).
 * Те же записи, что в «Деньгах» (`platform_expenses`, DATA_MODEL §63), без дохода: итог месяца и к прошлому, статьи
 * месяца с долей, все расходы месяца с отбором по статье, «Записать расход» в окне. Выплаты партнёрам пишутся в
 * «Партнёрах», зарплаты удобнее в «Команде», но видны здесь все.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  const cat = typeof q['category'] === 'string' ? q['category'] : '';
  return (
    <Page width="full" title={t('Расходы WETOP')}>
      <Suspense fallback={<LoadingState label={t('Считаем расходы…')} />}>
        <Expenses month={month} category={cat} />
      </Suspense>
    </Page>
  );
}

type Ready = Extract<PlatformMoney, { ready: true }>;

async function Expenses({ month, category }: { month: string; category: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  const { view, error } = await loadMoney(month, t);
  if (!view)
    return (
      <CabinetShell active="expenses" t={t}>
        {error}
      </CabinetShell>
    );
  if (!view.ready)
    return (
      <CabinetShell active="expenses" t={t}>
        <NotReady t={t} />
      </CabinetShell>
    );
  const today = new Date().toISOString().slice(0, 10);
  const live = view.expenses.filter((e) => !e.voided);
  const total = live.reduce((n, e) => n + BigInt(e.amountCents), 0n);
  // прошлый месяц из таблицы по месяцам: выбранный последним, прошлый перед ним
  const table = view.summary.table;
  const prevIndex = table ? table.months.length - 2 : -1;
  const prev = table && prevIndex >= 0 ? table.categories.reduce((n, c) => n + BigInt(c.cents[prevIndex] ?? '0'), 0n) : null;
  const byCategory = new Map<PlatformExpenseCategory, bigint>();
  for (const e of live) byCategory.set(e.category, (byCategory.get(e.category) ?? 0n) + BigInt(e.amountCents));
  const parts = [...byCategory].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  const top = parts[0];
  const known = (c: string): c is PlatformExpenseCategory => (view.categories as string[]).includes(c) || c === 'PARTNERS';
  const filter = known(category) ? category : null;
  const rows = filter ? view.expenses.filter((e) => e.category === filter) : view.expenses;
  // доля в десятых процента, без плавающей точки
  const share = (v: bigint) => (total === 0n ? 0 : Number((v * 1000n) / total));
  const href = (c: string | null) => `/platform/cabinet/expenses?month=${month}${c ? `&category=${c}` : ''}`;
  return (
    <CabinetShell active="expenses" t={t} clients={view.clients.length}>
      <div className="cabinet__head cabinet-money__head">
        <MonthPicker month={month} locale={locale} base="/platform/cabinet/expenses" />
        <div className="cabinet-money__actions">
          <FormDialog label={t('Записать расход')} title={t('Расход компании')} testId="expenses-add-dialog">
            <ExpenseForm categories={view.categories} today={today} />
          </FormDialog>
        </div>
      </div>
      <Stats min={180}>
        <Stat
          label={t('Расходы за месяц')}
          value={usd(String(total))}
          hint={t('записей: {n}', { n: formatInt(live.length) })}
          icon={<Icon name="money" />}
          testId="expenses-total"
        />
        <Stat
          label={t('Прошлый месяц')}
          value={prev === null ? '' : usd(String(prev))}
          hint={prev === null ? undefined : diffText(total - prev, t)}
          icon={<Icon name="calendarOff" />}
          testId="expenses-prev"
        />
        <Stat
          label={t('Больше всего')}
          value={top ? t(CATEGORY_LABEL[top[0]]) : t('нет расходов')}
          hint={top ? `${usd(String(top[1]))}, ${percentText(share(top[1]))}` : undefined}
          icon={<Icon name="pie" />}
          testId="expenses-top"
        />
        <Stat
          label={t('Статей')}
          value={formatInt(parts.length)}
          hint={t('с расходами в месяце')}
          icon={<Icon name="tag" />}
          testId="expenses-categories"
        />
      </Stats>
      <div className="cabinet-expenses">
        <Panel title={t('По статьям')} data-testid="expenses-by-category">
          {parts.length === 0 ? (
            <EmptyState title={t('Расходов в этом месяце нет')} />
          ) : (
            <ul className="cabinet-expenses__bars">
              {parts.map(([c, v]) => (
                <li key={c} data-active={filter === c || undefined}>
                  <a href={href(filter === c ? null : c)} data-testid="expenses-category">
                    <span className="cabinet-expenses__name">{t(CATEGORY_LABEL[c])}</span>
                    <span className="cabinet-expenses__sum">
                      {usd(String(v))} <span className="muted">{percentText(share(v))}</span>
                    </span>
                    <span className="cabinet-expenses__bar" aria-hidden="true">
                      <span
                        style={{ inlineSize: `${Math.max(2, share(v) / 10)}%` }} /* slop-allow: inline-style ширина полосы = доля статьи */
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={filter ? t('Расходы: {name}', { name: t(CATEGORY_LABEL[filter]) }) : t('Все расходы за месяц')}
          data-testid="expenses-list"
        >
          {filter && (
            <a className="cabinet__more" href={href(null)} data-testid="expenses-all">
              {t('Показать все статьи')}
            </a>
          )}
          <ExpensesTable rows={rows} t={t} />
        </Panel>
      </div>
    </CabinetShell>
  );
}

/** «на $120 больше» или «на $40 меньше» прошлого месяца */
function diffText(d: bigint, t: Translate): string {
  if (d === 0n) return t('как в прошлом месяце');
  return d > 0n ? t('на {sum} больше', { sum: usd(String(d)) }) : t('на {sum} меньше', { sum: usd(String(-d)) });
}

function ExpensesTable({ rows, t }: { rows: Ready['expenses']; t: Translate }) {
  if (rows.length === 0) return <EmptyState title={t('Расходов нет')} />;
  return (
    <Table aria-label={t('Расходы компании')} className="cabinet-expenses__table">
      <thead>
        <tr>
          <th>{t('Дата')}</th>
          <th>{t('Статья')}</th>
          <th>{t('Заметка')}</th>
          <th className="num">{t('Сумма')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className={e.voided ? 'cabinet__voided' : undefined} data-testid="expenses-row">
            <td>{dayText(e.spentOn)}</td>
            <td>{t(CATEGORY_LABEL[e.category])}</td>
            <td className="muted">
              {e.voided
                ? t('отменён')
                : [e.payee, e.project, e.documentRef, e.note, e.recurring ? t('каждый месяц') : null].filter(Boolean).join(', ')}
            </td>
            <td className="num">{usd(e.amountCents)}</td>
            <td>{!e.voided && <VoidButton id={e.id} kind="expense" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

