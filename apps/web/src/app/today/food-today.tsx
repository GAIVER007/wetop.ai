import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { BADGE_TONE, Badge, EmptyState, Panel, Stat, Stats } from '../../components/ui';
import { LineChart } from '../../components/line-chart';
import { Icon } from '../../components/icon';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { wholeTenge, type Delta } from '../../lib/dashboard-format';
import { restaurantApi } from '../../lib/food-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { localInput } from '../beauty/time';
import { pluralRu } from '../../lib/plural';
import { statusLabel, statusTone } from '../../lib/status/types';
import { foodOrderStatus, foodStatus } from '../../lib/status/food';
import { loadFoodToday } from './vertical-load';
import { birthdayOn } from '../food/guest-marks';
import './vertical-today.css';
import '../food/restaurant.css';

const deltaOf = (pct: number | null): Delta | undefined =>
  pct === null
    ? undefined
    : {
        direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
        text: `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)} % к вчера`,
      };

/** «Главная» ресторана по макету владельца (ADR-159): плитки дня, выручка по часам, последние заказы */
export async function FoodToday() {
  const loaded = await (async () => {
    const branch = await selectedWorkspaceBranch();
    if (!branch) throw new Error('Выбранный филиал недоступен');
    const date = localInput(new Date().toISOString(), branch.timezone).slice(0, 10);
    const [report, reservations] = await Promise.all([
      restaurantApi.report(date),
      loadFoodToday(new Date().toISOString()),
    ]);
    return { branch, date, report, reservations };
  })().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="Главная">
        <LoadError testId="today-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { branch, date, report, reservations } = loaded.value;
  const t = report.tiles;
  const m = reservations.metrics;
  const reservationsHref = `/table-reservations?date=${date}`;
  const coming = reservations.reservations.filter((r) =>
    ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status),
  );
  const birthdays = coming.filter((r) => birthdayOn(r.customer.birthDate, date)).length;
  const vips = coming.filter((r) => r.customer.isVip).length;
  const attention = [
    birthdays > 0 && {
      text: `День рождения у гостей с бронью сегодня: ${birthdays}`,
      href: reservationsHref,
      action: 'Открыть бронирования',
      testId: 'today-attention-birthdays',
    },
    vips > 0 && {
      text: `VIP-гости сегодня: ${vips}`,
      href: reservationsHref,
      action: 'Открыть бронирования',
      testId: 'today-attention-vip',
    },
    m.withoutTable > 0 && {
      text: `Без стола: ${m.withoutTable}`,
      href: reservationsHref,
      action: 'Открыть бронирования',
      testId: 'today-attention-no-table',
    },
    m.awaitingConfirmation > 0 && {
      text: `Ждут подтверждения: ${m.awaitingConfirmation}`,
      href: reservationsHref,
      action: 'Открыть бронирования',
      testId: 'today-attention-unconfirmed',
    },
    m.noShow > 0 && {
      text: `Не пришли: ${m.noShow}`,
      href: reservationsHref,
      action: 'Открыть бронирования',
      testId: 'today-attention-no-show',
    },
  ].filter((a): a is Exclude<typeof a, false> => Boolean(a));
  const occupancyPct =
    t.tablesTotal > 0 ? Math.round((t.tablesOccupied / t.tablesTotal) * 100) : null;
  const hourly = report.hourlyRevenueMinor.map((v) => Number(BigInt(v) / 100n));
  const hourLabels = report.hourlyRevenueMinor.map(
    (_, h) => `${String(h).padStart(2, '0')}:00`,
  );
  const clock = (iso: string) => localInput(iso, branch.timezone).slice(11, 16);
  const clockNow = clock(new Date().toISOString());
  const hour = Number(clockNow.slice(0, 2));
  const greeting =
    hour < 5 ? 'Доброй ночи!' : hour < 12 ? 'Доброе утро!' : hour < 18 ? 'Добрый день!' : 'Добрый вечер!';
  const expectedGuests = coming.reduce((acc, r) => acc + r.partySize, 0);
  const seatedGuests = coming
    .filter((r) => r.status === 'SEATED')
    .reduce((acc, r) => acc + r.partySize, 0);
  const freeTables = t.tablesTotal - t.tablesOccupied;
  return (
    <Page
      title={greeting}
      subtitle={`Сегодня, ${displayDate(date, 'full')} · ${branch.name}`}
      actions={
        <span className="rest-now" data-testid="today-now">
          <Icon name="clock" />
          Сейчас в зале <strong>{clockNow}</strong>
        </span>
      }
    >
      <div className="rest-dash" data-testid="food-today">
        <Stats min={170} className="rest-kpis">
          <Stat
            label="Бронирования"
            value={m.planned}
            hint={`впереди сегодня, всего ${reservations.reservations.length}`}
            testId="today-planned"
          />
          <Stat
            label="Ожидаемые гости"
            value={expectedGuests}
            hint="по броням дня"
            testId="today-expected-guests"
          />
          <Stat
            label="Гости в зале"
            value={seatedGuests}
            hint="посажены по броням"
            testId="today-seated-guests"
          />
          <Stat
            label="Свободные столы"
            value={freeTables}
            hint={
              occupancyPct === null
                ? 'столы не настроены'
                : `из ${t.tablesTotal}, занято ${t.tablesOccupied} / ${t.tablesTotal}`
            }
            testId="today-tables"
          />
          <Stat
            label="Выручка сегодня"
            value={wholeTenge(t.revenueMinor, report.currency)}
            delta={deltaOf(t.revenueDeltaPct)}
            hint="оплаченные заказы"
            testId="today-revenue"
          />
        </Stats>
        <div className="rest-dash-main">
          <Panel>
            <div className="food-section-heading">
              <h2>Ближайшие бронирования</h2>
              <Link href={reservationsHref}>Все брони</Link>
            </div>
            {m.upcoming.length === 0 ? (
              <p className="muted">Броней впереди на сегодня нет.</p>
            ) : (
              <table className="rest-upcoming" data-testid="today-upcoming">
                <caption className="sr-only">Ближайшие брони сегодня</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Время</th>
                    <th scope="col">Гость</th>
                    <th scope="col">Гостей</th>
                    <th scope="col">Стол</th>
                    <th scope="col">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {m.upcoming.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <time dateTime={u.startsAt}>{clock(u.startsAt)}</time>
                      </td>
                      <th scope="row">{u.guest}</th>
                      <td className="muted">{pluralRu(u.partySize, ['гость', 'гостя', 'гостей'])}</td>
                      <td className="muted">{u.table ? `Стол ${u.table}` : 'Без стола'}</td>
                      <td>
                        <Badge tone={BADGE_TONE[statusTone(foodStatus, u.status)]}>
                          {foodStatus[u.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <div className="rest-dash-side">
            <Panel>
              <h2>Быстрые действия</h2>
              <div className="rest-quick">
                <Link className="btn" href="/table-reservations?new=1">
                  <Icon name="plus" />
                  Новая бронь
                </Link>
                <Link className="btn btn--secondary" href="/floor-plan" aria-label="Открыть план зала">
                  <Icon name="today" />
                  План зала
                </Link>
                <Link className="btn btn--secondary" href="/customers">
                  <Icon name="search" />
                  Найти гостя
                </Link>
                <Link className="btn btn--secondary" href={reservationsHref}>
                  <Icon name="board" />
                  Расписание броней
                </Link>
              </div>
            </Panel>
            {attention.length > 0 && (
              <Panel title="Требуют внимания" aria-label="Требуют внимания">
                <ul className="vertical-today__attention">
                  {attention.map((a) => (
                    <li key={a.testId} data-testid={a.testId}>
                      <span>{a.text}</span>
                      <Link className="btn btn--ghost btn--sm" href={a.href}>
                        {a.action}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
        <div className="rest-dash-grid">
          <Panel>
            <h2>Выручка по часам</h2>
            {hourly.some((v) => v > 0) ? (
              <LineChart
                series={[
                  {
                    name: 'Выручка',
                    values: hourly,
                    summary: wholeTenge(t.revenueMinor, report.currency),
                  },
                ]}
                labels={hourLabels}
                format={(v) => wholeTenge(String(Math.round(v) * 100), report.currency)}
                testId="today-revenue-chart"
              />
            ) : (
              <p className="muted">Оплаченных заказов сегодня ещё нет.</p>
            )}
          </Panel>
          <Panel>
            <div className="food-section-heading">
              <h2>
                Последние заказы <small data-testid="today-orders">{t.ordersCount}</small>
              </h2>
              <Link href="/orders">Все заказы</Link>
            </div>
            {report.latestOrders.length === 0 ? (
              <EmptyState title="Заказов сегодня ещё нет" />
            ) : (
              <div className="rest-latest" data-testid="today-latest-orders">
                {report.latestOrders.map((o) => (
                  <div className="rest-latest-row" key={o.id}>
                    <strong>{o.table ? `Стол ${o.table.name}` : `Заказ №${o.number}`}</strong>
                    <time>{clock(o.openedAt)}</time>
                    <span className="rest-latest-sum">
                      <strong>{wholeTenge(o.totalMinor, o.currency)}</strong>
                      <Badge tone={BADGE_TONE[statusTone(foodOrderStatus, o.status)]}>
                        {statusLabel(foodOrderStatus, o.status)}
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
