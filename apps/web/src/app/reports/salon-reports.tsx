import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { pageOpen } from '../../lib/navigation';
import { Page } from '../../components/page';
import { Alert, EmptyState, Panel, Table } from '../../components/ui';
import { PeriodBar } from '../../components/period-bar';
import { KpiTile } from '../../components/kpi-tile';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';

import { localInput } from '../beauty/time';
import { BEAUTY_LABELS, moneyText, periodDates } from '../management/analytics/vertical/metrics';
import { loadSalonReport } from './salon-report-data';
import './salon-reports.css';

export async function SalonReportsScreen({ searchParams }: { searchParams: SearchParams }) {
  const shell = await deskShell();
  if (!shell.access.role || !pageOpen(shell.access, 'reports', '/reports'))
    return (
      <Page title="Отчёты">
        <Alert boxed>Нет доступа к отчётам.</Alert>
      </Page>
    );
  const sp = normalizeSearchParams(searchParams);
  try {
    const branch = await selectedWorkspaceBranch();
    if (!branch || branch.vertical !== 'BEAUTY')
      return (
        <Page title="Отчёты">
          <Alert boxed>Выберите филиал салона для отчёта.</Alert>
        </Page>
      );
    const today = localInput(new Date().toISOString(), branch.timezone).slice(0, 10);
    const from = sp.from ?? today;
    const to = sp.to ?? from;
    const dates = periodDates(from, to);
    const report = await loadSalonReport(branch, dates);
    const query = new URLSearchParams({ from, to }).toString();
    const view = ['services', 'team', 'statuses'].includes(sp.view ?? '') ? sp.view! : 'overview';
    const rows = view === 'team' ? report.masters : report.services;
    return (
      <Page title="Отчёты" subtitle={branch.name}>
        <div className="salon-reports" data-testid="salon-reports">
          <PeriodBar
            action="/reports"
            from={from}
            to={to}
            today={today}
            label="Период отчёта"
            hidden={{ view }}
            href={(f, t) => `/reports?${new URLSearchParams({ from: f, to: t, view })}`}
            lead={
              <nav className="chips" aria-label="Вид отчёта">
                {(
                  [
                    ['overview', 'Обзор'],
                    ['services', 'Услуги'],
                    ['team', 'Специалисты'],
                    ['statuses', 'Статусы'],
                  ] as const
                ).map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/reports?${query}&view=${key}`}
                    aria-current={view === key ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            }
          />
          {report.currencies.length === 0 ? (
            <EmptyState
              title="Завершённых записей за период нет"
              details="Измените период или посмотрите статусы всех записей."
            />
          ) : (
            report.currencies.map((group) => (
              <section key={group.currency} aria-label={`Итоги ${group.currency}`}>
                <h2>{group.currency}</h2>
                <div className="salon-reports__kpis">
                  <KpiTile
                    icon="money"
                    label="Стоимость оказанных услуг"
                    value={moneyText(group.costMinor, group.currency)}
                    caption="Снимки цен завершённых записей, не поступления"
                    testId={`salon-report-cost-${group.currency}`}
                  />
                  <KpiTile
                    icon="check"
                    label="Завершённые записи"
                    value={String(group.visits)}
                    caption="Один визит считается один раз"
                  />
                  <KpiTile
                    icon="receipt"
                    label="Средняя стоимость записи"
                    value={moneyText(
                      (BigInt(group.costMinor) / BigInt(group.visits)).toString(),
                      group.currency,
                    )}
                    caption="По завершённым записям"
                  />
                  <KpiTile
                    icon="guests"
                    label="Специалисты"
                    value={String(
                      report.masters.filter((master) => master.currency === group.currency).length,
                    )}
                    caption="Участвовали в завершённых записях"
                  />
                </div>
              </section>
            ))
          )}
          {view === 'overview' ? (
            <div className="salon-reports__trio">
              <RowsPanel
                kind="services"
                rows={report.services.slice(0, 5)}
                total={report.services.length}
                query={query}
              />
              <RowsPanel
                kind="team"
                rows={report.masters.slice(0, 5)}
                total={report.masters.length}
                query={query}
              />
              <StatusesPanel counts={report.counts} />
            </div>
          ) : view === 'statuses' ? (
            <StatusesPanel counts={report.counts} />
          ) : (
            <RowsPanel
              kind={view === 'team' ? 'team' : 'services'}
              rows={rows}
              total={rows.length}
              full
              query={query}
            />
          )}
          <p className="muted">
            Записи по дате начала. Валюты отдельно. Стоимость услуг не равна полученным оплатам,
            прибыли или зарплате.
          </p>
          <nav className="chips" aria-label="Связанные разделы">
            <Link href={`/management/analytics?${query}`}>Аналитика филиалов</Link>
            <Link href={`/appointments?${query}`}>Записи периода</Link>
          </nav>
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Отчёты">
        <Alert boxed>
          Не удалось построить отчёт. Проверьте доступ к филиалу и укажите корректный период не
          больше 31 дня.
        </Alert>
      </Page>
    );
  }
}

type Row = Awaited<ReturnType<typeof loadSalonReport>>['services'][number];

function RowsPanel({
  kind,
  rows,
  total,
  query,
  full,
}: {
  kind: 'services' | 'team';
  rows: Row[];
  total: number;
  query: string;
  /** полный вид со столбцом «Услуги»; в обзоре столбцов меньше, чтобы три панели встали в ряд */
  full?: boolean;
}) {
  const team = kind === 'team';
  const name = team ? 'Специалист' : 'Услуга';
  return (
    <Panel title={team ? 'По специалистам' : 'По услугам'}>
      {rows.length ? (
        <Table
          density="compact"
          captionHidden
          caption={team ? 'Завершённые услуги по специалистам' : 'Завершённые услуги'}
          stack
        >
          <thead>
            <tr>
              <th scope="col">{name}</th>
              <th scope="col">Записи</th>
              {full && <th scope="col">Услуги</th>}
              <th scope="col">Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.currency}:${row.id}`}>
                <td data-label={name}>{row.name}</td>
                <td data-label="Записи">{row.visits}</td>
                {full && <td data-label="Услуги">{row.services}</td>}
                <td data-label="Стоимость">{moneyText(row.costMinor, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="muted">В выбранном периоде нет оказанных услуг.</p>
      )}
      {total > rows.length && (
        <Link className="salon-reports__more" href={`/reports?${query}&view=${kind}`}>
          Все ({total})
        </Link>
      )}
    </Panel>
  );
}

function StatusesPanel({ counts }: { counts: Record<string, number> }) {
  return (
    <Panel title="Статусы записей">
      <Table density="compact" captionHidden caption="Количество записей по статусам" stack>
        <thead>
          <tr>
            <th scope="col">Статус</th>
            <th scope="col">Записи</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(BEAUTY_LABELS).map(([status, label]) => (
            <tr key={status}>
              <td data-label="Статус">{label}</td>
              <td data-label="Записи">{counts[status] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
