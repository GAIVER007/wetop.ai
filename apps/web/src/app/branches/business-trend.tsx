import { unstable_rethrow } from 'next/navigation';
import { organizationSummaryApi, type OrganizationSummary } from '../../lib/api';
import { formatMoney } from '../../lib/money';
const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
/** Existing branch report totals, processed as integer minor units. At most two requests run at once. */
export async function BusinessTrend({
  date,
  current,
}: {
  date: string;
  current?: OrganizationSummary | null;
}) {
  const year = Number(date.slice(0, 4)),
    month = Number(date.slice(5, 7));
  let mixed = false;
  const totals: Array<{ label: string; value: bigint | null; currency: string | null }> =
    MONTHS.map((label) => ({ label, value: null, currency: null }));
  try {
    for (let start = 0; start < month; start += 2) {
      await Promise.all(
        [start, start + 1]
          .filter((index) => index < month)
          .map(async (index) => {
            const mm = String(index + 1).padStart(2, '0');
            const from = `${year}-${mm}-01`;
            const last =
              index + 1 === month
                ? date
                : `${year}-${mm}-${String(new Date(Date.UTC(year, index + 1, 0)).getUTCDate()).padStart(2, '0')}`;
            const report =
              current?.from === from && current.to === last
                ? current
                : await organizationSummaryApi.load(from, last);
            if (report.currencies.length > 1) {
              mixed = true;
              return;
            }
            const entry = report.currencies[0];
            totals[index] = {
              label: MONTHS[index]!,
              value: entry ? BigInt(entry.receiptsMinor) : null,
              currency: entry?.currency ?? null,
            };
          }),
      );
    }
    if (mixed) return <p className="org-chart-empty">Динамика не объединяет разные валюты.</p>;
    const currencies = new Set(totals.flatMap((point) => (point.currency ? [point.currency] : [])));
    if (currencies.size === 0)
      return <p className="org-chart-empty">Нет данных о поступлениях за выбранный период.</p>;
    if (currencies.size > 1)
      return <p className="org-chart-empty">Динамика не объединяет разные валюты.</p>;
    const currency = [...currencies][0]!;
    const max = totals.reduce(
      (max, point) => (point.value !== null && point.value > max ? point.value : max),
      0n,
    );
    return (
      <div className="org-trend">
        <div className="org-trend-caption">
          <span>Поступления учтённых объектов, {currency}</span>
          <span>{year}</span>
        </div>
        <ol aria-label="Полученные оплаты по месяцам">
          {totals.map((point) => (
            <li
              key={point.label}
              title={
                point.value === null ? 'Вне выбранного периода' : formatMoney(point.value, currency)
              }
              aria-label={`${point.label}: ${point.value === null ? 'вне выбранного периода' : formatMoney(point.value, currency)}`}
            >
              <div className="org-trend-bar">
                <span
                  style={{
                    height: `${point.value === null || max === 0n ? 0 : Number((point.value * 100n) / max)}%`,
                  }}
                />
              </div>
              <small>{point.label}</small>
            </li>
          ))}
        </ol>
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <p className="org-chart-empty">
        Не удалось загрузить динамику. Попробуйте обновить страницу.
      </p>
    );
  }
}
