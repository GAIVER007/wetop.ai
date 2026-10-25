import Link from 'next/link';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../../lib/search-params';
import { requireFeature } from '../../../../lib/vertical-guard';
import { deskShell } from '../../../../lib/desk-shell';
import { formatMoney } from '../../../../lib/money';
import { marketingCampaignsApi } from '../../../../lib/api';
import { displayDate } from '../../../../lib/display-date';
import { countLabel, msg } from '../../../../i18n';
import { currentLocale, serverT } from '../../../../i18n/server';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { ShareBar } from '../../../../components/share-bar';
import { Badge, EmptyState, SectionTitle, Table } from '../../../../components/ui';
import { BackToModules } from '../../parts';
import '../../marketing.css';
import '../budget.css';
import '../../../finance/summary.css';
import { loadBudget } from '../load';
import { channelPlan, summarize } from '../derive';
import { BUDGET_TITLE, BudgetTabs, ChooseLocation, MonthNav, PlatformShares, platformLabel } from '../parts';
import { ExpenseButton, LinesButton, PlanButton } from '../drawers';

/**
 * «Бюджет и аналитика → План» (до 20.10.2026 обзор на `/marketing/budget`, теперь там «Сводка»): обзор месяца (МКТ-В1/В2, ТЗ «Модуль Маркетинг» 1.0, экран 2 макета):
 * план, израсходовано, остаток, прогноз конца месяца, дней до конца, рекомендация и распределение
 * по каналам. Все числа считаются из строк журнала (`derive.ts`), сервер производных не хранит.
 * Право `marketing`, как у всего раздела (ADR-MKT-B7); филиал строго из scope (409: «Выберите филиал»).
 */
