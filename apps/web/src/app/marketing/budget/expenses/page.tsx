import Link from 'next/link';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../../lib/search-params';
import { normalizeSearchParams } from '../../../../lib/search-params';
import { requireFeature } from '../../../../lib/vertical-guard';
import { deskShell } from '../../../../lib/desk-shell';
import { formatMoney } from '../../../../lib/money';
import { marketingCampaignsApi } from '../../../../lib/api';
import { displayDate } from '../../../../lib/display-date';
import { countLabel, msg } from '../../../../i18n';
import { currentLocale, serverT } from '../../../../i18n/server';
import { Page } from '../../../../components/page';
import { Icon } from '../../../../components/icon';
import { LoadError } from '../../../../components/load-error';
import { Badge, EmptyState, Table, cx } from '../../../../components/ui';
import { BackToModules } from '../../parts';
import '../../marketing.css';
import '../budget.css';
import { loadBudget } from '../load';
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, PLATFORM_LABELS, platformLabel } from '../parts';
import { ExpenseButton, ExportCsvButton, ImportCsvButton } from '../drawers';

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
  await requireFeature('/marketing/budget/expenses');
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const sp = await searchParams;
  const [loaded, shell] = await Promise.all([loadBudget(sp), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  const subtitle = t('Журнал всех расходов на продвижение за месяц.');
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
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
  // кампании для выбора в форме расхода (§53); не загрузились: форма без выбора
  const campaigns = await marketingCampaignsApi.list(view.month).then((r) => r.campaigns, () => []);
  const defaults = { today: view.today, reportingCurrency: rc, locationCurrency: view.locationCurrency, campaigns };
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
      title={t(BUDGET_TITLE)}
      subtitle={subtitle}
      actions={editable ? <ExpenseButton primary defaults={defaults} /> : undefined}
    >
      <div className="budget-screen" data-testid="budget-expenses">
        <div className="budget-head">
          <BudgetTabs current="expenses" month={view.month} />
          <MonthNav base="/marketing/budget/expenses" month={view.month} />
        </div>
        <div className="budget-filter" data-testid="budget-filter">
          <nav className="budget-filter__chips" aria-label={t('Фильтр по платформе')}>
            {chip(`/marketing/budget/expenses?month=${view.month}`, t('Все'), platform === null)}
            {present.map((p) =>
              chip(
                `/marketing/budget/expenses?month=${view.month}&platform=${p}`,
                t(platformLabel(p)),
                platform === p,
              ),
            )}
          </nav>
          <div className="budget-filter__sum" data-testid="budget-filter-sum">
            {t('{n} на {sum}', {
              n: countLabel(locale, t, rows.length, [msg('расход'), 'расхода', msg('расходов')]), // kk-allow: форма склонения
              sum: formatMoney(total, rc),
            })}
          </div>
          <ExportCsvButton rows={rows} month={view.month} reportingCurrency={rc} />
          {editable && <ImportCsvButton reportingCurrency={rc} />}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={platform ? t('По этой платформе расходов нет') : t('Расходов ещё нет')}
            data-testid="budget-empty"
            actions={editable && !platform ? <ExpenseButton primary defaults={defaults} /> : undefined}
          >
            {platform
              ? t('Выберите «Все», чтобы увидеть весь журнал месяца.')
              : t('Добавьте первый расход: дата, платформа, сумма и статья. Валюта и курс запишутся на дату операции.')}
          </EmptyState>
        ) : (
          <div className="tbl-wrap" role="region" aria-label={t('Журнал расходов')} tabIndex={0}>
            <Table density="normal" aria-label={t('Журнал расходов месяца')} data-testid="budget-table">
              <thead>
                <tr>
                  <th scope="col">{t('Дата')}</th>
                  <th scope="col">{t('Платформа')}</th>
                  <th scope="col">{t('Кампания и статья')}</th>
                  <th scope="col" className="budget-td-num">
                    {t('Сумма')}
                  </th>
                  <th scope="col" className="budget-td-num">
                    {t('В {currency}', { currency: rc })}
                  </th>
                  <th scope="col">{t('В бюджете')}</th>
                  {editable && (
                    <th scope="col">
                      <span className="visually-hidden">{t('Действия')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>{displayDate(e.date)}</td>
                    <td>{t(platformLabel(e.platform))}</td>
                    <td>
                      <span className="budget-cell-main">{e.campaign ?? e.category}</span>
                      {e.campaign && <span className="budget-cell-sub">{e.category}</span>}
                      {e.description && <span className="budget-cell-sub">{e.description}</span>}
                      {(e.files?.length ?? 0) > 0 && (
                        <span className="budget-cell-sub budget-files__count" data-testid={`budget-files-count-${e.id}`}>
                          <Icon name="receipt" width={14} aria-hidden="true" />
                          {countLabel(locale, t, e.files!.length, [msg('файл'), 'файла' /* kk-allow: форма склонения */, msg('файлов')])}
                        </span>
                      )}
                    </td>
                    <td className="budget-td-num">
                      {formatMoney(e.amount, e.currency)}
                      {e.currency !== rc && <span className="budget-cell-sub">{t('курс {rate}', { rate: e.fxRate })}</span>}
                    </td>
                    <td className="budget-td-num">{formatMoney(e.baseAmount, rc)}</td>
                    <td>
                      {e.countedInBudget ? (
                        <Badge tone="ok">{t('Да')}</Badge>
                      ) : (
                        <Badge>{t('Вне бюджета')}</Badge>
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
