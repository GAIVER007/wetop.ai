import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { pageOpen } from '../../lib/navigation';
import { Page } from '../../components/page';
import { Alert, Button, EmptyState, Field, Input, Panel, Table } from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { deskShell } from '../../lib/desk-shell';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';

import { displayDate } from '../../lib/display-date';
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
    const empty = Object.values(report.counts).every((count) => !count);
    return (
      <Page title="Отчёты" subtitle="Оказанные услуги, специалисты и статусы записей за период.">
        <div className="salon-reports" data-testid="salon-reports">
          {/* поля и кнопка одной высоты, по низу (аудит 21.10.2026 п.34) */}
          <form action="/reports" className="salon-reports__period" aria-label="Период отчёта">
            <Field label="С даты" controlId="salon-reports-from">
              <Input type="date" lang="ru" name="from" defaultValue={from} required />
            </Field>
            <Field label="По дату" controlId="salon-reports-to">
              <Input type="date" lang="ru" name="to" defaultValue={to} required />
            </Field>
            <input type="hidden" name="view" value={view} />
            <Button type="submit">Показать</Button>
          </form>
          <p className="muted">
            С {displayDate(from)} по {displayDate(to)} включительно, по дате начала записи во времени
            филиала. Период до 31 дня.
          </p>
          {/* общий компонент вкладок вместо чипов (аудит 21.10.2026 п.33) */}
          <Tabs
            label="Вид отчёта"
            items={(
              [
                ['overview', 'Обзор'],
                ['services', 'Услуги'],
                ['team', 'Специалисты'],
                ['statuses', 'Статусы'],
              ] as const
            ).map(([key, label]) => ({
              href: `/reports?${query}&view=${key}`,
              label,
              current: view === key,
            }))}
          />
          {empty ? (
            // пустой период: один баннер вместо трёх пустых блоков (аудит 21.10.2026 п.25)
            <EmptyState
              title="За этот период записей нет"
              details="Выберите другой период."
            />
          ) : (
          <>
          {report.currencies.length === 0 ? (
            <EmptyState
              title="Завершённых записей за период нет"
              details="Измените период или посмотрите статусы всех записей."
            />
          ) : (
            // итоги строкой, без плиток (правило владельца «без плиток над списками»)
            report.currencies.map((group) => (
              <p
                key={group.currency}
                className="salon-reports__totals"
                aria-label={`Итоги ${group.currency}`}
              >
                <span>
                  Стоимость оказанных услуг:{' '}
                  <b data-testid={`salon-report-cost-${group.currency}`}>
                    {moneyText(group.costMinor, group.currency)}
                  </b>
                </span>
                <span>
                  Завершённых записей: <b>{group.visits}</b>
                </span>
                <span>
                  Средняя стоимость записи:{' '}
                  <b>
                    {moneyText(
                      (BigInt(group.costMinor) / BigInt(group.visits)).toString(),
                      group.currency,
                    )}
                  </b>
                </span>
                <span>
                  Специалистов:{' '}
                  <b>
                    {report.masters.filter((master) => master.currency === group.currency).length}
                  </b>
                </span>
              </p>
            ))
          )}
          <p className="muted">
            Стоимость это снимки цен завершённых записей. Валюты считаются отдельно, пересчёт не
            выполняется. Стоимость услуг не равна полученным оплатам, прибыли или зарплате.
          </p>
          {view !== 'statuses' && (
            <Panel title={view === 'team' ? 'По специалистам' : 'По услугам'}>
              {rows.length ? (
                <Table
                  density="compact"
                  caption={
                    view === 'team' ? 'Завершённые услуги по специалистам' : 'Завершённые услуги'
                  }
                  stack
                >
                  <thead>
                    <tr>
                      <th scope="col">{view === 'team' ? 'Специалист' : 'Услуга'}</th>
                      <th scope="col">Записи</th>
                      <th scope="col">Услуги</th>
                      <th scope="col">Стоимость</th>
                      <th scope="col">Валюта</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.currency}:${row.id}`}>
                        <td data-label={view === 'team' ? 'Специалист' : 'Услуга'}>{row.name}</td>
                        <td data-label="Записи">{row.visits}</td>
                        <td data-label="Услуги">{row.services}</td>
                        <td data-label="Стоимость">{moneyText(row.costMinor, row.currency)}</td>
                        <td data-label="Валюта">{row.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p>В выбранном периоде нет оказанных услуг.</p>
              )}
            </Panel>
          )}
          {(view === 'overview' || view === 'statuses') && (
            <Panel title="Статусы записей">
              <Table density="compact" caption="Количество записей по статусам" stack>
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
                      <td data-label="Записи">
                        {report.counts[status as keyof typeof report.counts]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}
          </>
          )}
          {/* обычные ссылки, а не серые чипы, похожие на вкладки (аудит 21.10.2026 п.26) */}
          <p className="salon-reports__links">
            Смотрите также: <Link href={`/appointments?${query}`}>записи за этот период</Link>,{' '}
            <Link href={`/management/analytics?${query}`}>аналитика по филиалам</Link>.
          </p>
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
