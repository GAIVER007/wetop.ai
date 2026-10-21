import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';
import { beautyApi } from '../../lib/api';
import { foodApi } from '../../lib/food-api';
import { foodStatusLabels } from '../../lib/food-data';
import { loadBeautyToday, loadFoodToday } from '../../lib/today-loaders';
import { beautyTodayMetrics, foodTodayMetrics } from '../../lib/today-metrics';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { deskShell } from '../../lib/desk-shell';
import { menuSectionsFor } from '../../lib/navigation';
import { propertyClock } from '../../lib/property-time';
import { displayDate } from '../../lib/display-date';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { DashboardRefresh } from './owner-controls';
import type { BeautyAppointmentRow } from '../../lib/api';
import type { RestaurantReservation } from '../../lib/food-types';
import './vertical-today.css';

function Summary({ values }: { values: Array<[string, number]> }) {
  return (
    <dl className="vertical-today-summary">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd data-testid={`today-${label}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="vertical-today-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
async function QuickLinks({ paths }: { paths: string[] }) {
  const shell = await deskShell();
  const items = menuSectionsFor(shell.access, shell.vertical)
    .flatMap((s) => s.items)
    .filter((i) => paths.includes(i.href));
  return (
    <nav className="vertical-today-links" aria-label="Быстрые переходы">
      {items.map((item) => (
        <Link className="btn btn--secondary" key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
const beautyLabels = {
  BOOKED: 'Запланировано',
  CONFIRMED: 'Подтверждено',
  DONE: 'Завершено',
  NO_SHOW: 'Не пришёл',
  CANCELLED: 'Отменено',
};
function BeautyRows({
  rows,
  timezone,
  masters,
}: {
  rows: BeautyAppointmentRow[];
  timezone: string;
  masters: Map<string, string>;
}) {
  const clock = propertyClock(timezone);
  return (
    <ul className="vertical-today-list">
      {rows.map((r) => (
        <li key={r.id}>
          <time dateTime={r.startsAt}>{clock.clock(r.startsAt)}</time>
          <div>
            <strong>{r.customer.name}</strong>
            <span>
              {r.serviceName} · {masters.get(r.employeeId) ?? 'Мастер не указан'}
            </span>
          </div>
          <span className="vertical-today-status">{beautyLabels[r.status]}</span>
        </li>
      ))}
    </ul>
  );
}
function FoodRows({
  rows,
  timezone,
  seated = false,
}: {
  rows: RestaurantReservation[];
  timezone: string;
  seated?: boolean;
}) {
  const clock = propertyClock(timezone);
  return (
    <ul className="vertical-today-list">
      {rows.map((r) => (
        <li key={r.id}>
          <time dateTime={seated ? r.endsAt : r.startsAt}>
            {seated ? 'До ' : ''}
            {clock.clock(seated ? r.endsAt : r.startsAt)}
          </time>
          <div>
            <strong>{[r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ')}</strong>
            <span>
              {r.partySize} гостей ·{' '}
              {r.table ? `${r.table.areaName} · ${r.table.name}` : 'Стол не назначен'}
            </span>
          </div>
          <span className="vertical-today-status">{foodStatusLabels[r.status]}</span>
        </li>
      ))}
    </ul>
  );
}
export async function BeautyToday({ locationId }: { locationId: string }) {
  try {
    const { day, minute } = await loadBeautyToday(() => beautyApi.day(), locationId);
    const m = beautyTodayMetrics(day, minute);
    const masters = new Map(day.columns.map((c) => [c.id, c.name]));
    return (
      <Page
        title="Главная"
        subtitle={`${displayDate(day.date, 'full')} · ${day.location.name ?? 'Салон'}`}
        actions={<DashboardRefresh />}
      >
        <div className="vertical-today" data-testid="beauty-today">
          <Summary
            values={[
              ['Запланировано', m.planned],
              ['Подтверждено', m.confirmed],
              ['Завершено', m.completed],
              ['Мастеров сегодня', m.masters],
            ]}
          />
          <Section title="Требует внимания">
            {!m.confirmation.length && !m.noShow ? (
              <p>Всё спокойно на сегодня</p>
            ) : (
              <>
                {m.confirmation.length > 0 && (
                  <>
                    <p>{m.confirmation.length} записей ждут подтверждения</p>
                    <BeautyRows
                      rows={m.confirmation}
                      timezone={day.location.timezone}
                      masters={masters}
                    />
                  </>
                )}
                {m.noShow > 0 && <p>Не пришёл: {m.noShow}</p>}
              </>
            )}
          </Section>
          <Section title="Ближайшие записи">
            {m.upcoming.length ? (
              <BeautyRows rows={m.upcoming} timezone={day.location.timezone} masters={masters} />
            ) : (
              <p>На сегодня записей нет</p>
            )}
          </Section>
          <QuickLinks paths={['/calendar', '/appointments', '/customers']} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Главная">
        <LoadError testId="beauty-today-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
export async function FoodToday() {
  try {
    const branch = await selectedWorkspaceBranch();
    if (!branch?.timezone || branch.vertical !== 'FOOD_SERVICE')
      throw new Error('Не удалось определить пояс выбранного ресторана');
    const data = await loadFoodToday(foodApi, branch.timezone);
    const m = foodTodayMetrics(data.rows, data.areas, data.tables, data.timezone, data.now);
    return (
      <Page
        title="Главная"
        subtitle={`${displayDate(data.date, 'full')} · ${branch.name}`}
        actions={<DashboardRefresh />}
      >
        <div className="vertical-today" data-testid="food-today">
          <Summary
            values={[
              ['Запланировано', m.planned],
              ['За столом', m.seatedCount],
              ['Завершено', m.completed],
              ['Свободных столов', m.freeNow],
            ]}
          />
          <Section title="Требует внимания">
            {!m.unassigned.length && !m.confirmation.length && !m.noShow ? (
              <p>Всё спокойно на сегодня</p>
            ) : (
              <ul className="vertical-today-attention">
                {m.unassigned.length > 0 && <li>Без стола: {m.unassigned.length}</li>}
                {m.confirmation.length > 0 && <li>Ждут подтверждения: {m.confirmation.length}</li>}
                {m.noShow > 0 && <li>Не пришли: {m.noShow}</li>}
              </ul>
            )}
          </Section>
          <Section title="Сейчас за столом">
            {m.seated.length ? (
              <FoodRows rows={m.seated} timezone={data.timezone} seated />
            ) : (
              <p>Сейчас гостей за столами нет</p>
            )}
          </Section>
          <Section title="Ближайшие брони">
            {m.upcoming.length ? (
              <FoodRows rows={m.upcoming} timezone={data.timezone} />
            ) : (
              <p>На сегодня броней нет</p>
            )}
          </Section>
          <QuickLinks paths={['/floor-plan', '/table-reservations', '/customers']} />
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title="Главная">
        <LoadError testId="food-today-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
