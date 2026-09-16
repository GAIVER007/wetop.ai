import Link from 'next/link';
import type { DashboardPeriod } from '@pms/domain';
import { Panel, Table, cx } from '../../components/ui';
import {
  METHOD_RU,
  formatInt,
  formatPercent,
  sourceLabel,
  wholeTenge,
} from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';

const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const weekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

/** Столбики загрузки по дням; на один день — полосы по категориям. Только CSS, без библиотек графиков. */
export function OccupancyChart({ period, today }: { period: DashboardPeriod; today: string }) {
  if (period.nights === 1) {
    return (
      <Panel title="Загрузка по категориям" className="dash-panel">
        <ul className="hbars" data-testid="chart-categories">
          {period.categories.map((c) => (
            <li key={c.code}>
              <span className="hbars__label">{c.name}</span>
              <span className="hbars__track">
                <i style={{ width: `${c.percent}%` }} />
              </span>
              <span className="hbars__value">
                {c.occupiedNights} из {c.units} · {formatPercent(c.percent)}
              </span>
            </li>
          ))}
        </ul>
        <Link href={`/chessboard?from=${period.from}&to=${period.to}`} className="dash-panel__link">
          Открыть шахматку на этот день
        </Link>
      </Panel>
    );
  }
  const dense = period.daily.length > 31;
  const max = Math.max(...period.daily.map((d) => d.percent), 1);
  return (
    <Panel title="Загрузка по дням" className="dash-panel">
      <div className="bars-meta">
        <span>
          в среднем <strong>{formatPercent(period.occupancy.percent)}</strong>
        </span>
        <span>
          пик <strong>{formatPercent(max)}</strong>
        </span>
        <span>
          заезды <strong>{formatInt(period.arrivals.count)}</strong> · выезды{' '}
          <strong>{formatInt(period.departures.count)}</strong>
        </span>
      </div>
      <div className={cx('bars', dense && 'bars--dense')} data-testid="chart-daily">
        {period.daily.map((d, i) => (
          <div
            key={d.date}
            className={cx(
              'bar',
              d.date === today && 'is-today',
              d.date > today && 'is-future',
              weekend(d.date) && 'is-weekend',
            )}
            title={`${displayDate(d.date, 'full')}: ${formatPercent(d.percent)} · занято ${d.occupied}, свободно ${d.free}${
              d.blocked ? `, закрыто ${d.blocked}` : ''
            } · заезды ${d.arrivals}, выезды ${d.departures}`}
          >
            <i style={{ height: `${d.percent}%` }} />
            <span>
              {!dense || i === 0 || dayOfMonth(d.date) % 5 === 0 ? dayOfMonth(d.date) : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="bars-legend muted">
        <span>
          <i className="bars-legend__past" /> прошедшие дни
        </span>
        <span>
          <i className="bars-legend__future" /> будущие (по броням)
        </span>
        <Link href={`/chessboard?from=${period.from}&to=${period.to}`}>Открыть шахматку</Link>
      </div>
    </Panel>
  );
}

export function SourcesPanel({ period }: { period: DashboardPeriod }) {
  return (
    <Panel title="Источники броней" className="dash-panel">
      {period.sources.length === 0 ? (
        <p className="muted dash-empty">Заездов за период нет.</p>
      ) : (
        <ul className="sources" data-testid="sources">
          {period.sources.map((s) => (
            <li key={`${s.source}|${s.channel ?? ''}`}>
              <span className="sources__label">{sourceLabel(s.source, s.channel)}</span>
              <span className="sources__count">{formatInt(s.count)}</span>
              <span className="sources__track">
                <i style={{ width: `${s.share}%` }} />
              </span>
              <span className="sources__share">{formatPercent(s.share)}</span>
              <span className="sources__amount">{wholeTenge(s.amountMinor)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted dash-note">По дате заезда, без отменённых и незаездов. Сумма — стоимость броней.</p>
    </Panel>
  );
}

export function CategoriesPanel({ period }: { period: DashboardPeriod }) {
  return (
    <Panel title="По категориям" className="dash-panel dash-panel--table">
      <Table className="dash-table" nowrap data-testid="categories-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th>Загрузка</th>
            <th className="num">Ночей продано</th>
            <th className="num">Выручка</th>
            <th className="num">Средняя ночь</th>
          </tr>
        </thead>
        <tbody>
          {period.categories.map((c) => (
            <tr key={c.code}>
              <td className="dash-table__name">
                {c.name}
                <div className="muted">{pluralRu(c.units, ['место', 'места', 'мест'])}</div>
              </td>
              <td>
                <span className="occupancy-meter">
                  <meter
                    min="0"
                    max="100"
                    value={c.percent}
                    aria-label={`Загрузка ${formatPercent(c.percent)}`}
                  />
                  <span>{formatPercent(c.percent)}</span>
                </span>
              </td>
              <td className="num" title={`из ${formatInt(c.unitNights)} возможных`}>
                {formatInt(c.occupiedNights)}
              </td>
              <td className="num">{wholeTenge(c.revenueMinor)}</td>
              <td className="num">{c.adrMinor ? wholeTenge(c.adrMinor) : '—'}</td>
            </tr>
          ))}
          {!period.categories.length && (
            <tr>
              <td colSpan={5} className="muted">
                Нет категорий.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Panel>
  );
}

export function PaymentsPanel({ period }: { period: DashboardPeriod }) {
  const rows = period.payments.byMethod;
  return (
    <Panel title="Оплаты по способам" className="dash-panel dash-panel--table">
      <Table className="dash-table" nowrap data-testid="payments-table">
        <thead>
          <tr>
            <th>Способ</th>
            <th className="num">Платежей</th>
            <th className="num">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.method}>
              <td>{METHOD_RU[r.method] ?? r.method}</td>
              <td className="num">{formatInt(r.count)}</td>
              <td className="num">{wholeTenge(r.amountMinor)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="muted">
                Платежей за период нет.
              </td>
            </tr>
          )}
          {BigInt(period.refundsMinor) > 0n && (
            <tr>
              <td>Возвраты</td>
              <td />
              <td className="num danger-text">−{wholeTenge(period.refundsMinor)}</td>
            </tr>
          )}
        </tbody>
      </Table>
      <Link href={`/finance?from=${period.from}&to=${period.to}`} className="dash-panel__link">
        Деньги за период подробно
      </Link>
    </Panel>
  );
}
