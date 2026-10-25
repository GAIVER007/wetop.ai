import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { BADGE_TONE, Badge, EmptyState, Panel } from '../../components/ui';
import { LineChart } from '../../components/line-chart';
import { Icon } from '../../components/icon';
import { loadErrorProps } from '../../lib/load-error';
import { wholeTenge } from '../../lib/dashboard-format';
import { restaurantApi } from '../../lib/food-api';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { localInput } from '../beauty/time';
import { pluralRu } from '../../lib/plural';
import { tableTitle } from '../../lib/table-title';
import { statusLabel, statusTone } from '../../lib/status/types';
import { foodOrderStatus, foodStatus } from '../../lib/status/food';
import { loadFoodToday } from './vertical-load';
import { FoodTodayTotals } from './food-today-totals';
import { birthdayOn } from '../food/guest-marks';
import { fullDay } from './vertical-day';
import { translator } from '../../i18n';
import { currentLocale } from '../../i18n/server';
import './vertical-today.css';
import '../food/restaurant.css';

/** «Главная» ресторана по макету владельца (ADR-159): итоги дня строкой, выручка по часам, последние заказы */
export async function FoodToday() {
  const locale = await currentLocale();
  const t = translator(locale);
  const loaded = await (async () => {
    const branch = await selectedWorkspaceBranch();
    if (!branch) throw new Error(t('Выбранный филиал недоступен'));
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
      <Page title={t('Главная')}>
        <LoadError testId="today-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { branch, date, report, reservations } = loaded.value;
  const tiles = report.tiles;
  const m = reservations.metrics;
  const reservationsHref = `/table-reservations?date=${date}`;
  const coming = reservations.reservations.filter((r) =>
    ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status),
  );
  const birthdays = coming.filter((r) => birthdayOn(r.customer.birthDate, date)).length;
  const vips = coming.filter((r) => r.customer.isVip).length;
  const attention = [
    birthdays > 0 && {
      text: t('День рождения у гостей с бронью сегодня: {n}', { n: birthdays }),
      href: reservationsHref,
      action: t('Открыть бронирования'),
      testId: 'today-attention-birthdays',
    },
    vips > 0 && {
      text: t('VIP-гости сегодня: {n}', { n: vips }),
      href: reservationsHref,
      action: t('Открыть бронирования'),
      testId: 'today-attention-vip',
    },
    m.withoutTable > 0 && {
      text: t('Без стола: {n}', { n: m.withoutTable }),
      href: reservationsHref,
      action: t('Открыть бронирования'),
      testId: 'today-attention-no-table',
    },
    m.awaitingConfirmation > 0 && {
      text: t('Ждут подтверждения: {n}', { n: m.awaitingConfirmation }),
      href: reservationsHref,
      action: t('Открыть бронирования'),
      testId: 'today-attention-unconfirmed',
    },
    m.noShow > 0 && {
      text: t('Не пришли: {n}', { n: m.noShow }),
      href: reservationsHref,
      action: t('Открыть бронирования'),
      testId: 'today-attention-no-show',
    },
  ].filter((a): a is Exclude<typeof a, false> => Boolean(a));
  const hourly = report.hourlyRevenueMinor.map((v) => Number(BigInt(v) / 100n));
  const hourLabels = report.hourlyRevenueMinor.map(
    (_, h) => `${String(h).padStart(2, '0')}:00`,
  );
  const clock = (iso: string) => localInput(iso, branch.timezone).slice(11, 16);
  const expectedGuests = coming.reduce((acc, r) => acc + r.partySize, 0);
  const seatedGuests = coming
    .filter((r) => r.status === 'SEATED')
    .reduce((acc, r) => acc + r.partySize, 0);
  const freeTables = tiles.tablesTotal - tiles.tablesOccupied;
  return (
    <Page
      // шапка по эталону салона (решение владельца 25.10.2026): «Главная», филиал с датой, главное действие справа
      title={t('Главная')}
      subtitle={`${branch.name}, ${fullDay(date, locale)}`}
      actions={
        <Link className="btn btn--primary" href="/table-reservations?new=1">
          {t('+ Новая бронь')}
        </Link>
      }
    >
      <div className="rest-dash" data-testid="food-today">
        <FoodTodayTotals
          planned={m.planned}
          expectedGuests={expectedGuests}
          seatedGuests={seatedGuests}
          freeTables={freeTables}
          tablesTotal={tiles.tablesTotal}
          revenueMinor={tiles.revenueMinor}
          currency={report.currency}
          revenueDeltaPct={tiles.revenueDeltaPct}
          t={t}
        />
        <div className="rest-dash-main">
          <Panel>
            <div className="food-section-heading">
              <h2>{t('Ближайшие бронирования')}</h2>
              <Link href={reservationsHref}>{t('Все брони')}</Link>
            </div>
            {m.upcoming.length === 0 ? (
              <p className="muted">{t('Броней впереди на сегодня нет.')}</p>
            ) : (
              <table className="rest-upcoming" data-testid="today-upcoming">
                <caption className="sr-only">{t('Ближайшие брони сегодня')}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{t('Время')}</th>
                    <th scope="col">{t('Гость')}</th>
                    <th scope="col">{t('Гостей')}</th>
                    <th scope="col">{t('Стол')}</th>
                    <th scope="col">{t('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {m.upcoming.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <time dateTime={u.startsAt}>{clock(u.startsAt)}</time>
                      </td>
                      <th scope="row">{u.guest}</th>
                      <td className="muted">{pluralRu(u.partySize, [t('гость'), t('гостя'), t('гостей')])}</td>
                      <td className="muted">{u.table ? tableTitle(u.table, t) : t('Без стола')}</td>
                      <td>
                        <Badge tone={BADGE_TONE[statusTone(foodStatus, u.status)]}>
                          {t(foodStatus[u.status].label)}
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
              <h2>{t('Быстрые действия')}</h2>
              <div className="rest-quick">
                <Link className="btn" href="/table-reservations?new=1">
                  <Icon name="plus" />
                  {t('Новая бронь')}
                </Link>
                <Link className="btn btn--info" href="/floor-plan" aria-label={t('Открыть план зала')}>
                  <Icon name="today" />
                  {t('План зала')}
                </Link>
                <Link className="btn btn--info" href="/customers">
                  <Icon name="search" />
                  {t('Найти гостя')}
                </Link>
                <Link className="btn btn--info" href={reservationsHref}>
                  <Icon name="board" />
                  {t('Расписание броней')}
                </Link>
              </div>
            </Panel>
            {attention.length > 0 && (
              <Panel title={t('Требуют внимания')} aria-label={t('Требуют внимания')}>
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
            <h2>{t('Выручка по часам')}</h2>
            {hourly.some((v) => v > 0) ? (
              <LineChart
                series={[
                  {
                    name: t('Выручка'),
                    values: hourly,
                    summary: wholeTenge(tiles.revenueMinor, report.currency),
                  },
                ]}
                labels={hourLabels}
                format={(v) => wholeTenge(String(Math.round(v) * 100), report.currency)}
                testId="today-revenue-chart"
              />
            ) : (
              <p className="muted">{t('Оплаченных заказов сегодня ещё нет.')}</p>
            )}
          </Panel>
          <Panel>
            <div className="food-section-heading">
              <h2>
                {t('Последние заказы')} <small data-testid="today-orders">{tiles.ordersCount}</small>
              </h2>
              <Link href="/orders">{t('Все заказы')}</Link>
            </div>
            {report.latestOrders.length === 0 ? (
              <EmptyState title={t('Заказов сегодня ещё нет')} />
            ) : (
              <div className="rest-latest" data-testid="today-latest-orders">
                {report.latestOrders.map((o) => (
                  <div className="rest-latest-row" key={o.id}>
                    <strong>{o.table ? tableTitle(o.table.name, t) : t('Заказ №{n}', { n: o.number })}</strong>
                    <time>{clock(o.openedAt)}</time>
                    <span className="rest-latest-sum">
                      <strong>{wholeTenge(o.totalMinor, o.currency)}</strong>
                      <Badge tone={BADGE_TONE[statusTone(foodOrderStatus, o.status)]}>
                        {t(statusLabel(foodOrderStatus, o.status))}
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
