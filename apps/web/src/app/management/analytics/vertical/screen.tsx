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
import './vertical.css';
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
        subtitle={
          organization
            ? 'Отчёты по филиалам, отдельно по направлениям.'
            : `${selected.name}, ${selected.timezone}`
        }
      >
        <div className="vertical-report" data-testid="vertical-analytics">
          <nav className="settings-tabs" aria-label="Область отчёта">
            <Link href={`${path}?${q}`} aria-current={!organization ? 'page' : undefined}>
              Выбранный филиал
            </Link>
            <Link
              href={`${path}?${q}&scope=organization`}
              aria-current={organization ? 'page' : undefined}
            >
              Все филиалы
            </Link>
          </nav>
          <form className="vertical-report-period" action={path}>
            <label>
              С даты
              <input type="date" name="from" defaultValue={from} required />
            </label>
            <label>
              По дату
              <input type="date" name="to" defaultValue={to} required />
            </label>
            {organization && <input type="hidden" name="scope" value="organization" />}
            <button className="btn btn-primary" type="submit">
              Показать
            </button>
          </form>
          <p className="muted">
            {from} – {to}, включительно. Даты в часовом поясе каждого филиала. Период до 31 дня.
          </p>
          {(['BEAUTY', 'FOOD_SERVICE'] as const).map((vertical) => {
            const group = results.filter((r) => r.branch.vertical === vertical);
            if (!group.length) return null;
            const labels = vertical === 'BEAUTY' ? BEAUTY_LABELS : FOOD_LABELS;
            return (
              <section key={vertical} aria-label={vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны'}>
                {organization && <h2>{vertical === 'BEAUTY' ? 'Салоны' : 'Рестораны'}</h2>}
                {group.map(({ branch, report, error }) => (
                  <Panel key={branch.locationId} title={`${branch.name}, ${branch.timezone}`}>
                    <div data-testid={`report-${branch.locationId}`}>
                      {error ? (
                        <Alert boxed>{error}</Alert>
                      ) : (
                        report && (
                          <>
                            <Stats min={150} aria-label="Статусы за период">
                              {Object.entries(labels).map(([status, label]) => (
                                <Stat
                                  key={status}
                                  label={label}
                                  value={report.counts[status as keyof typeof report.counts] ?? 0}
                                  testId={`period-${status}`}
                                />
                              ))}
                            </Stats>
                            {report.revenue !== null ? (
                              <Panel title="Выручка по завершённым записям">
                                {Object.entries(report.revenue).length ? (
                                  Object.entries(report.revenue).map(([currency, minor]) => (
                                    <p key={currency} data-testid={`revenue-${currency}`}>
                                      {moneyText(minor, currency)}
                                    </p>
                                  ))
                                ) : (
                                  <p>Завершённых записей за период нет.</p>
                                )}
                                <p className="muted">
                                  Снимки цены записей со статусом «Завершено». Это не полученные
                                  оплаты. Валюты отдельно.
                                </p>
                              </Panel>
                            ) : (
                              <p className="muted" data-testid="food-finance-unavailable">
                                Финансовый учёт ресторана не подключён.
                              </p>
                            )}
                          </>
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
                  <Panel key={branch.locationId} title={`${branch.name}, ${branch.timezone}`}>
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
            Показаны текущие статусы записей, начавшихся за период. Проценты неявок и повторных
            посещений пока не рассчитываются.
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
