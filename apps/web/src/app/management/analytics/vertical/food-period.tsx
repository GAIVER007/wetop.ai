import { Panel, Table } from '../../../../components/ui';
import { DayBars } from '../../../../components/day-bars';
import { DonutShare } from '../../../../components/donut-share';
import { METHOD_RU, wholeTenge } from '../../../../lib/dashboard-format';
import type { FoodPeriodReport } from '../../../../lib/food-types';
import '../../../finance/summary.css';
import { msg, translator, type Translate } from '../../../../i18n';

/** Деньги ресторана за период: закрытые заказы, оплаты по способам (касса §35), блюда и официанты */
export function FoodPeriodPanel({
  report,
  t = translator('ru'),
}: {
  report: FoodPeriodReport;
  t?: Translate;
}) {
  const money = (minor: string) => wholeTenge(minor, report.currency);
  const table = (heads: string[], rows: Array<Array<string | number>>, empty: string) =>
    rows.length === 0 ? (
      // не EmptyState: его заголовок h3 под панелью ломает порядок заголовков (axe heading-order)
      <p className="muted">{t(empty)}</p>
    ) : (
      <Table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <div className="vertical-food" data-testid="food-period">
      {/* итоги периода одной строкой вместо ряда плиток (правило владельца, аудит ресторана 22.10.2026) */}
      <dl className="money-summary" aria-label={t('Продажи за период')}>
        <div>
          <dt>{t('Выручка')}</dt>
          <dd>
            <span data-testid="food-period-revenue">{money(report.revenueMinor)}</span>{' '}
            <span className="muted">{t('закрытые заказы')}</span>
          </dd>
        </div>
        <div>
          <dt>{t('Заказов')}</dt>
          <dd data-testid="food-period-orders">{report.ordersCount}</dd>
        </div>
        <div>
          <dt>{t('Гостей')}</dt>
          <dd data-testid="food-period-guests">{report.guestsCount ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('Средний чек')}</dt>
          <dd data-testid="food-period-check">
            {report.averageCheckMinor === null ? '—' : money(report.averageCheckMinor)}
          </dd>
        </div>
        <div>
          <dt>{t('Выручка бара')}</dt>
          <dd data-testid="food-period-bar-revenue">{money(report.barRevenueMinor ?? '0')}</dd>
        </div>
      </dl>
      {(report.revenueByDay || report.categories) && (
        <div className="vertical-food__charts">
          {report.revenueByDay && (
            <Panel title={t('Выручка по дням')}>
              {report.revenueByDay.some((d) => d.revenueMinor !== '0') ? (
                <DayBars
                  testId="food-period-days"
                  today={report.to}
                  days={(() => {
                    const max = Math.max(...report.revenueByDay.map((d) => Number(d.revenueMinor)));
                    return report.revenueByDay.map((d) => ({
                      date: d.date,
                      height: max > 0 ? Math.round((Number(d.revenueMinor) / max) * 100) : 0,
                      facts: t('{sum}, заказов {n}', { sum: money(d.revenueMinor), n: d.orders }),
                    }));
                  })()}
                />
              ) : (
                <p className="muted">{t('Закрытых заказов за период нет')}</p>
              )}
            </Panel>
          )}
          {report.categories && (
            <Panel title={t('Продажи по категориям')}>
              {report.categories.length ? (
                <DonutShare
                  testId="food-period-categories"
                  items={report.categories.map((c) => ({ label: c.name, valueMinor: c.revenueMinor }))}
                  centerLabel={t('выручка')}
                  centerValue={money(report.revenueMinor)}
                  amount={money}
                />
              ) : (
                <p className="muted">{t('Закрытых заказов за период нет')}</p>
              )}
            </Panel>
          )}
        </div>
      )}
      <Panel title={t('Себестоимость и прибыль')}>
        <dl className="vertical-food__facts">
          <div>
            <dt>{t('Себестоимость')}</dt>
            <dd data-testid="food-period-cost">{money(report.costMinor)}</dd>
          </div>
          <div>
            <dt>{t('Валовая прибыль')}</dt>
            <dd data-testid="food-period-profit">{money(report.grossProfitMinor)}</dd>
          </div>
          <div>
            <dt>{t('Фудкост')}</dt>
            <dd data-testid="food-period-foodcost">
              {report.foodCostPct === null ? '—' : `${report.foodCostPct} %`}
            </dd>
          </div>
        </dl>
        <p className="muted">{t('Себестоимость списана со склада по заказам периода.')}</p>
      </Panel>
      <Panel title={t('Оплаты по способам')}>
        {table(
          [msg('Способ'), msg('Платежей'), msg('Сумма')],
          report.payments.map((p) => [t(METHOD_RU[p.method] ?? p.method), p.count, money(p.amountMinor)]),
          msg('Оплат за период нет'),
        )}
      </Panel>
      <Panel title={t('Популярные блюда')}>
        {table(
          [msg('Блюдо'), msg('Порций'), msg('Выручка')],
          report.topDishes.map((d) => [d.name, d.qty, money(d.revenueMinor)]),
          msg('Закрытых заказов за период нет'),
        )}
      </Panel>
      <Panel title={t('Недостачи по заказам')}>
        {table(
          [msg('Ингредиент'), msg('Не хватило')],
          report.shortages.map((x) => [x.name, `${x.qty} ${x.unit}`]),
          msg('Недостач за период нет'),
        )}
      </Panel>
      <Panel title={t('Официанты')}>
        {table(
          [msg('Официант'), msg('Заказов'), msg('Выручка')],
          report.waiters.map((w) => [w.name, w.orders, money(w.revenueMinor)]),
          msg('Заказов с официантом за период нет'),
        )}
      </Panel>
    </div>
  );
}
