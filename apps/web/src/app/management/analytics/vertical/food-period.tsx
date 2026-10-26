import { Panel, Table } from '../../../../components/ui';
import { DayBars } from '../../../../components/day-bars';
import { DonutShare } from '../../../../components/donut-share';
import { METHOD_RU, deltaPoints, wholeTenge } from '../../../../lib/dashboard-format';
import type { FoodPeriodReport } from '../../../../lib/food-types';
import { DeltaMark, Tile, countDelta, moneyDelta, NO_BASE } from '../tiles';
import { msg, translator, type Translate } from '../../../../i18n';
import { Facts, InsightsPanel, ShareList } from './pult-view';
import { foodInsights } from './pult';

/** Фудкост в процентных пунктах, как у долей на «Обзоре» */
const foodCostDelta = (now: number, was: number) => deltaPoints(now, was);

const TONES = {
  BOOKED: 'info',
  CONFIRMED: 'info',
  SEATED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
} as const;

/**
 * Пульт ресторана (вариант A, решение владельца 25.10.2026), раньше «продажи за период» строкой и столбик панелей.
 * Плитки: выручка, средний чек, заказы и гости, фудкост. Рядом с графиком подсказки, ниже брони, оплаты, категории,
 * блюда, официанты и недостачи. `data-testid` прежних цифр сохранены (`food-period-*`).
 */
