import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { Page } from '../../../../components/page';
import { Alert, Panel, Stat, Stats } from '../../../../components/ui';
import { branchesApi, type BranchItem } from '../../../../lib/api';
import { currentMe, deskShell } from '../../../../lib/desk-shell';
import { localInput } from '../../../beauty/time';
import { BEAUTY_LABELS, FOOD_LABELS, moneyText, periodDates } from './metrics';
import { loadBeautyInsights, loadBranchPeriod, loadPreviousPeriod } from './load';
import { beautyPult } from './pult';
import { analyticsMonth } from './month';
import { AnalyticsMonthNav } from './month-nav';
import { restaurantApi } from '../../../../lib/food-api';
import { BeautyPultView } from './beauty-pult';
import { FoodPeriodPanel } from './food-period';
import './vertical.css';
import { Chip, ChipGroup } from '../../../../components/chip';
import { BranchReport } from './branch-report';
import { msg } from '../../../../i18n';
import { currentLocale, serverT } from '../../../../i18n/server';
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
    // только месяц (владелец 26.10.2026): текущий до сегодня, прошлые целиком; старые ссылки `?from=` ведут в месяц даты
    const period = analyticsMonth(sp, today);
    const { from, to } = period;
    const dates = periodDates(from, to);
    const organization = sp.scope === 'organization';
    const targets = organization ? items.filter((b) => b.vertical !== 'HOSPITALITY') : [selected];
    const results: Array<{
      branch: BranchItem;
      report: Awaited<ReturnType<typeof loadBranchPeriod>> | null;
      previous: Awaited<ReturnType<typeof loadPreviousPeriod>>;
      insights?: {
        now: Awaited<ReturnType<typeof loadBeautyInsights>>;
        prev: Awaited<ReturnType<typeof loadBeautyInsights>>;
      };
      error: string | null;
    }> = [];
    // сравнение с тем же отрезком прошлого месяца; у «Всех филиалов» без него
    const prevRange = period.prev;
    const prevDates = periodDates(prevRange.from, prevRange.to);
    for (const branch of targets) {
      try {
        const report = await loadBranchPeriod(branch, dates);
        const previous = organization ? null : await loadPreviousPeriod(branch, prevDates);
        const insights = organization
          ? undefined
          : {
              now: await loadBeautyInsights(branch, from, to),
              prev: await loadBeautyInsights(branch, prevRange.from, prevRange.to),
            };
        results.push({ branch, report, previous, ...(insights ? { insights } : {}), error: null });
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
    // ЗП мастеров за месяц из «Зарплаты» (итого начислено); нет права или сбой: колонка с прочерками
    const pay =
      !organization && selected.vertical === 'BEAUTY'
        ? await restaurantApi
            .payroll(period.month)
            .then((v) => new Map(v.rows.map((r) => [r.employeeId, r.totalMinor])))
            .catch((error) => {
              unstable_rethrow(error);
              return null;
            })
        : null;
    const locale = await currentLocale();
    const monthHref = (month: string, org = organization) =>
      `${path}?${new URLSearchParams({ month, ...(org ? { scope: 'organization' } : {}) })}`;
    return (
      <Page
        title={t('Аналитика')}
        subtitle={organization ? t('Отчёты по филиалам, отдельно по направлениям.') : selected.name}
      >
        <div className="vertical-report" data-testid="vertical-analytics">
          <div className="analytics-period">
            <ChipGroup as="nav" label={t('Область отчёта')}>
              <Chip href={monthHref(period.month, false)} selected={!organization}>
                {t('Выбранный филиал')}
              </Chip>
              <Chip href={monthHref(period.month, true)} selected={organization}>
                {t('Все филиалы')}
              </Chip>
            </ChipGroup>
            <AnalyticsMonthNav
              month={period.month}
              previous={period.previousMonth}
              next={period.next}
              href={(m) => monthHref(m)}
              locale={locale}
              t={t}
            />
          </div>
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
                {group.map(({ branch, report, previous, insights, error }) =>
                  !organization && !error && report ? (
                    // один филиал: пульт владельца на всю ширину, без рамки панели вокруг
                    <div key={branch.locationId} data-testid={`report-${branch.locationId}`}>
                      {vertical === 'BEAUTY' ? (
                        <BeautyPultView
                          p={beautyPult(report.days, branch.currency)}
                          prev={previous ? beautyPult(previous.days, branch.currency) : null}
                          labels={labels}
                          today={today}
                          insights={insights?.now ?? null}
                          prevInsights={insights?.prev ?? null}
                          pay={pay}
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
              'Месяц по часам каждого филиала, текущий месяц до сегодня. Сравнение с теми же днями прошлого месяца. Показаны текущие статусы записей и броней, начавшихся за месяц.',
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
