import Link from 'next/link';
import type { DashboardPeriod } from '@pms/domain';
import { Panel, Table, cx } from '../../../components/ui';
import {
  METHOD_RU,
  formatInt,
  formatPercent,
  sourceLabel,
  wholeTenge,
} from '../../../lib/dashboard-format';
import { pluralRu } from '../../../lib/plural';
import { DailyBars } from './daily-bars';

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
                {c.occupiedNights} из {c.units}, {formatPercent(c.percent)}
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
          заезды <strong>{formatInt(period.arrivals.count)}</strong>, выезды{' '}
          <strong>{formatInt(period.departures.count)}</strong>
        </span>
      </div>
      <DailyBars days={period.daily} today={today} />
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
      <p className="muted dash-note">
        По дате заезда, без отменённых и незаездов. Сумма — стоимость броней.
      </p>
    </Panel>
  );
}

/**
 * Таблица по категориям. При периоде в один день загрузку по категориям уже рисуют полосы в панели выше —
 * та же колонка здесь была дублем (21.09), поэтому она есть только у периода длиннее дня. На телефоне
 * строка складывается в карточку (`.dash-table--categories`): пять колонок в 390 px уезжали в прокрутку
 * без признака, и видны были только категория и загрузка.
 */
export function CategoriesPanel({ period }: { period: DashboardPeriod }) {
  const withOccupancy = period.nights > 1;
  const columns = withOccupancy ? 5 : 4;
  return (
    <Panel title="По категориям" className="dash-panel dash-panel--table">
      <Table
        className={cx('dash-table', 'dash-table--categories', withOccupancy && 'has-occupancy')}
        nowrap
        data-testid="categories-table"
      >
        <thead>
          <tr>
            <th>Категория</th>
            {withOccupancy && <th>Загрузка</th>}
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
              {withOccupancy && (
                <td className="dash-table__occupancy">
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
              )}
              {/* «из N» — в ячейке, а не в `title`: подсказку по наведению не открыть касанием (§15) */}
              <td className="num">
                <span className="dash-cell-word">ночей </span>
                {formatInt(c.occupiedNights)}
                <span className="muted"> из {formatInt(c.unitNights)}</span>
              </td>
              <td className="num">
                <span className="dash-cell-word">выручка </span>
                {wholeTenge(c.revenueMinor)}
              </td>
              <td className="num">
                <span className="dash-cell-word">средняя ночь </span>
                {c.adrMinor ? wholeTenge(c.adrMinor) : '—'}
              </td>
            </tr>
          ))}
          {!period.categories.length && (
            <tr>
              <td colSpan={columns} className="muted">
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
              {/* Пустое говорит, что пусто, и предлагает действие (DESIGN.md §14, разбор 20.09) */}
              <td colSpan={3} className="muted">
                Платежей за период нет.{' '}
                <Link href="/reservations?status=CHECKED_IN">Найти бронь для оплаты</Link>
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
        Финансы за период подробно
      </Link>
    </Panel>
  );
}
