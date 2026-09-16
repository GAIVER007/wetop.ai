import type { DashboardPeriod } from '@pms/domain';
import { Icon, type IconName } from '../../components/icon';
import { cx } from '../../components/ui';
import {
  deltaPercent,
  deltaPoints,
  formatInt,
  formatPercent,
  wholeTenge,
  type Delta,
} from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';

function DeltaMark({ delta }: { delta: Delta }) {
  if (!delta.direction) return <span className="kpi-delta kpi-delta--none">{delta.text}</span>;
  return (
    <span className={cx('kpi-delta', `kpi-delta--${delta.direction}`)}>
      {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}{' '}
      {delta.text.replace(/^[+−]/, '')}
    </span>
  );
}

function Card({
  id,
  icon,
  label,
  value,
  hint,
  delta,
}: {
  id: string;
  icon: IconName | React.ReactNode;
  label: string;
  value: string;
  hint: string;
  delta: Delta;
}) {
  return (
    <article className={`kpi kpi--${id}`}>
      <div className="kpi__top">
        <span>{label}</span>
        {typeof icon === 'string' ? (
          <span className="kpi__icon">
            <Icon name={icon as IconName} width={16} height={16} />
          </span>
        ) : (
          icon
        )}
      </div>
      <div className="kpi__body">
        <strong className="kpi__value" data-testid={`kpi-${id}`}>
          {value}
        </strong>
      </div>
      <div className="kpi__hint">{hint}</div>
      <DeltaMark delta={delta} />
    </article>
  );
}

/** Шесть показателей периода и сравнение с предыдущим таким же отрезком. Все числа — из API, как есть. */
export function KpiGrid({ current, previous }: { current: DashboardPeriod; previous: DashboardPeriod }) {
  const c = current;
  const p = previous;
  const single = c.nights === 1;
  const b = (v: string) => BigInt(v);
  return (
    <>
      <section className="kpi-grid" aria-label="Показатели за период">
        <Card
          id="occupancy"
          icon={
            <div
              className="occupancy-ring occupancy-ring--mini"
              style={{
                background: `conic-gradient(var(--primary) ${c.occupancy.percent}%, var(--border-soft) 0)`,
              }}
              role="img"
              aria-label={`Занято ${formatPercent(c.occupancy.percent)}`}
            >
              <div />
            </div>
          }
          label="Загрузка"
          value={formatPercent(c.occupancy.percent)}
          hint={
            single
              ? `занято ${c.occupancy.occupiedNights} из ${c.units} мест`
              : `${formatInt(c.occupancy.occupiedNights)} из ${formatInt(c.occupancy.unitNights)} ночей продано`
          }
          delta={deltaPoints(c.occupancy.percent, p.occupancy.percent)}
        />
        <Card
          id="revenue"
          icon="money"
          label="Выручка (начислено)"
          value={wholeTenge(c.revenue.totalMinor)}
          hint={`проживание ${wholeTenge(c.revenue.accommodationMinor)}${
            b(c.revenue.servicesMinor) + b(c.revenue.penaltiesMinor) + b(c.revenue.adjustmentsMinor) !== 0n
              ? ` · услуги и штрафы ${wholeTenge(
                  (
                    b(c.revenue.servicesMinor) +
                    b(c.revenue.penaltiesMinor) +
                    b(c.revenue.adjustmentsMinor)
                  ).toString(),
                )}`
              : ''
          }`}
          delta={deltaPercent(b(c.revenue.totalMinor), b(p.revenue.totalMinor))}
        />
        <Card
          id="paid"
          icon="receipt"
          label="Получено оплат"
          value={wholeTenge(c.payments.totalMinor)}
          hint={`${pluralRu(c.payments.count, ['платёж', 'платежа', 'платежей'])}${
            b(c.refundsMinor) > 0n ? ` · возвраты ${wholeTenge(c.refundsMinor)}` : ''
          }`}
          delta={deltaPercent(b(c.payments.totalMinor), b(p.payments.totalMinor))}
        />
        <Card
          id="adr"
          icon="rates"
          label="Средняя цена ночи"
          value={c.adrMinor ? wholeTenge(c.adrMinor) : '—'}
          hint="начислено за проживание на проданную ночь"
          delta={
            c.adrMinor && p.adrMinor
              ? deltaPercent(b(c.adrMinor), b(p.adrMinor))
              : { direction: null, text: 'нет базы для сравнения' }
          }
        />
        <Card
          id="revpar"
          icon="inventory"
          label="Доход на место"
          value={c.revparMinor ? wholeTenge(c.revparMinor) : '—'}
          hint="за ночь на каждую единицу продажи (RevPAR)"
          delta={
            c.revparMinor && p.revparMinor
              ? deltaPercent(b(c.revparMinor), b(p.revparMinor))
              : { direction: null, text: 'нет базы для сравнения' }
          }
        />
        <Card
          id="arrivals"
          icon="arrival"
          label="Заезды"
          value={formatInt(c.arrivals.count)}
          hint={`${pluralRu(c.arrivals.guests, ['гость', 'гостя', 'гостей'])} · выезды ${c.departures.count}${
            c.arrivals.cancelled ? ` · отмен ${c.arrivals.cancelled}` : ''
          }${c.arrivals.noShow ? ` · незаездов ${c.arrivals.noShow}` : ''}`}
          delta={deltaPercent(c.arrivals.count, p.arrivals.count)}
        />
      </section>
      <p className="kpi-compare muted" data-testid="kpi-compare">
        Сравнение с предыдущим периодом: {displayDate(p.from)}
        {p.from !== p.to && ` — ${displayDate(p.to)}`}
        {c.unassigned > 0 && (
          <>
            {' '}
            · без ячейки {pluralRu(c.unassigned, ['проживание', 'проживания', 'проживаний'])} — в
            загрузку не входят
          </>
        )}
      </p>
    </>
  );
}