export function FoodPeriodPanel({
  report,
  previous = null,
  counts = null,
  labels = null,
  pay = null,
  t = translator('ru'),
}: {
  report: FoodPeriodReport;
  /** тот же отчёт за прошлый отрезок: сравнение плиток; null, если не загрузился */
  previous?: FoodPeriodReport | null;
  /** брони по статусам за период */
  counts?: Record<string, number> | null;
  labels?: Record<string, string> | null;
  /** ЗП официанта за месяц из «Зарплаты» (итого начислено); null: прочерк (владелец 26.10.2026, как у мастеров) */
  pay?: Map<string, string> | null;
  t?: Translate;
}) {
  const money = (minor: string) => wholeTenge(minor, report.currency);
  const compare = previous !== null;
  const base = previous ?? report;
  const statusTotal = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const days = report.revenueByDay ?? [];
  const maxDay = days.reduce(
    (m, d) => (BigInt(d.revenueMinor) > m ? BigInt(d.revenueMinor) : m),
    0n,
  );
  const table = (heads: string[], rows: Array<Array<string | number>>, empty: string) =>
    rows.length === 0 ? (
      <p className="pult-empty">{t(empty)}</p>
    ) : (
      <Table>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th key={h} className={i ? 'num' : undefined}>
                {t(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n}>
              {r.map((c, i) => (
                <td key={i} className={i ? 'num' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <div className="pult vertical-food" data-testid="food-period">
      <section className="kpi-grid" aria-label={t('Главные цифры периода')}>
        <article className="kpi kpi--revenue">
          <div className="kpi__top">
            <span>{t('Выручка')}</span>
          </div>
          <div className="kpi__body">
            <strong className="kpi__value" data-testid="food-period-revenue">
              {money(report.revenueMinor)}
            </strong>
          </div>
          <div className="kpi__hint">
            {t('закрытые заказы, из них бар')}{' '}
            <span data-testid="food-period-bar-revenue">
              {money(report.barRevenueMinor ?? '0')}
            </span>
          </div>
          {compare && <DeltaMark delta={moneyDelta(report.revenueMinor, base.revenueMinor)} />}
        </article>
        <article className="kpi kpi--average">
          <div className="kpi__top">
            <span>{t('Средний чек')}</span>
          </div>
          <div className="kpi__body">
            <strong className="kpi__value" data-testid="food-period-check">
              {report.averageCheckMinor === null ? '—' : money(report.averageCheckMinor)}
            </strong>
          </div>
          <div className="kpi__hint">{t('выручка на один закрытый заказ')}</div>
          {compare && (
            <DeltaMark delta={moneyDelta(report.averageCheckMinor, base.averageCheckMinor)} />
          )}
        </article>
        <article className="kpi kpi--orders">
          <div className="kpi__top">
            <span>{t('Заказов')}</span>
          </div>
          <div className="kpi__body">
            <strong className="kpi__value" data-testid="food-period-orders">
              {report.ordersCount}
            </strong>
          </div>
          <div className="kpi__hint">
            {t('гостей')} <span data-testid="food-period-guests">{report.guestsCount ?? '—'}</span>
          </div>
          {compare && <DeltaMark delta={countDelta(report.ordersCount, base.ordersCount)} />}
        </article>
        <Tile
          id="foodcost"
          label={t('Фудкост')}
          value={report.foodCostPct === null ? '—' : `${report.foodCostPct}%`}
          hint={t('валовая прибыль {sum}', { sum: money(report.grossProfitMinor) })}
          delta={
            report.foodCostPct !== null && base.foodCostPct !== null && previous
              ? foodCostDelta(report.foodCostPct, base.foodCostPct)
              : NO_BASE
          }
          inverse
          compare={compare}
        />
      </section>

      <div className="pult-row pult-row--chart">
        <Panel title={t('Выручка по дням')}>
          {maxDay > 0n ? (
            <DayBars
              testId="food-period-days"
              today={report.to}
              days={days.map((d) => ({
                date: d.date,
                height: Number((BigInt(d.revenueMinor) * 100n) / maxDay),
                facts: t('{sum}, заказов {n}', { sum: money(d.revenueMinor), n: d.orders }),
              }))}
            />
          ) : (
            <p className="pult-empty">{t('Закрытых заказов за период нет')}</p>
          )}
        </Panel>
        <Panel title={t('Оплаты по способам')}>
          <ShareList
            t={t}
            empty={msg('Оплат за период нет')}
            rows={report.payments.map((p) => ({
              key: p.method,
              label: t(METHOD_RU[p.method] ?? p.method),
              value: Number(BigInt(p.amountMinor) / 100n),
              text: money(p.amountMinor),
            }))}
          />
        </Panel>
        <Panel title={t('Себестоимость и прибыль')}>
          <Facts
            rows={[
              {
                label: t('Себестоимость'),
                value: money(report.costMinor),
                testId: 'food-period-cost',
              },
              {
                label: t('Валовая прибыль'),
                value: money(report.grossProfitMinor),
                testId: 'food-period-profit',
              },
              {
                label: t('Фудкост'),
                value: report.foodCostPct === null ? '—' : `${report.foodCostPct} %`,
                testId: 'food-period-foodcost',
              },
            ]}
          />
          <p className="pult-note muted">
            {t('Себестоимость списана со склада по заказам периода.')}
          </p>
        </Panel>
      </div>

      <div className="pult-row pult-row--lists">
        <Panel title={t('Популярные блюда')}>
          {table(
            [msg('Блюдо'), msg('Порций'), msg('Выручка')],
            report.topDishes.map((d) => [d.name, d.qty, money(d.revenueMinor)]),
            msg('Закрытых заказов за период нет'),
          )}
        </Panel>
        {report.categories && (
          <Panel title={t('Продажи по категориям')}>
            {report.categories.length ? (
              <DonutShare
                testId="food-period-categories"
                items={report.categories.map((c) => ({
                  label: c.name,
                  valueMinor: c.revenueMinor,
                }))}
                centerLabel={t('выручка')}
                centerValue={money(report.revenueMinor)}
                amount={money}
              />
            ) : (
              <p className="pult-empty">{t('Закрытых заказов за период нет')}</p>
            )}
          </Panel>
        )}
        <div className="pult-stack">
          <InsightsPanel items={foodInsights(report, counts ?? {})} money={money} t={t} />
          {counts && labels && (
            <Panel
              title={t('{title}, всего {n}', { title: t('Брони по статусам'), n: statusTotal })}
            >
              <ShareList
                t={t}
                empty={msg('Броней за период нет.')}
                rows={Object.entries(labels).map(([status, label]) => ({
                  key: status,
                  label: t(label),
                  value: counts[status] ?? 0,
                  text: counts[status] ?? 0,
                  tone: TONES[status as keyof typeof TONES] ?? 'neutral',
                  testId: `period-${status}`,
                }))}
              />
              {statusTotal === 0 && (
                <ul className="sr-only">
                  {Object.keys(labels).map((status) => (
                    <li key={status} data-testid={`period-${status}`}>
                      0
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      <div className="pult-row pult-row--two">
        <Panel title={t('Официанты')}>
          {table(
            [msg('Официант'), msg('Заказов'), msg('Выручка'), msg('ЗП')],
            report.waiters.map((w) => {
              const paid = w.waiterId ? pay?.get(w.waiterId) : undefined;
              return [w.name, w.orders, money(w.revenueMinor), paid !== undefined ? money(paid) : '—'];
            }),
            msg('Заказов с официантом за период нет'),
          )}
        </Panel>
        <Panel title={t('Недостачи по заказам')}>
          {table(
            [msg('Ингредиент'), msg('Не хватило')],
            report.shortages.map((x) => [x.name, `${x.qty} ${x.unit}`]),
            msg('Недостач за период нет'),
          )}
        </Panel>
      </div>
    </div>
  );
}
