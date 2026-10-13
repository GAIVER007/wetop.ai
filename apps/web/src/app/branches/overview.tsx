import { summarizeBranches } from '../../lib/branch-summary';
import { branchesApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Panel, Table } from '../../components/ui';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
export async function BranchOverview({ from, to }: { from: string; to: string }) {
  const { rows } = await branchesApi.overview(from, to);
  const { guests, percent, currencies } = summarizeBranches(rows);
  // сводка считает гостиничные показатели: у организации из салонов и ресторанов её нет
  if (!rows.length) return null;
  return (
    <Panel>
      <h2>Сводка по гостиницам</h2>
      <p>
        {pluralRu(rows.length, [
          'гостиничный филиал',
          'гостиничных филиала',
          'гостиничных филиалов',
        ])}
        , гостей в заездах: {guests}, загрузка {percent} %
      </p>
      {[...currencies].map(([currency, total]) => (
        <p key={currency}>
          <strong>{currency}</strong>: начислено {formatMoney(total.revenue, currency)}, поступило{' '}
          {formatMoney(total.paid, currency)}, возвраты {formatMoney(total.refunded, currency)}
        </p>
      ))}
      <Table dense aria-label="Статистика по филиалам">
        <caption>
          Статистика с {displayDate(from)} по {displayDate(to)}
        </caption>
        <thead>
          <tr>
            <th>Филиал</th>
            <th>Загрузка</th>
            <th>Гости в заездах</th>
            <th>Начислено</th>
            <th>Поступило</th>
            <th>Возвраты</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ branch, stats }) => (
            <tr key={branch.id}>
              <th scope="row">{branch.name}</th>
              <td>{stats.occupancy.percent}%</td>
              <td>{stats.arrivals.guests}</td>
              <td>{formatMoney(stats.revenue.totalMinor, branch.currency)}</td>
              <td>{formatMoney(stats.payments.totalMinor, branch.currency)}</td>
              <td>{formatMoney(stats.refundsMinor, branch.currency)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="muted">
        Календарные даты считаются по часовому поясу каждого филиала. Гости в заездах могут
        повторяться между филиалами. Начисления и поступления не равны прибыли. Валюты не
        конвертируются. Салоны и рестораны в гостиничную сводку не входят.
      </p>
    </Panel>
  );
}
