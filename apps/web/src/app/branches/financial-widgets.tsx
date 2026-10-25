import type { OrganizationSummary, OrganizationMoney } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { verticalCopy } from '../../lib/vertical-copy';
import '../finance/summary.css';
import type { Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
const VERTICAL_ORDER = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
type Vertical = (typeof VERTICAL_ORDER)[number];
/** «Оплаченные брони и записи»: слова направлений из vertical-copy (в салоне нет заказов и броней, аудит P2-5) */
function paidLabel(verticals: readonly Vertical[], t: Translate) {
  const words = VERTICAL_ORDER.filter((v) => verticals.includes(v)).map((v) => t(verticalCopy(v).paidUnits));
  const list = words.length ? words : [t(verticalCopy('HOSPITALITY').paidUnits)];
  const tail =
    list.length > 1 ? t('{list} и {last}', { list: list.slice(0, -1).join(', '), last: list.at(-1) ?? '' }) : list[0];
  return t('Оплаченные {what}', { what: tail ?? '' });
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
  const t = useT();
  if (!summary)
    return (
      <p className="org-totals-note" data-testid="org-totals" role="status">
        {t('Итоги месяца сейчас не загрузились. Обновите страницу чуть позже.')}
      </p>
    );
  const rows = summary.currencies.filter(
    (row) => row.orders > 0 || BigInt(row.receiptsMinor) !== 0n || BigInt(row.expensesMinor) !== 0n,
  );
  const scope = summary.complete
    ? t('Все объекты, в том числе из архива.')
    : t('Только объекты, где ведётся учёт оплат.');
  if (!rows.length)
    return (
      <p className="org-totals-note" data-testid="org-totals">
        {t('За этот месяц оплат и расходов пока нет.')} {scope}
      </p>
    );
  const average = known(rows, 'averageMinor');
  return (
    <>
      <dl className="money-summary org-totals" data-testid="org-totals">
        <div>
          <dt>{t('Расходы')}</dt>
          <dd>{known(rows, 'expensesMinor')}</dd>
        </div>
        {average && (
          <div>
            <dt>{t('Средний чек')}</dt>
            <dd>{average}</dd>
          </div>
        )}
        <div>
          <dt>{paidLabel(verticals, t)}</dt>
          <dd>{summary.orders}</dd>
        </div>
        <div>
          <dt>{t('Доход от оплат')}</dt>
          <dd>{known(rows, 'receiptsMinor')}</dd>
        </div>
      </dl>
      <p className="org-finance-coverage" role={summary.complete ? undefined : 'status'}>
        {scope}
        {rows.length > 1 ? ` ${t('Суммы в разных валютах считаются отдельно.')}` : ''}
      </p>
    </>
  );
}
