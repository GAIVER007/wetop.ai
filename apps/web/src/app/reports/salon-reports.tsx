import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { pageOpen } from '../../lib/navigation';
import { Page } from '../../components/page';
import { Alert, EmptyState, Panel, Table } from '../../components/ui';
import { PeriodBar } from '../../components/period-bar';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';

import { localInput } from '../beauty/time';
import { BEAUTY_LABELS, moneyText, periodDates } from '../management/analytics/vertical/metrics';
import { loadSalonReport } from './salon-report-data';
import './salon-reports.css';
import { msg, type Translate } from '../../i18n';
import { serverT } from '../../i18n/server';

export async function SalonReportsScreen({ searchParams }: { searchParams: SearchParams }) {
  const t = await serverT();
  const shell = await deskShell();
  if (!shell.access.role || !pageOpen(shell.access, 'reports', '/reports'))
    return (
      <Page title={t('Отчёты')}>
        <Alert boxed>{t('Нет доступа к отчётам.')}</Alert>
      </Page>
    );
  const sp = normalizeSearchParams(searchParams);
  try {
    const branch = await selectedWorkspaceBranch();
    if (!branch || branch.vertical !== 'BEAUTY')
      return (
        <Page title={t('Отчёты')}>
          <Alert boxed>{t('Выберите филиал салона для отчёта.')}</Alert>
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
      <Page title={t('Отчёты')} subtitle={branch.name}>
        <div className="salon-reports" data-testid="salon-reports">
          <PeriodBar
            action="/reports"
            from={from}
            to={to}
            today={today}
            label={t('Период отчёта')}
            hidden={{ view }}
            href={(f, until) => `/reports?${new URLSearchParams({ from: f, to: until, view })}`}
          />
          {/* Отчёты, вариант B владельца 26.10.2026: слева список отчётов с подписью, справа один отчёт целиком */}
          <div className="salon-reports__layout">
            <nav className="salon-reports__menu" aria-label={t('Вид отчёта')}>
              <ul>
                {(
                  [
                    ['overview', msg('Обзор'), msg('главные цифры')],
                    ['services', msg('Услуги'), msg('что продаётся')],
                    ['team', msg('Специалисты'), msg('кто сколько принёс')],
                    ['statuses', msg('Статусы'), msg('записи и неявки')],
                  ] as const
                ).map(([key, label, note]) => (
                  <li key={key}>
                    <Link
                      href={`/reports?${query}&view=${key}`}
                      aria-current={view === key ? 'page' : undefined}
                    >
                      {t(label)}
                    </Link>
                    <span className="muted">{t(note)}</span>
                  </li>
                ))}
                <li>
                  <Link href={`/appointments?${query}`}>{t('Записи периода')}</Link>
                  <span className="muted">{t('каждая запись')}</span>
                </li>
                <li>
                  <Link href={`/management/analytics?${query}`}>{t('Аналитика филиалов')}</Link>
                  <span className="muted">{t('сравнение')}</span>
                </li>
              </ul>
            </nav>
            <div className="salon-reports__body">
              {report.currencies.length === 0 ? (
                <EmptyState
                  title={t('Завершённых записей за период нет')}
                  details={t('Измените период или посмотрите статусы всех записей.')}
                />
              ) : (
                // итоги строкой вместо четырёх плиток (правило владельца 21.10.2026: без плиток над списком)
                report.currencies.map((group) => (
                  <p
                    key={group.currency}
                    className="salon-reports__summary"
                    data-testid="salon-report-summary"
                    aria-label={t('Итоги {currency}', { currency: group.currency })}
                  >
                    <span>
                      {t('Стоимость оказанных услуг')}{' '}
                      <b data-testid={`salon-report-cost-${group.currency}`}>
                        {moneyText(group.costMinor, group.currency)}
                      </b>
                    </span>
                    <span>
                      {t('завершённых записей')} <b>{group.visits}</b>
                    </span>
                    <span>
                      {t('средний чек')}{' '}
                      <b>
                        {moneyText(
                          (BigInt(group.costMinor) / BigInt(group.visits)).toString(),
                          group.currency,
                        )}
                      </b>
                    </span>
                    <span>
                      {t('специалистов')}{' '}
                      <b>
                        {
                          report.masters.filter((master) => master.currency === group.currency)
                            .length
                        }
                      </b>
                    </span>
                  </p>
                ))
              )}
              {view === 'overview' ? (
                <div className="salon-reports__trio">
                  <RowsPanel
                    kind="services"
                    rows={report.services.slice(0, 5)}
                    total={report.services.length}
                    query={query}
                    t={t}
                  />
                  <RowsPanel
                    kind="team"
                    rows={report.masters.slice(0, 5)}
                    total={report.masters.length}
                    query={query}
                    t={t}
                  />
                  <StatusesPanel counts={report.counts} t={t} />
                </div>
              ) : view === 'statuses' ? (
                <StatusesPanel counts={report.counts} t={t} />
              ) : (
                <RowsPanel
                  kind={view === 'team' ? 'team' : 'services'}
                  rows={rows}
                  total={rows.length}
                  full
                  query={query}
                  t={t}
                />
              )}
              <p className="muted">
                {t(
                  'Записи по дате начала. Валюты отдельно. Стоимость услуг не равна полученным оплатам, прибыли или зарплате.',
                )}
              </p>
            </div>
          </div>
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Отчёты')}>
        <Alert boxed>
          {t(
            'Не удалось построить отчёт. Проверьте доступ к филиалу и укажите корректный период не больше 31 дня.',
          )}
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
  t,
}: {
  t: Translate;
  kind: 'services' | 'team';
  rows: Row[];
  total: number;
  query: string;
  /** полный вид со столбцом «Услуги»; в обзоре столбцов меньше, чтобы три панели встали в ряд */
  full?: boolean;
}) {
  const team = kind === 'team';
  const name = team ? t('Специалист') : t('Услуга');
  // строка «Итого» полного отчёта, только когда все строки в одной валюте (валюты не складываем)
  const currencies = new Set(rows.map((r) => r.currency));
  const sum =
    rows.length > 1 && currencies.size === 1
      ? {
          currency: rows[0]!.currency,
          visits: rows.reduce((a, r) => a + r.visits, 0),
          services: rows.reduce((a, r) => a + r.services, 0),
          costMinor: rows.reduce((a, r) => a + BigInt(r.costMinor), 0n).toString(),
        }
      : null;
  return (
    <Panel title={team ? t('По специалистам') : t('По услугам')}>
      {rows.length ? (
        <Table
          density="compact"
          captionHidden
          caption={team ? t('Завершённые услуги по специалистам') : t('Завершённые услуги')}
          stack
        >
          <thead>
            <tr>
              <th scope="col">{name}</th>
              <th scope="col">{t('Записи')}</th>
              {full && <th scope="col">{t('Услуги')}</th>}
              <th scope="col">{t('Стоимость')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.currency}:${row.id}`}>
                <td data-label={name}>{team ? t(row.name) : row.name}</td>
                <td data-label={t('Записи')}>{row.visits}</td>
                {full && <td data-label={t('Услуги')}>{row.services}</td>}
                <td data-label={t('Стоимость')}>{moneyText(row.costMinor, row.currency)}</td>
              </tr>
            ))}
          </tbody>
          {full && sum && (
            <tfoot>
              <tr>
                <th scope="row" data-label={name}>
                  {t('Итого')}
                </th>
                <td data-label={t('Записи')}>{sum.visits}</td>
                <td data-label={t('Услуги')}>{sum.services}</td>
                <td data-label={t('Стоимость')} data-testid={`salon-report-total-${kind}`}>
                  {moneyText(sum.costMinor, sum.currency)}
                </td>
              </tr>
            </tfoot>
          )}
        </Table>
      ) : (
        <EmptyState title={t('В выбранном периоде нет оказанных услуг')} />
      )}
      {total > rows.length && (
        <Link className="salon-reports__more" href={`/reports?${query}&view=${kind}`}>
          {t('Все ({n})', { n: total })}
        </Link>
      )}
    </Panel>
  );
}

function StatusesPanel({ counts, t }: { counts: Record<string, number>; t: Translate }) {
  return (
    <Panel title={t('Статусы записей')}>
      <Table density="compact" captionHidden caption={t('Количество записей по статусам')} stack>
        <thead>
          <tr>
            <th scope="col">{t('Статус')}</th>
            <th scope="col">{t('Записи')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(BEAUTY_LABELS).map(([status, label]) => (
            <tr key={status}>
              <td data-label={t('Статус')}>{t(label)}</td>
              <td data-label={t('Записи')} data-testid={`salon-report-status-${status}`}>
                {counts[status] ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
