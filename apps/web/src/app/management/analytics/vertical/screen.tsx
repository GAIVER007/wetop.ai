import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { Page } from '../../../../components/page';
import { Alert, Panel, Stat, Stats } from '../../../../components/ui';
import { branchesApi, type BranchItem } from '../../../../lib/api';
import { currentMe, deskShell } from '../../../../lib/desk-shell';
import { localInput } from '../../../beauty/time';
import { BEAUTY_LABELS, FOOD_LABELS, moneyText, periodDates } from './metrics';
import { loadBranchPeriod, loadPreviousPeriod } from './load';
import { beautyPult, previousRange } from './pult';
import { BeautyPultView } from './beauty-pult';
import { FoodPeriodPanel } from './food-period';
import './vertical.css';
import { Chip, ChipGroup } from '../../../../components/chip';
import { PeriodBar } from '../../../../components/period-bar';
import { BranchReport } from './branch-report';
import { msg } from '../../../../i18n';
import { serverT } from '../../../../i18n/server';
const path = '/management/analytics';
export async function VerticalAnalytics({ sp }: { sp: Record<string, string | undefined> }) {
  const shell = await deskShell();
  const t = await serverT();
  // Reports are stricter than the operational day APIs. Do not serialize report data for denied roles.
  if (!shell.access.role || !can(shell.access.role, 'reports'))
    return (
      <Page title={t('Аналитика')}>
        <Alert boxed>{t('Нет доступа к отчётам.')}</Alert>
      </Page>
    );
  try {
    const me = await currentMe();
    const { items } = await branchesApi.list();
    const selected = items.find(
      (b) =>
        b.locationId === me.context?.locationId && b.location.businessId === me.context?.businessId,
    );
    if (!selected) throw new Error(msg('Выбранный филиал недоступен'));
    const today = localInput(new Date().toISOString(), selected.timezone).slice(0, 10);
    const from = sp.from ?? today;
    const to = sp.to ?? from;
    const dates = periodDates(from, to);
    const organization = sp.scope === 'organization';
    const targets = organization ? items.filter((b) => b.vertical !== 'HOSPITALITY') : [selected];
    const results: Array<{
      branch: BranchItem;
      report: Awaited<ReturnType<typeof loadBranchPeriod>> | null;
      previous: Awaited<ReturnType<typeof loadPreviousPeriod>>;
      error: string | null;
    }> = [];
    // Пульт владельца (вариант A, 25.10.2026) сравнивает с таким же отрезком перед периодом; у «Всех филиалов» без него
    const prevRange = previousRange(from, to);
    const prevDates = periodDates(prevRange.from, prevRange.to);
    for (const branch of targets) {
      try {
        const report = await loadBranchPeriod(branch, dates);
        const previous = organization ? null : await loadPreviousPeriod(branch, prevDates);
        results.push({ branch, report, previous, error: null });
      } catch (error) {
        unstable_rethrow(error);
        results.push({
          branch,
          report: null,
          previous: null,
          error: msg('Данные филиала недоступны. Обновите страницу.'),
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
        title={t('Аналитика')}
        subtitle={organization ? t('Отчёты по филиалам, отдельно по направлениям.') : selected.name}
      >
        <div className="vertical-report" data-testid="vertical-analytics">
          <PeriodBar
            action={path}
            from={from}
            to={to}
            today={today}
            label={t('Период отчёта')}
            {...(organization ? { hidden: { scope: 'organization' } } : {})}
            href={(f, to) =>
              `${path}?${new URLSearchParams({ from: f, to, ...(organization ? { scope: 'organization' } : {}) })}`
            }
            lead={
              <ChipGroup as="nav" label={t('Область отчёта')}>
                <Chip href={`${path}?${q}`} selected={!organization}>
                  {t('Выбранный филиал')}
                </Chip>
                <Chip href={`${path}?${q}&scope=organization`} selected={organization}>
                  {t('Все филиалы')}
                </Chip>
              </ChipGroup>
            }
          />
          {(['BEAUTY', 'FOOD_SERVICE'] as const).map((vertical) => {
            const group = results.filter((r) => r.branch.vertical === vertical);
            if (!group.length) return null;
            const labels = vertical === 'BEAUTY' ? BEAUTY_LABELS : FOOD_LABELS;
            return (
              <section
                key={vertical}
                aria-label={vertical === 'BEAUTY' ? t('Салоны') : t('Рестораны')}
              >
                {organization && <h2>{vertical === 'BEAUTY' ? t('Салоны') : t('Рестораны')}</h2>}
                {group.map(({ branch, report, previous, error }) =>
                  !organization && !error && report ? (
                    // один филиал: пульт владельца на всю ширину, без рамки панели вокруг
                    <div key={branch.locationId} data-testid={`report-${branch.locationId}`}>
                      {vertical === 'BEAUTY' ? (
                        <BeautyPultView
                          p={beautyPult(report.days, branch.currency)}
                          prev={previous ? beautyPult(previous.days, branch.currency) : null}
                          labels={labels}
                          today={today}
                          t={t}
                        />
                      ) : (
                        report.food && (
                          <FoodPeriodPanel
                            report={report.food}
                            previous={previous?.food ?? null}
                            counts={report.counts}
                            labels={labels}
                            t={t}
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <Panel key={branch.locationId} title={branch.name}>
                      <div data-testid={`report-${branch.locationId}`}>
                        {error ? (
                          <Alert boxed>{t(error)}</Alert>
                        ) : (
                          report && (
                            <BranchReport
                              labels={labels}
                              t={t}
                              {...(vertical === 'FOOD_SERVICE'
                                ? {
                                    statusTitle: msg('Брони по статусам'),
                                    statusEmpty: msg('Броней за период нет.'),
                                  }
                                : {})}
                              counts={report.counts}
                              revenue={report.revenue}
                              foodPanel={
                                report.food ? <FoodPeriodPanel report={report.food} t={t} /> : null
                              }
                            />
                          )
                        )}
                      </div>
                    </Panel>
                  ),
                )}
              </section>
            );
          })}
          {organization && items.some((b) => b.vertical === 'HOSPITALITY') && (
            <section aria-label={t('Гостиницы')}>
              <h2>{t('Гостиницы')}</h2>
              {hotels === null ? (
                <Alert boxed>{t('Гостиничная сводка недоступна.')}</Alert>
              ) : (
                hotels?.rows.map(({ branch, stats }) => (
                  <Panel key={branch.locationId} title={branch.name}>
                    <Stats min={150}>
                      <Stat label={t('Загрузка')} value={`${stats.occupancy.percent}%`} />
                      <Stat
                        label={t('Выручка')}
                        value={moneyText(stats.revenue.totalMinor, branch.currency)}
                      />
                    </Stats>
                  </Panel>
                ))
              )}
            </section>
          )}
          <p className="muted">
            {t(
              'Даты по часам каждого филиала, период до 31 дня. Показаны текущие статусы записей и броней, начавшихся за период.',
            )}
          </p>
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Аналитика')}>
        <Alert boxed>
          {error instanceof Error ? t(error.message) : t('Не удалось загрузить отчёт')}
        </Alert>
        <Link href={path}>{t('Обновить отчёт')}</Link>
      </Page>
    );
  }
}
