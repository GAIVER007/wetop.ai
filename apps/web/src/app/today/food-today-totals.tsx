import { wholeTenge } from '../../lib/dashboard-format';
import '../finance/summary.css';
import { translator, type Translate } from '../../i18n';

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
  t = translator('ru'),
}: {
  planned: number;
  expectedGuests: number;
  seatedGuests: number;
  freeTables: number;
  tablesTotal: number;
  revenueMinor: string;
  currency: string;
  revenueDeltaPct: number | null;
  t?: Translate;
}) {
  const delta =
    revenueDeltaPct === null
      ? null
      : t('{delta} % к вчера', {
          delta: `${revenueDeltaPct > 0 ? '+' : revenueDeltaPct < 0 ? '−' : ''}${Math.abs(revenueDeltaPct)}`,
        });
  return (
    <dl className="money-summary" data-testid="today-totals" aria-label={t('Итоги дня')}>
      <div>
        <dt>{t('Брони впереди')}</dt>
        <dd data-testid="today-planned">{planned}</dd>
      </div>
      <div>
        <dt>{t('Ожидаемые гости')}</dt>
        <dd data-testid="today-expected-guests">{expectedGuests}</dd>
      </div>
      <div>
        <dt>{t('Гости в зале')}</dt>
        <dd data-testid="today-seated-guests">{seatedGuests}</dd>
      </div>
      <div>
        <dt>{t('Свободные столы')}</dt>
        <dd>
          {tablesTotal === 0 ? (
            <>
              <span data-testid="today-tables">{freeTables}</span> <span className="muted">{t('столы не настроены')}</span>
            </>
          ) : (
            <>
              <span data-testid="today-tables">{freeTables}</span> <span className="muted">{t('из {total}', { total: tablesTotal })}</span>
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>{t('Выручка сегодня')}</dt>
        <dd>
          <span data-testid="today-revenue">{wholeTenge(revenueMinor, currency)}</span>
          {delta && <span className="muted"> {delta}</span>}
        </dd>
      </div>
    </dl>
  );
}
