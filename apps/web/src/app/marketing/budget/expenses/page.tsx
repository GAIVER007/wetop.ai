import Link from 'next/link';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../../lib/search-params';
import { normalizeSearchParams } from '../../../../lib/search-params';
import { requireVertical } from '../../../../lib/vertical-guard';
import { deskShell } from '../../../../lib/desk-shell';
import { formatMoney } from '../../../../lib/money';
import { displayDate } from '../../../../lib/display-date';
import { pluralRu } from '../../../../lib/plural';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Badge, EmptyState, Table, cx } from '../../../../components/ui';
import { BackToModules } from '../../parts';
import '../../marketing.css';
import '../budget.css';
import { loadBudget } from '../load';
import { BudgetTabs, ChooseLocation, MonthNav, PLATFORM_LABELS, platformLabel } from '../parts';
import { ExpenseButton, ExportCsvButton } from '../drawers';

/**
 * «Маркетинг → Бюджет → Расходы» (экран 3 макета): журнал месяца с фильтром по платформе, итогом
 * и выгрузкой CSV. Добавление и правка: панель «Новый расход» (экран 4). Фильтр: ссылками-чипами,
 * без JS: адрес страницы хранит месяц и платформу, как фильтры /market.
 */
export default async function BudgetExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const sp = await searchParams;
  const [loaded, shell] = await Promise.all([loadBudget(sp), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'settings'));
  const subtitle = 'Журнал всех расходов на продвижение за месяц.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title="Расходы на маркетинг" subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const rc = view.reportingCurrency;
  const q = normalizeSearchParams(sp);
  const platform = q['platform'] && PLATFORM_LABELS[q['platform']] ? q['platform'] : null;
  const rows = platform ? view.expenses.filter((e) => e.platform === platform) : view.expenses;
  const present = [...new Set(view.expenses.map((e) => e.platform))];
  const total = rows.reduce((s, e) => s + BigInt(e.baseAmount), 0n);
  const defaults = { today: view.today, reportingCurrency: rc, locationCurrency: view.locationCurrency };
  const chip = (href: string, label: string, current: boolean) => (
    <Link
      key={href}
      href={href}
      className={cx('chip', current && 'chip--on')}
      aria-current={current ? 'true' : undefined}
    >
      {label}
    </Link>
  );
  return (
    <Page
      crumbs={<BackToModules />}
      title="Расходы на маркетинг"
      subtitle={subtitle}
      actions={editable ? <ExpenseButton primary defaults={defaults} /> : undefined}
    >
      <div className="budget-screen" data-testid="budget-expenses">
        <div className="budget-head">
          <BudgetTabs current="expenses" month={view.month} />
          <MonthNav base="/marketing/budget/expenses" month={view.month} />
        </div>
        <div className="budget-filter" data-testid="budget-filter">
          <nav className="budget-filter__chips" aria-label="Фильтр по платформе">
            {chip(`/marketing/budget/expenses?month=${view.month}`, 'Все', platform === null)}
            {present.map((p) =>
              chip(
                `/marketing/budget/expenses?month=${view.month}&platform=${p}`,
                platformLabel(p),
                platform === p,
              ),
            )}
          </nav>
          <div className="budget-filter__sum" data-testid="budget-filter-sum">
            {pluralRu(rows.length, ['расход', 'расхода', 'расходов'])} на {formatMoney(total, rc)}
          </div>
          <ExportCsvButton rows={rows} month={view.month} reportingCurrency={rc} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={platform ? 'По этой платформе расходов нет' : 'Расходов ещё нет'}
            data-testid="budget-empty"
            actions={editable && !platform ? <ExpenseButton primary defaults={defaults} /> : undefined}
          >
            {platform
              ? 'Выберите «Все», чтобы увидеть весь журнал месяца.'
              : 'Добавьте первый расход: дата, платформа, сумма и статья. Валюта и курс запишутся на дату операции.'}
          </EmptyState>
        ) : (
          <div className="tbl-wrap" role="region" aria-label="Журнал расходов" tabIndex={0}>
            <Table density="normal" aria-label="Журнал расходов месяца" data-testid="budget-table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">Платформа</th>
                  <th scope="col">Кампания и статья</th>
                  <th scope="col" className="budget-td-num">
                    Сумма
                  </th>
                  <th scope="col" className="budget-td-num">
                    В {rc}
                  </th>
                  <th scope="col">В бюджете</th>
                  {editable && (
                    <th scope="col">
                      <span className="visually-hidden">Действия</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>{displayDate(e.date)}</td>
                    <td>{platformLabel(e.platform)}</td>
                    <td>
                      <span className="budget-cell-main">{e.campaign ?? e.category}</span>
                      {e.campaign && <span className="budget-cell-sub">{e.category}</span>}
                      {e.description && <span className="budget-cell-sub">{e.description}</span>}
                    </td>
                    <td className="budget-td-num">
                      {formatMoney(e.amount, e.currency)}
                      {e.currency !== rc && <span className="budget-cell-sub">курс {e.fxRate}</span>}
                    </td>
                    <td className="budget-td-num">{formatMoney(e.baseAmount, rc)}</td>
                    <td>
                      {e.countedInBudget ? (
                        <Badge tone="ok">Да</Badge>
                      ) : (
                        <Badge>Вне бюджета</Badge>
                      )}
                    </td>
                    {editable && (
                      <td>
                        <ExpenseButton expense={e} defaults={defaults} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </Page>
  );
}
