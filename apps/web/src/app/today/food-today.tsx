import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { BADGE_TONE, Badge, EmptyState, Panel, Stat, Stats } from '../../components/ui';
import { LineChart } from '../../components/line-chart';
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
  const attention = [
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
  return (
    <Page
      title="Главная"
      subtitle={`${branch.name}, ${displayDate(date, 'full')}`}
      actions={
        <Link className="btn" href="/floor-plan">
          Открыть план зала
        </Link>
      }
    >
      <div className="rest-dash" data-testid="food-today">
        <Stats min={190}>
          <Stat
            label="Занято столов"
            value={`${t.tablesOccupied} / ${t.tablesTotal}`}
            hint={occupancyPct === null ? 'столы не настроены' : `${occupancyPct} %`}
            testId="today-tables"
          />
          <Stat
            label="Заказов сегодня"
            value={t.ordersCount}
            delta={deltaOf(t.ordersDeltaPct)}
            testId="today-orders"
          />
          <Stat
            label="Выручка"
            value={wholeTenge(t.revenueMinor, report.currency)}
            delta={deltaOf(t.revenueDeltaPct)}
            hint="оплаченные заказы"
            testId="today-revenue"
          />
          <Stat
            label="В очереди на кухне"
            value={t.kitchenQueue}
            hint={
              t.kitchenAvgWaitMinutes === null ? 'очередь пуста' : `среднее ${t.kitchenAvgWaitMinutes} мин`
            }
            tone={t.kitchenQueue > 0 ? 'info' : 'neutral'}
            testId="today-kitchen"
          />
          <Stat
            label="Сотрудников на смене"
            value={t.staffOnShift}
            hint={`из ${t.staffTotal} по графику`}
            testId="today-staff"
          />
        </Stats>
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
        <div className="rest-dash-grid">
          <Panel>
            <h2>Выручка сегодня</h2>
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
              <h2>Последние заказы</h2>
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
        <Panel>
          <div className="food-section-heading">
            <h2>
              Ближайшие брони{' '}
              <small>
                за день: <span data-testid="today-planned">{m.planned}</span>
              </small>
            </h2>
            <Link href={reservationsHref}>Бронирования</Link>
          </div>
          {m.upcoming.length === 0 ? (
            <p className="muted">Броней впереди на сегодня нет.</p>
          ) : (
            <div className="rest-latest">
              {m.upcoming.map((u) => (
                <div className="rest-latest-row" key={u.id}>
                  <strong>{u.guest}</strong>
                  <time>{clock(u.startsAt)}</time>
                  <span className="rest-latest-sum">
                    <small>
                      {pluralRu(u.partySize, ['гость', 'гостя', 'гостей'])},{' '}
                      {u.table ? `стол ${u.table}` : 'без стола'}
                    </small>
                    <Badge>{foodStatus[u.status].label}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Page>
  );
}
