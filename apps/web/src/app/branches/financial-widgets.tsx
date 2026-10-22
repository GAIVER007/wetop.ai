import type { OrganizationSummary, OrganizationMoney } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { verticalCopy } from '../../lib/vertical-copy';
import '../finance/summary.css';
const VERTICAL_ORDER = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
type Vertical = (typeof VERTICAL_ORDER)[number];
/** «Оплаченные брони и записи»: слова направлений из vertical-copy (в салоне нет заказов и броней, аудит P2-5) */
function paidLabel(verticals: readonly Vertical[]) {
  const words = VERTICAL_ORDER.filter((v) => verticals.includes(v)).map((v) => verticalCopy(v).paidUnits);
  const list = words.length ? words : [verticalCopy('HOSPITALITY').paidUnits];
  const tail = list.length > 1 ? `${list.slice(0, -1).join(', ')} и ${list.at(-1)}` : list[0];
  return `Оплаченные ${tail}`;
}
const known = (rows: OrganizationMoney[], field: 'receiptsMinor' | 'expensesMinor' | 'averageMinor') =>
  rows
    .filter((row) => row[field] !== null)
    .map((row) => formatMoney(row[field]!, row.currency))
    .join(' / ');
/** Итоги месяца организации одной строкой под списком объектов, как `money-summary` на «Финансах» и в «Кассе»
 * (правило владельца «без плиток», аудит 22.10.2026 P1-3a). Пустой месяц: одна фраза без «0 ₸» и «Не определён». */
export function FinancialWidgets({
  summary,
  verticals = [],
}: {
  summary: OrganizationSummary | null | undefined;
  verticals?: readonly Vertical[];
}) {
  if (!summary)
    return (
      <p className="org-totals-note" data-testid="org-totals" role="status">
        Итоги месяца сейчас не загрузились. Обновите страницу чуть позже.
      </p>
    );
  const rows = summary.currencies.filter(
    (row) => row.orders > 0 || BigInt(row.receiptsMinor) !== 0n || BigInt(row.expensesMinor) !== 0n,
  );
  const scope = summary.complete
    ? 'Все объекты, в том числе из архива.'
    : 'Только объекты, где ведётся учёт оплат.';
  if (!rows.length)
    return (
      <p className="org-totals-note" data-testid="org-totals">
        За этот месяц оплат и расходов пока нет. {scope}
      </p>
    );
  const average = known(rows, 'averageMinor');
  return (
    <>
      <dl className="money-summary org-totals" data-testid="org-totals">
        <div>
          <dt>Расходы</dt>
          <dd>{known(rows, 'expensesMinor')}</dd>
        </div>
        {average && (
          <div>
            <dt>Средний чек</dt>
            <dd>{average}</dd>
          </div>
        )}
        <div>
          <dt>{paidLabel(verticals)}</dt>
          <dd>{summary.orders}</dd>
        </div>
        <div>
          <dt>Доход от оплат</dt>
          <dd>{known(rows, 'receiptsMinor')}</dd>
        </div>
      </dl>
      <p className="org-finance-coverage" role={summary.complete ? undefined : 'status'}>
        {scope}
        {rows.length > 1 ? ' Суммы в разных валютах считаются отдельно.' : ''}
      </p>
    </>
  );
}
