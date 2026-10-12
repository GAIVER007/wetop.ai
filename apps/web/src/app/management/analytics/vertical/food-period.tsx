import { Panel, Stat, Stats, Table } from '../../../../components/ui';
import { METHOD_RU, wholeTenge } from '../../../../lib/dashboard-format';
import type { FoodPeriodReport } from '../../../../lib/food-types';

/** Деньги ресторана за период: закрытые заказы, оплаты по способам (касса §35), блюда и официанты */
export function FoodPeriodPanel({ report }: { report: FoodPeriodReport }) {
  const money = (minor: string) => wholeTenge(minor, report.currency);
  const table = (heads: string[], rows: Array<Array<string | number>>, empty: string) =>
    rows.length === 0 ? (
      // не EmptyState: его заголовок h3 под панелью ломает порядок заголовков (axe heading-order)
      <p className="muted">{empty}</p>
    ) : (
      <Table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
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
      <Stats min={160} aria-label="Деньги за период">
        <Stat label="Выручка" value={money(report.revenueMinor)} hint="закрытые заказы" testId="food-period-revenue" />
        <Stat label="Заказов" value={report.ordersCount} testId="food-period-orders" />
        <Stat
          label="Средний чек"
          value={report.averageCheckMinor === null ? '—' : money(report.averageCheckMinor)}
          testId="food-period-check"
        />
        <Stat
          label="Себестоимость"
          value={money(report.costMinor)}
          hint="списано со склада по заказам"
          testId="food-period-cost"
        />
        <Stat label="Валовая прибыль" value={money(report.grossProfitMinor)} testId="food-period-profit" />
        <Stat
          label="Фудкост"
          value={report.foodCostPct === null ? '—' : `${report.foodCostPct} %`}
          testId="food-period-foodcost"
        />
      </Stats>
      <Panel title="Оплаты по способам">
        {table(
          ['Способ', 'Платежей', 'Сумма'],
          report.payments.map((p) => [METHOD_RU[p.method] ?? p.method, p.count, money(p.amountMinor)]),
          'Оплат за период нет',
        )}
      </Panel>
      <Panel title="Популярные блюда">
        {table(
          ['Блюдо', 'Порций', 'Выручка'],
          report.topDishes.map((d) => [d.name, d.qty, money(d.revenueMinor)]),
          'Закрытых заказов за период нет',
        )}
      </Panel>
      <Panel title="Недостачи по заказам">
        {table(
          ['Ингредиент', 'Не хватило'],
          report.shortages.map((x) => [x.name, `${x.qty} ${x.unit}`]),
          'Недостач за период нет',
        )}
      </Panel>
      <Panel title="Официанты">
        {table(
          ['Официант', 'Заказов', 'Выручка'],
          report.waiters.map((w) => [w.name, w.orders, money(w.revenueMinor)]),
          'Заказов с официантом за период нет',
        )}
      </Panel>
    </div>
  );
}