export default async function BudgetPlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireFeature('/marketing/budget/plan');
  const [t, locale] = await Promise.all([serverT(), currentLocale()]);
  const [loaded, shell] = await Promise.all([loadBudget(await searchParams), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  const subtitle = t('План месяца, расходы на продвижение и прогноз: все каналы в одном месте.');
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={t(BUDGET_TITLE)} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  // кампании для выбора в форме расхода (§53); не загрузились: форма без выбора, обзор от этого не зависит
  const campaigns = await marketingCampaignsApi.list(view.month).then((r) => r.campaigns, () => []);
  const tot = summarize(view);
  const channels = channelPlan(view);
  const rc = view.reportingCurrency;
  // §52: без общего плана план месяца это сумма каналов
  const planValue = view.plan ?? (channels.allocated > 0n ? channels.allocated.toString() : null);
  const money = (v: bigint | null) => (v === null ? '–' : formatMoney(v, rc));
  const recent = view.expenses.slice(0, 6);
  return (
    <Page
      crumbs={<BackToModules />}
      title={t(BUDGET_TITLE)}
      subtitle={subtitle}
      actions={
        editable ? (
          <ExpenseButton
            primary
            defaults={{ today: view.today, reportingCurrency: rc, locationCurrency: view.locationCurrency, campaigns }}
          />
        ) : undefined
      }
    >
      <div className="budget-screen" data-testid="budget-overview">
        <div className="budget-head">
          <BudgetTabs current="plan" month={view.month} />
          <MonthNav base="/marketing/budget/plan" month={view.month} />
        </div>
        {/* план и итоги месяца одной строкой с кнопкой «Задать план», без плиток (аудит 21.10.2026 п. 32) */}
        <div className="budget-plan-line">
          <dl className="money-summary">
            <div>
              <dt>{t('Общий бюджет')}</dt>
              <dd data-testid="budget-plan">{planValue === null ? t('Не задан') : formatMoney(planValue, rc)}</dd>
              {planValue !== null && tot.planUsedPct !== null && (
                <dd className="budget-plan-used">
                  <ShareBar
                    label={t('Израсходовано от плана')}
                    value={Math.min(100, tot.planUsedPct)}
                    tone={tot.planUsedPct > 100 ? 'danger' : 'info'}
                  />
                  {tot.planUsedPct} %
                </dd>
              )}
            </div>
            <div>
              <dt>{t('Израсходовано')}</dt>
              <dd data-testid="budget-spent">{formatMoney(tot.spent, rc)}</dd>
            </div>
            <div>
              <dt>{t('Остаток')}</dt>
              <dd data-testid="budget-remainder" className={tot.remainder !== null && tot.remainder < 0n ? 'budget-td-danger' : undefined}>
                {tot.remainder === null ? '–' : formatMoney(tot.remainder, rc)}
              </dd>
            </div>
            <div>
              <dt>{t('Прогноз конца месяца')}</dt>
              <dd data-testid="budget-forecast">{tot.forecast === null ? '–' : formatMoney(tot.forecast, rc)}</dd>
            </div>
          </dl>
          {editable && <PlanButton month={view.month} plan={view.plan} currency={rc} />}
        </div>
        <div className="budget-meta" data-testid="budget-meta">
          <span>
            {planValue === null ? t('Задайте план, и появятся остаток и рекомендация.') + ' ' : ''}
            {t('До конца месяца {n}', {
              n: countLabel(locale, t, tot.daysLeft, [msg('день'), 'дня', msg('дней')]), // kk-allow: форма склонения
            })}
          </span>
          {tot.onTrack !== null &&
            (tot.onTrack ? (
              <Badge tone="ok" data-testid="budget-ontrack">
                {t('Остаётесь в плане')}
              </Badge>
            ) : (
              <Badge tone="warn" data-testid="budget-ontrack">
                {t('Прогноз выше плана')}
              </Badge>
            ))}
        </div>
        <section aria-labelledby="budget-lines-title">
          <div className="budget-recent-head">
            <SectionTitle id="budget-lines-title">{t('План по каналам')}</SectionTitle>
            {editable && (
              <LinesButton
                month={view.month}
                plan={view.plan}
                lines={view.lines}
                prevLines={view.prevLines}
                currency={rc}
              />
            )}
          </div>
          {view.lines.length === 0 ? (
            <EmptyState data-testid="budget-lines-empty">
              {t('Распишите план месяца по каналам, и здесь появится план против факта по каждому.')}
            </EmptyState>
          ) : (
            <>
              <p className="budget-meta" data-testid="budget-lines-summary">
                <span>
                  {channels.unallocated === null
                    ? t('План месяца это сумма каналов: {sum}', { sum: formatMoney(channels.allocated, rc) })
                    : t('Распределено {sum} из {plan}', {
                        sum: formatMoney(channels.allocated, rc),
                        plan: formatMoney(view.plan!, rc),
                      })}
                </span>
                {channels.overAllocated ? (
                  <Badge tone="warn" data-testid="budget-lines-over">
                    {t('Каналы больше плана на {sum}', { sum: formatMoney(-channels.unallocated!, rc) })}
                  </Badge>
                ) : (
                  channels.unallocated !== null &&
                  channels.unallocated > 0n && <span>{t('Не распределено {sum}', { sum: formatMoney(channels.unallocated, rc) })}</span>
                )}
              </p>
              <div className="tbl-wrap" role="region" aria-label={t('План по каналам')} tabIndex={0}>
                <Table density="normal" aria-label={t('План по каналам')} data-testid="budget-lines">
                  <thead>
                    <tr>
                      <th scope="col">{t('Канал')}</th>
                      <th scope="col" className="budget-td-num">
                        {t('План')}
                      </th>
                      <th scope="col" className="budget-td-num">
                        {t('Факт')}
                      </th>
                      <th scope="col" className="budget-td-num">
                        {t('Остаток')}
                      </th>
                      <th scope="col" className="budget-td-num">
                        {t('Прогноз')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.rows.map((r) => (
                      <tr key={r.platform}>
                        <td>
                          <span className="budget-cell-main">{t(platformLabel(r.platform))}</span>
                          {r.plan === null && <span className="budget-cell-sub">{t('без плана')}</span>}
                          {r.over && (
                            <span className="budget-cell-sub">
                              <Badge tone="warn">{t('Прогноз выше плана')}</Badge>
                            </span>
                          )}
                        </td>
                        <td className="budget-td-num">{money(r.plan)}</td>
                        <td className="budget-td-num">{formatMoney(r.spent, rc)}</td>
                        <td className={`budget-td-num${r.remainder !== null && r.remainder < 0n ? ' budget-td-danger' : ''}`}>
                          {money(r.remainder)}
                        </td>
                        <td className="budget-td-num">{money(r.forecast)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </section>
        <section aria-labelledby="budget-shares-title">
          <SectionTitle id="budget-shares-title">{t('Распределение по каналам')}</SectionTitle>
          <PlatformShares expenses={view.expenses} currency={rc} testId="budget-shares" />
        </section>
        <section aria-labelledby="budget-recent-title">
          <div className="budget-recent-head">
            <SectionTitle id="budget-recent-title">{t('Последние расходы')}</SectionTitle>
            <Link href={`/marketing/budget/expenses?month=${view.month}`} className="budget-all-link">
              {t('Все расходы')}
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState data-testid="budget-recent-empty">
              {t('В этом месяце расходов ещё нет. Добавьте первый, и обзор оживёт.')}
            </EmptyState>
          ) : (
            <ul className="budget-recent" data-testid="budget-recent">
              {recent.map((e) => (
                <li key={e.id} className="panel budget-recent__row">
                  <span className="budget-recent__what">
                    <span className="budget-recent__platform">{t(platformLabel(e.platform))}</span>
                    <span className="budget-recent__detail">{e.campaign ?? e.category}</span>
                  </span>
                  <span className="budget-recent__when">{displayDate(e.date)}</span>
                  <span className="budget-recent__sum">{formatMoney(e.baseAmount, rc)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
