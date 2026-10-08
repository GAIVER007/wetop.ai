import { summarizeBranches } from '../../lib/branch-summary';
import { branchesApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Panel, Table } from '../../components/ui';
export async function BranchOverview({ from, to }: { from: string; to: string }) {
  const { rows } = await branchesApi.overview(from, to);
  const { guests, percent, currencies } = summarizeBranches(rows);
  return (
    <Panel>
      <h2>Сводка по гостиничным филиалам</h2>
      <p>
        {rows.length} гостиничных филиалов, {guests} гостей в заездах, загрузка{' '}
        {percent}%
      </p>
      {[...currencies].map(([currency, total]) => (
        <p key={currency}>
          <strong>{currency}</strong>: начислено {formatMoney(total.revenue, currency)}, поступило{' '}
          {formatMoney(total.paid, currency)}, возвраты {formatMoney(total.refunded, currency)}
        </p>
      ))}
      <Table dense aria-label="Статистика по филиалам">
        <caption>
          Статистика за {from} → {to}
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
