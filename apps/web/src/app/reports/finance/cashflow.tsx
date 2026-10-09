import Link from 'next/link';
import { ApiError, financeApi, type PeriodCashFlow } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { LoadError } from '../../../components/load-error';
import { Alert, EmptyState, Panel, Skeleton, Table } from '../../../components/ui';
import { ShareBar } from '../../../components/share-bar';
import { displayDate } from '../../../lib/display-date';
import { formatMoney } from '../../../lib/money';
import type { AnalyticsQuery } from '../../management/analytics/params';
import { NO_BASE, Tile } from '../../management/analytics/tiles';

const b = (v: string) => BigInt(v);

/**
 * «Отчёты → Финансы» (RPT2.4a, ADR-155, `docs/metrics.md` §2): поступления, возвраты, чистые поступления, приход и
 * расходы кассы и денежный поток, каждый своей формулой и по дате операции в сутках объекта. Начисления и долги живут
 * на «Оплатах» и в «Документах»: здесь их нет, чтобы разные показатели не смешивались. Источник один: общая лента денег.
 */
export async function CashFlowReport({ query }: { query: AnalyticsQuery }) {
  const { period } = query;
  const data = await financeApi
    .cashflow(period.from, period.to)
    .catch((error: unknown) => (error instanceof ApiError ? error : Promise.reject(error)));
  if (data instanceof ApiError) return <LoadError testId="cf-error" {...loadErrorProps(data)} />;
  const money = (v: string) => formatMoney(v, data.currency);
  const t = data.totals;
  const empty = data.days.every(
    (d) =>
      d.receiptsMinor === '0' &&
      d.refundsMinor === '0' &&
      d.incomeMinor === '0' &&
      d.expenseMinor === '0',
  );
  return (
    <>
      {data.truncated && (
        <Alert boxed>
          Операций за период больше, чем отдаёт отчёт: итоги неполные. Выберите период покороче.
        </Alert>
      )}
      <section className="kpi-grid pa-kpis" aria-label="Деньги за период" data-testid="cf-kpis">
        <Tile
          id="cf-receipts"
          label="Поступления"
          value={money(t.receiptsMinor)}
          hint={`в кассе ${money(t.receiptsCashMinor)}, вне кассы ${money(t.receiptsOffCashMinor)}`}
          delta={NO_BASE}
          compare={false}
        />
        <Tile
          id="cf-refunds"
          label="Возвраты"
          value={money(t.refundsMinor)}
          hint={`из кассы ${money(t.refundsCashMinor)}`}
          delta={NO_BASE}
          compare={false}
        />
        <Tile
          id="cf-net"
          label="Чистые поступления"
          value={money(t.netReceiptsMinor)}
          hint="поступления минус возвраты"
          delta={NO_BASE}
          compare={false}
        />
        <Tile
          id="cf-income"
          label="Приход кассы"
          value={money(t.incomeMinor)}
          hint="поступления мимо броней"
          delta={NO_BASE}
          compare={false}
        />
        <Tile
          id="cf-expense"
          label="Расходы"
          value={money(t.expenseMinor)}
          hint="расходы кассы, комиссии в их числе"
          delta={NO_BASE}
          compare={false}
        />
        <Tile
          id="cf-flow"
          label="Денежный поток"
          value={money(t.cashFlowMinor)}
          hint="по кассе: оплаты в кассу минус возвраты плюс приход минус расходы"
          delta={NO_BASE}
          compare={false}
        />
      </section>
      <p className="muted dash-note" data-testid="cf-basis">
        По дате операции в сутках объекта. Оплаты вне кассы (площадка, депозит, гарантия картой)
        входят в поступления и не входят в денежный поток. Переводы между кассами в потоке не
        показаны. Начисления и долги это другие показатели: <Link href="/finance">«Оплаты»</Link>,{' '}
        <Link href="/reports">«Документы»</Link>.
      </p>
      {empty ? (
        <EmptyState data-testid="cf-empty" title="За период нет денежных операций">
          Выберите другой период: в этом нет ни оплат, ни возвратов, ни операций кассы.
        </EmptyState>
      ) : (
        <div className="pa-cashflow">
          <DaysTable data={data} />
          <ExpensesPanel data={data} />
        </div>
      )}
    </>
  );
}

function DaysTable({ data }: { data: PeriodCashFlow }) {
  const money = (v: string) => formatMoney(v, data.currency);
  const t = data.totals;
  return (
    <Panel title="По дням" className="dash-panel dash-panel--table">
      <Table className="dash-table" nowrap data-testid="cf-days">
        <thead>
          <tr>
            <th>День</th>
            <th className="num">Поступления</th>
            <th className="num">Возвраты</th>
            <th className="num">Чистые</th>
            <th className="num">Приход кассы</th>
            <th className="num">Расходы</th>
            <th className="num">Поток</th>
          </tr>
        </thead>
        <tbody>
          {data.days.map((d) => (
            <tr key={d.date}>
              <td>{displayDate(d.date)}</td>
              <td className="num">{money(d.receiptsMinor)}</td>
              <td className="num">{money(d.refundsMinor)}</td>
              <td className="num">{money(d.netReceiptsMinor)}</td>
              <td className="num">{money(d.incomeMinor)}</td>
              <td className="num">{money(d.expenseMinor)}</td>
              <td className="num">{money(d.cashFlowMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr data-testid="cf-total">
            <th>Итого</th>
            <td className="num">{money(t.receiptsMinor)}</td>
            <td className="num">{money(t.refundsMinor)}</td>
            <td className="num">{money(t.netReceiptsMinor)}</td>
            <td className="num">{money(t.incomeMinor)}</td>
            <td className="num">{money(t.expenseMinor)}</td>
            <td className="num">{money(t.cashFlowMinor)}</td>
          </tr>
        </tfoot>
      </Table>
    </Panel>
  );
}

function ExpensesPanel({ data }: { data: PeriodCashFlow }) {
  const money = (v: string) => formatMoney(v, data.currency);
  const total = b(data.totals.expenseMinor);
  return (
    <Panel title="Расходы по статьям" className="dash-panel">
      {data.expensesByCategory.length === 0 ? (
        <p className="muted" data-testid="cf-no-expenses">
          Расходов за период не было.
        </p>
      ) : (
        <ul className="pa-expenses" data-testid="cf-expenses">
          {data.expensesByCategory.map((x) => (
            <li key={x.category}>
              <span>{x.category}</span>
              <ShareBar
                label={`${x.category}: доля расходов`}
                value={Number((b(x.amountMinor) * 1000n) / (total || 1n))}
                max={1000}
              />
              <strong>{money(x.amountMinor)}</strong>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function CashFlowSkeleton() {
  return (
    <div className="pa-skeleton" aria-busy="true" data-testid="cf-loading">
      <div className="kpi-grid pa-kpis">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="stat" />
        ))}
      </div>
      <Skeleton className="pa-skeleton__chart" />
      <span className="sr-only" role="status">
        Считаем деньги за период…
      </span>
    </div>
  );
}
