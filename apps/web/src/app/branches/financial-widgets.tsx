import type { OrganizationSummary, OrganizationMoney } from '../../lib/api';
import { formatMoney } from '../../lib/money';
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
/** Итоги месяца организации одной строкой, без ряда плиток (правило владельца 21.10.2026 «без плиток»): порядок от
 * расходов к полученному доходу прежний, суммы по валютам раздельно */
export function FinancialWidgets({ summary }: { summary: OrganizationSummary | null | undefined }) {
  const rows = summary?.currencies ?? [];
  return (
    <>
      <p className="org-totals" data-testid="org-totals">
        <span><i>Расходы</i> <b className="org-money">{amounts(rows, 'expensesMinor')}</b></span>
        <span><i>Средний чек</i> <b className="org-money">{amounts(rows, 'averageMinor')}</b></span>
        <span><i>Оплаченные заказы</i> <b>{summary ? summary.orders : 'Нет данных'}</b></span>
        <span><i>Доход от оплат</i> <b className="org-money">{amounts(rows, 'receiptsMinor')}</b></span>
      </p>
      {!summary ? (
        <p className="org-finance-coverage" role="status">
          Финансовая сводка сейчас недоступна. Суммы не заменяются примерными значениями.
        </p>
      ) : !summary.complete ? (
        <p className="org-finance-coverage" role="status">
          По объектам с доступными финансовыми данными. Валюты показаны раздельно.
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
