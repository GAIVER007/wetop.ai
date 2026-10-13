import type { OrganizationSummary, OrganizationMoney } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
const amounts = (
  rows: OrganizationMoney[],
  field: 'receiptsMinor' | 'expensesMinor' | 'averageMinor',
) =>
  rows.length
    ? rows
        .map((row) =>
          row[field] === null ? 'Не определён' : formatMoney(row[field]!, row.currency),
        )
        .join(' / ')
    : 'Нет данных';
export function FinancialWidgets({ summary }: { summary: OrganizationSummary | null | undefined }) {
  return (
    <>
      <div className="org-kpis org-financial-kpis">
        <div>
          <span className="org-symbol">
            <Icon name="money" />
          </span>
          <section>
            <p>Выручка (оплаты)</p>
            <strong className="org-money">
              {amounts(summary?.currencies ?? [], 'receiptsMinor')}
            </strong>
            <small>Оплаты за выбранный месяц</small>
          </section>
        </div>
        <div>
          <span className="org-symbol purple">
            <Icon name="booking" />
          </span>
          <section>
            <p>Оплаченные заказы</p>
            <strong>{summary ? summary.orders : 'Нет данных'}</strong>
            <small>Бронирования и заказы</small>
          </section>
        </div>
        <div>
          <span className="org-symbol coral">
            <Icon name="rates" />
          </span>
          <section>
            <p>Средний чек</p>
            <strong className="org-money">
              {amounts(summary?.currencies ?? [], 'averageMinor')}
            </strong>
            <small>Оплаты / число заказов</small>
          </section>
        </div>
        <div>
          <span className="org-symbol teal">
            <Icon name="inventory" />
          </span>
          <section>
            <p>Расходы</p>
            <strong className="org-money">
              {amounts(summary?.currencies ?? [], 'expensesMinor')}
            </strong>
            <small>Включая выплаты зарплат</small>
          </section>
        </div>
      </div>
      {!summary ? (
        <p className="org-finance-coverage" role="status">
          Финансовая сводка сейчас недоступна. Суммы не заменяются примерными значениями.
        </p>
      ) : !summary.complete ? (
        <p className="org-finance-coverage" role="status">
          Неполная сводка: данные доступны по {summary.covered} из {summary.total} объектов.{' '}
          {summary.rows
            .filter((row) => row.state !== 'READY')
            .map(
              (row) =>
                `${row.name}: ${row.state === 'UNAVAILABLE' ? 'учёт оплат не подключён' : 'отчёт недоступен'}`,
            )
            .join('; ')}
          .
        </p>
      ) : (
        <p className="org-finance-coverage">
          Все доступные объекты, включая архивные. Валюты показаны раздельно.
        </p>
      )}
    </>
  );
}
export function BusinessFinancialWidgets({
  summary,
  businessId,
}: {
  summary: OrganizationSummary | null | undefined;
  businessId: string;
}) {
  const rows = summary?.rows.filter((row) => row.businessId === businessId) ?? [];
  if (!rows.length || rows.some((row) => row.state !== 'READY'))
    return (
      <p className="org-finance-unavailable">
        {rows.some((row) => row.state === 'UNAVAILABLE')
          ? 'Учёт оплат не подключён'
          : 'Финансовые данные сейчас недоступны'}
      </p>
    );
  const currencies = new Map<
    string,
    { received: bigint; expenses: bigint; orders: number; known: boolean }
  >();
  for (const row of rows)
    for (const c of row.currencies) {
      const sum = currencies.get(c.currency) ?? {
        received: 0n,
        expenses: 0n,
        orders: 0,
        known: true,
      };
      sum.received += BigInt(c.receiptsMinor);
      sum.expenses += BigInt(c.expensesMinor);
      sum.orders += c.orders;
      sum.known =
        sum.known && (c.orders === 0 ? BigInt(c.receiptsMinor) === 0n : c.averageMinor !== null);
      currencies.set(c.currency, sum);
    }
  const values = [...currencies].map(([currency, sum]) => ({
    currency,
    receiptsMinor: sum.received.toString(),
    expensesMinor: sum.expenses.toString(),
    orders: sum.orders,
    averageMinor: sum.known && sum.orders ? (sum.received / BigInt(sum.orders)).toString() : null,
  }));
  return (
    <div className="org-business-finance">
      <div>
        <strong>{amounts(values, 'receiptsMinor')}</strong>
        <small>Оплаты</small>
      </div>
      <div>
        <strong>{rows.reduce((n, row) => n + row.orders, 0)}</strong>
        <small>Заказы</small>
      </div>
      <div>
        <strong>{amounts(values, 'averageMinor')}</strong>
        <small>Средний чек</small>
      </div>
      <div>
        <strong>{amounts(values, 'expensesMinor')}</strong>
        <small>Расходы</small>
      </div>
    </div>
  );
}
