import Link from 'next/link';
import { PERIOD_PRESETS, type ResolvedPeriod } from '@pms/domain';
import { LoadError } from '../../components/load-error';
import { Panel, Skeleton, Table } from '../../components/ui';
import { ApiError, organizationApi, type BranchesSummary as SummaryView } from '../../lib/api';
import { formatInt, formatPercent, wholeTenge } from '../../lib/dashboard-format';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';

/**
 * «По филиалам» (Platform P3, ADR-130; `ARCHITECTURE.md` §10): показатели «Аналитики → Обзор» по каждому филиалу за
 * период и итог. Деньги итога — по валютам: курса в отчётную валюту нет (Q-237), складывать тенге с дирхамами нельзя;
 * занятость итога — взвешенно по фонду. Готовые отрезки — ссылки, как в «Аналитике».
 */
const PRESETS = PERIOD_PRESETS.filter((p) => p.id !== 'yesterday');

export function SummarySkeleton() {
  return (
    <Panel className="settings-block company-summary" data-testid="company-summary-loading" role="status">
      <h2>По филиалам</h2>
      <Skeleton variant="text" />
    </Panel>
  );
}

const href = (preset: string) => (preset === 'month' ? '/organization' : `/organization?period=${preset}`);
const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
/** Подпись периода — как полоса «Аналитики» (`rangeCaption`), без импорта клиентского модуля в серверный */
const caption = (from: string, to: string) => {
  const text =
    from === to
      ? displayDate(from, 'full')
      : `${displayDate(from)} — ${displayDate(to)}, ${pluralRu(days(from, to), ['день', 'дня', 'дней'])}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export async function BranchesSummary({ period }: { period: ResolvedPeriod }) {
  let summary: SummaryView;
  try {
    summary = await organizationApi.summary(period.from, period.to);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    return <LoadError testId="company-summary-error" {...loadErrorProps(error)} />;
  }
  const multiCurrency = summary.total.money.length > 1;
  const money = (minor: string, currency: string) => wholeTenge(minor, currency);
  return (
    <Panel className="settings-block company-summary" data-testid="company-summary">
      <h2>По филиалам</h2>
      <nav className="company-summary__periods chips" aria-label="Период сводки">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={href(p.id)}
            prefetch={false}
            aria-current={period.preset === p.id ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ))}
        <span className="company-period" data-testid="company-period">
          {caption(period.from, period.to)}
        </span>
      </nav>
      {period.error && <p className="company-note">{period.error}. Показан сегодняшний день.</p>}
      <Table aria-label="Показатели по филиалам" nowrap data-testid="company-summary-table">
        <thead>
          <tr>
            <th>Филиал</th>
            <th className="num">Загрузка</th>
            <th className="num">Продано ночей</th>
            <th className="num">Заезды</th>
            <th className="num">Брони</th>
            <th className="num">Выручка</th>
            <th className="num">Оплаты</th>
            <th className="num">Ср. цена за ночь</th>
          </tr>
        </thead>
        <tbody>
          {summary.branches.map((b) => (
            <tr key={b.locationId} className={b.current ? 'company-row--current' : undefined} data-testid="company-summary-row">
              <td>
                <strong>{b.name}</strong>
                {b.current && <span className="muted"> (текущий)</span>}
                {multiCurrency && <div className="muted">{b.currency}</div>}
              </td>
              {b.period ? (
                <>
                  <td className="num">{formatPercent(b.period.occupancy.percent)}</td>
                  <td className="num">
                    {formatInt(b.period.occupancy.occupiedNights)}
                    <span className="muted"> из {formatInt(b.period.occupancy.unitNights)}</span>
                  </td>
                  <td className="num">{formatInt(b.period.arrivals.count)}</td>
                  <td className="num">{formatInt(b.period.bookings.total)}</td>
                  <td className="num">{money(b.period.revenue.totalMinor, b.currency)}</td>
                  <td className="num">{money(b.period.payments.totalMinor, b.currency)}</td>
                  <td className="num">{b.period.adrMinor ? money(b.period.adrMinor, b.currency) : '—'}</td>
                </>
              ) : (
                <td colSpan={7} className="muted">
                  Объекта нет — показателей нет
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {summary.total.money.length === 0 ? (
            <tr data-testid="company-total">
              <td>Итого</td>
              <td className="num">{formatPercent(summary.total.occupancy.percent)}</td>
              <td className="num">{formatInt(summary.total.occupancy.occupiedNights)}</td>
              <td className="num">{formatInt(summary.total.arrivals)}</td>
              <td className="num">{formatInt(summary.total.bookings)}</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
            </tr>
          ) : (
            summary.total.money.map((m, i) => (
              <tr key={m.currency} data-testid="company-total">
                <td>{i === 0 ? 'Итого' : ''}{multiCurrency ? ` ${m.currency}` : ''}</td>
                <td className="num">{i === 0 ? formatPercent(summary.total.occupancy.percent) : ''}</td>
                <td className="num">
                  {i === 0 && (
                    <>
                      {formatInt(summary.total.occupancy.occupiedNights)}
                      <span className="muted"> из {formatInt(summary.total.occupancy.unitNights)}</span>
                    </>
                  )}
                </td>
                <td className="num">{i === 0 ? formatInt(summary.total.arrivals) : ''}</td>
                <td className="num">{i === 0 ? formatInt(summary.total.bookings) : ''}</td>
                <td className="num">{money(m.revenueMinor, m.currency)}</td>
                <td className="num">{money(m.paymentsMinor, m.currency)}</td>
                <td className="num">{m.adrMinor ? money(m.adrMinor, m.currency) : '—'}</td>
              </tr>
            ))
          )}
        </tfoot>
      </Table>
      <p className="company-note">
        {multiCurrency
          ? 'Филиалы в разных валютах: деньги итога показаны по каждой валюте отдельно, курса пересчёта в отчётную валюту пока нет.'
          : 'Итог — сумма по филиалам; загрузка итога взвешена по фонду. Те же числа у каждого филиала — в «Аналитике» после его открытия.'}
      </p>
    </Panel>
  );
}
