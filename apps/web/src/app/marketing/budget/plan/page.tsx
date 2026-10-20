import Link from 'next/link';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../../lib/search-params';
import { requireFeature } from '../../../../lib/vertical-guard';
import { deskShell } from '../../../../lib/desk-shell';
import { formatMoney } from '../../../../lib/money';
import { marketingCampaignsApi } from '../../../../lib/api';
import { displayDate } from '../../../../lib/display-date';
import { pluralRu } from '../../../../lib/plural';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { ShareBar } from '../../../../components/share-bar';
import { Badge, SectionTitle, Stat, Stats, Table } from '../../../../components/ui';
import { BackToModules } from '../../parts';
import '../../marketing.css';
import '../budget.css';
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
  const [loaded, shell] = await Promise.all([loadBudget(await searchParams), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  const subtitle = 'План месяца, расходы на продвижение и прогноз: все каналы в одном месте.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title={BUDGET_TITLE} subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  // кампании для выбора в форме расхода (§53); не загрузились: форма без выбора, обзор от этого не зависит
  const campaigns = await marketingCampaignsApi.list(view.month).then((r) => r.campaigns, () => []);
  const t = summarize(view);
  const channels = channelPlan(view);
  const rc = view.reportingCurrency;
  // §52: без общего плана план месяца это сумма каналов
  const planValue = view.plan ?? (channels.allocated > 0n ? channels.allocated.toString() : null);
  const money = (v: bigint | null) => (v === null ? '–' : formatMoney(v, rc));
  const recent = view.expenses.slice(0, 6);
  return (
    <Page
      crumbs={<BackToModules />}
      title={BUDGET_TITLE}
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
        <Stats min={200}>
          <Stat
            label="Общий бюджет"
            value={planValue === null ? 'Не задан' : formatMoney(planValue, rc)}
            testId="budget-plan"
            hint={
              planValue !== null && t.planUsedPct !== null ? (
                <span className="budget-plan-used">
                  <ShareBar
                    label="Израсходовано от плана"
                    value={Math.min(100, t.planUsedPct)}
                    tone={t.planUsedPct > 100 ? 'danger' : 'info'}
                  />
                  {t.planUsedPct} %
                </span>
              ) : (
                'Задайте план, и появятся остаток и рекомендация'
              )
            }
          />
          <Stat label="Израсходовано" value={formatMoney(t.spent, rc)} testId="budget-spent" />
          <Stat
            label="Остаток"
            value={t.remainder === null ? '–' : formatMoney(t.remainder, rc)}
            tone={t.remainder !== null && t.remainder < 0n ? 'danger' : undefined}
            testId="budget-remainder"
          />
          <Stat
            label="Прогноз конца месяца"
            value={t.forecast === null ? '–' : formatMoney(t.forecast, rc)}
            hint={t.forecast === null ? 'Месяц ещё не начался' : 'По темпу прошедших дней'}
            testId="budget-forecast"
          />
        </Stats>
        <div className="budget-meta" data-testid="budget-meta">
          <span>
            До конца месяца {pluralRu(t.daysLeft, ['день', 'дня', 'дней'])}
          </span>
          {t.onTrack !== null &&
            (t.onTrack ? (
              <Badge tone="ok" data-testid="budget-ontrack">
                Остаётесь в плане
              </Badge>
            ) : (
              <Badge tone="warn" data-testid="budget-ontrack">
                Прогноз выше плана
              </Badge>
            ))}
          {editable && <PlanButton month={view.month} plan={view.plan} currency={rc} />}
        </div>
        <section aria-labelledby="budget-lines-title">
          <div className="budget-recent-head">
            <SectionTitle id="budget-lines-title">План по каналам</SectionTitle>
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
            <p className="settings-note" data-testid="budget-lines-empty">
              Распишите план месяца по каналам, и здесь появится план против факта по каждому.
            </p>
          ) : (
            <>
              <p className="budget-meta" data-testid="budget-lines-summary">
                <span>
                  {channels.unallocated === null
                    ? `План месяца это сумма каналов: ${formatMoney(channels.allocated, rc)}`
                    : `Распределено ${formatMoney(channels.allocated, rc)} из ${formatMoney(view.plan!, rc)}`}
                </span>
                {channels.overAllocated ? (
                  <Badge tone="warn" data-testid="budget-lines-over">
                    Каналы больше плана на {formatMoney(-channels.unallocated!, rc)}
                  </Badge>
                ) : (
                  channels.unallocated !== null &&
                  channels.unallocated > 0n && <span>Не распределено {formatMoney(channels.unallocated, rc)}</span>
                )}
              </p>
              <div className="tbl-wrap" role="region" aria-label="План по каналам" tabIndex={0}>
                <Table density="normal" aria-label="План по каналам" data-testid="budget-lines">
                  <thead>
                    <tr>
                      <th scope="col">Канал</th>
                      <th scope="col" className="budget-td-num">
                        План
                      </th>
                      <th scope="col" className="budget-td-num">
                        Факт
                      </th>
                      <th scope="col" className="budget-td-num">
                        Остаток
                      </th>
                      <th scope="col" className="budget-td-num">
                        Прогноз
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.rows.map((r) => (
                      <tr key={r.platform}>
                        <td>
                          <span className="budget-cell-main">{platformLabel(r.platform)}</span>
                          {r.plan === null && <span className="budget-cell-sub">без плана</span>}
                          {r.over && (
                            <span className="budget-cell-sub">
                              <Badge tone="warn">Прогноз выше плана</Badge>
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
          <SectionTitle id="budget-shares-title">Распределение по каналам</SectionTitle>
          <div className="panel panel--lg">
            <PlatformShares expenses={view.expenses} currency={rc} testId="budget-shares" />
          </div>
        </section>
        <section aria-labelledby="budget-recent-title">
          <div className="budget-recent-head">
            <SectionTitle id="budget-recent-title">Последние расходы</SectionTitle>
            <Link href={`/marketing/budget/expenses?month=${view.month}`} className="budget-all-link">
              Все расходы
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="settings-note" data-testid="budget-recent-empty">
              В этом месяце расходов ещё нет. Добавьте первый, и обзор оживёт.
            </p>
          ) : (
            <ul className="budget-recent" data-testid="budget-recent">
              {recent.map((e) => (
                <li key={e.id} className="panel budget-recent__row">
                  <span className="budget-recent__what">
                    <span className="budget-recent__platform">{platformLabel(e.platform)}</span>
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
