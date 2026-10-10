import Link from 'next/link';
import { can } from '@pms/domain';
import type { SearchParams } from '../../../lib/search-params';
import { requireVertical } from '../../../lib/vertical-guard';
import { deskShell } from '../../../lib/desk-shell';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { ShareBar } from '../../../components/share-bar';
import { Badge, SectionTitle, Stat, Stats } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import './budget.css';
import { loadBudget } from './load';
import { summarize } from './derive';
import { BudgetTabs, ChooseLocation, MonthNav, PlatformShares, platformLabel } from './parts';
import { ExpenseButton, PlanButton } from './drawers';

/**
 * «Маркетинг → Бюджет», обзор месяца (МКТ-В1/В2, ТЗ «Модуль Маркетинг» 1.0, экран 2 макета):
 * план, израсходовано, остаток, прогноз конца месяца, дней до конца, рекомендация и распределение
 * по каналам. Все числа считаются из строк журнала (`derive.ts`), сервер производных не хранит.
 * Право `settings`, как у всего раздела; филиал строго из scope (409: «Выберите филиал»).
 */
export default async function BudgetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireVertical(['HOSPITALITY']);
  const [loaded, shell] = await Promise.all([loadBudget(await searchParams), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'settings'));
  const subtitle = 'План месяца, расходы на продвижение и прогноз: все каналы в одном месте.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title="Бюджет маркетинга" subtitle={subtitle}>
        {loaded.error ? <LoadError testId="budget-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const t = summarize(view);
  const rc = view.reportingCurrency;
  const recent = view.expenses.slice(0, 6);
  return (
    <Page
      crumbs={<BackToModules />}
      title="Бюджет маркетинга"
      subtitle={subtitle}
      actions={
        editable ? (
          <ExpenseButton
            primary
            defaults={{ today: view.today, reportingCurrency: rc, locationCurrency: view.locationCurrency }}
          />
        ) : undefined
      }
    >
      <div className="budget-screen" data-testid="budget-overview">
        <div className="budget-head">
          <BudgetTabs current="overview" month={view.month} />
          <MonthNav base="/marketing/budget" month={view.month} />
        </div>
        <Stats min={200}>
          <Stat
            label="Общий бюджет"
            value={view.plan === null ? 'Не задан' : formatMoney(view.plan, rc)}
            testId="budget-plan"
            hint={
              view.plan !== null && t.planUsedPct !== null ? (
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
