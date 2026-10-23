import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { Page } from '../../../../components/page';
import { Alert, Panel, Stat, Stats } from '../../../../components/ui';
import { branchesApi, type BranchItem } from '../../../../lib/api';
import { currentMe, deskShell } from '../../../../lib/desk-shell';
import { localInput } from '../../../beauty/time';
import { BEAUTY_LABELS, FOOD_LABELS, moneyText, periodDates } from './metrics';
import { loadBranchPeriod } from './load';
import { FoodPeriodPanel } from './food-period';
import './vertical.css';
import { Chip, ChipGroup } from '../../../../components/chip';
import { PeriodBar } from '../../../../components/period-bar';
import { BranchReport } from './branch-report';
const path = '/management/analytics';
export async function VerticalAnalytics({ sp }: { sp: Record<string, string | undefined> }) {
  const shell = await deskShell();
  // Reports are stricter than the operational day APIs. Do not serialize report data for denied roles.
  if (!shell.access.role || !can(shell.access.role, 'reports'))
    return (
      <Page title="Аналитика">
        <Alert boxed>Нет доступа к отчётам.</Alert>
      </Page>
    );
  try {
    const me = await currentMe();
    const { items } = await branchesApi.list();
    const selected = items.find(
      (b) =>
        b.locationId === me.context?.locationId && b.location.businessId === me.context?.businessId,
    );
    if (!selected) throw new Error('Выбранный филиал недоступен');
    const today = localInput(new Date().toISOString(), selected.timezone).slice(0, 10);
    const from = sp.from ?? today;
    const to = sp.to ?? from;
    const dates = periodDates(from, to);
    const organization = sp.scope === 'organization';
    const targets = organization ? items.filter((b) => b.vertical !== 'HOSPITALITY') : [selected];
    const results: Array<{
      branch: BranchItem;
      report: Awaited<ReturnType<typeof loadBranchPeriod>> | null;
      error: string | null;
    }> = [];
    for (const branch of targets) {
      try {
        results.push({ branch, report: await loadBranchPeriod(branch, dates), error: null });
      } catch (error) {
        unstable_rethrow(error);
        results.push({
          branch,
          report: null,
          error: 'Данные филиала недоступны. Обновите страницу.',
        });
      }
    }
    // Existing guarded hotel report, kept separate from Beauty/Food.
    const hotels =
      organization && items.some((b) => b.vertical === 'HOSPITALITY')
        ? await branchesApi.overview(from, to).catch((error) => {
            unstable_rethrow(error);
            return null;
          })
        : undefined;
    const q = new URLSearchParams({ from, to });
    return (
      <Page
        title="Аналитика"
        subtitle={organization ? 'Отчёты по филиалам, отдельно по направлениям.' : selected.name}
      >
        <div className="vertical-report" data-testid="vertical-analytics">
          <PeriodBar
            action={path}
            from={from}
            to={to}
            today={today}
            label="Период отчёта"
            {...(organization ? { hidden: { scope: 'organization' } } : {})}
            href={(f, t) =>
              `${path}?${new URLSearchParams({ from: f, to: t, ...(organization ? { scope: 'organization' } : {}) })}`
            }
            lead={
              <ChipGroup as="nav" label="Область отчёта">
                <Chip href={`${path}?${q}`} selected={!organization}>
                  Выбранный филиал
                </Chip>
                <Chip href={`${path}?${q}&scope=organization`} selected={organization}>
                  Все филиалы
                </Chip>
              </ChipGroup>
            }
          />
          {(['BEAUTY', 'FOOD_SERVICE'] as const).map((vertical) => {
            const group = results.filter((r) => r.branch.vertical === vertical);
            if (!group.length) return null;
            const labels = vertical === 'BEAUTY' ? BEAUTY_LABELS : FOOD_LABELS;
            return (
              <section key={vertical} aria-label={vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны'}>
                {organization && <h2>{vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны'}</h2>}
                {group.map(({ branch, report, error }) => (
                  <Panel key={branch.locationId} title={branch.name}>
                    <div data-testid={`report-${branch.locationId}`}>
                      {error ? (
                        <Alert boxed>{error}</Alert>
                      ) : (
                        report && (
                          <BranchReport
                            labels={labels}
                            {...(vertical === 'FOOD_SERVICE'
                              ? { statusTitle: 'Брони по статусам', statusEmpty: 'Броней за период нет.' }
                              : {})}
                            counts={report.counts}
                            revenue={report.revenue}
                            foodPanel={
                              report.food ? <FoodPeriodPanel report={report.food} /> : null
                            }
                          />
                        )
                      )}
                    </div>
                  </Panel>
                ))}
              </section>
            );
          })}
          {organization && items.some((b) => b.vertical === 'HOSPITALITY') && (
            <section aria-label="Гостиницы">
              <h2>Гостиницы</h2>
              {hotels === null ? (
                <Alert boxed>Гостиничная сводка недоступна.</Alert>
              ) : (
                hotels?.rows.map(({ branch, stats }) => (
                  <Panel key={branch.locationId} title={branch.name}>
                    <Stats min={150}>
                      <Stat label="Загрузка" value={`${stats.occupancy.percent}%`} />
                      <Stat
                        label="Выручка"
                        value={moneyText(stats.revenue.totalMinor, branch.currency)}
                      />
                    </Stats>
                  </Panel>
                ))
              )}
            </section>
          )}
          <p className="muted">
            Даты по часам каждого филиала, период до 31 дня. Показаны текущие статусы записей и броней,
            начавшихся за период.
          </p>
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Аналитика">
        <Alert boxed>{error instanceof Error ? error.message : 'Не удалось загрузить отчёт'}</Alert>
        <Link href={path}>Обновить отчёт</Link>
      </Page>
    );
  }
}
