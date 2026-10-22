import { wholeTenge } from '../../lib/dashboard-format';
import '../finance/summary.css';

/**
 * Итоги дня ресторана одной строкой (правило владельца «без плиток», аудит ресторана 22.10.2026):
 * брони впереди, ожидаемые гости, гости в зале, свободные столы и выручка. testid прежних плиток сохранены.
 */
export function FoodTodayTotals({
  planned,
  expectedGuests,
  seatedGuests,
  freeTables,
  tablesTotal,
  revenueMinor,
  currency,
  revenueDeltaPct,
}: {
  planned: number;
  expectedGuests: number;
  seatedGuests: number;
  freeTables: number;
  tablesTotal: number;
  revenueMinor: string;
  currency: string;
  revenueDeltaPct: number | null;
}) {
  const delta =
    revenueDeltaPct === null
      ? null
      : `${revenueDeltaPct > 0 ? '+' : revenueDeltaPct < 0 ? '−' : ''}${Math.abs(revenueDeltaPct)} % к вчера`;
  return (
    <dl className="money-summary" data-testid="today-totals" aria-label="Итоги дня">
      <div>
        <dt>Брони впереди</dt>
        <dd data-testid="today-planned">{planned}</dd>
      </div>
      <div>
        <dt>Ожидаемые гости</dt>
        <dd data-testid="today-expected-guests">{expectedGuests}</dd>
      </div>
      <div>
        <dt>Гости в зале</dt>
        <dd data-testid="today-seated-guests">{seatedGuests}</dd>
      </div>
      <div>
        <dt>Свободные столы</dt>
        <dd>
          {tablesTotal === 0 ? (
            <>
              <span data-testid="today-tables">{freeTables}</span> <span className="muted">столы не настроены</span>
            </>
          ) : (
            <>
              <span data-testid="today-tables">{freeTables}</span> <span className="muted">из {tablesTotal}</span>
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>Выручка сегодня</dt>
        <dd>
          <span data-testid="today-revenue">{wholeTenge(revenueMinor, currency)}</span>
          {delta && <span className="muted"> {delta}</span>}
        </dd>
      </div>
    </dl>
  );
}
