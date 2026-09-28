import Link from 'next/link';
import { ApiError, financeApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Alert, Fact, Grid, Panel } from '../../components/ui';
import { loadDeskDay } from './desk-section';

/**
 * Деньги дня (A2, план `plans/today-a2-2026-09-28.md` §3.4): отчёт финансов за один день — тот же расчёт,
 * что на «Финансах», своих формул нет. «К оплате» — `debtMinor` стойки, то же число, что плитка полосы
 * «На стойке» (день уже загружен — `loadDeskDay` из кэша отрисовки). Сравнения с прошлыми днями здесь нет:
 * два отчёта за D−1 и D−7 не помещаются в бюджет экрана (десять рейсов, `tests/ui/requests.spec.ts`) —
 * пробел плана §3.4, сравнение периодов живёт на «Показателях за период».
 */
export async function MoneyToday({ date }: { date: string }) {
  const [today, day] = await Promise.all([
    financeApi.report(date, date).catch((error: unknown) => {
      if (error instanceof ApiError) return error;
      throw error;
    }),
    loadDeskDay(date),
  ]);
  if (today instanceof ApiError)
    return (
      <Panel title="Деньги сегодня" aria-label="Деньги сегодня">
        <Alert tone="warning" boxed data-testid="money-error">
          Отчёт за день не загрузился: {today.message} Обновите страницу.
        </Alert>
      </Panel>
    );
  const money = (minor: string) => formatMoney(minor, today.currency);
  return (
    <Panel title="Деньги сегодня" aria-label="Деньги сегодня" className="fund-panel">
      <Grid min={120} gap="sm">
        <Fact label="Начислено" value={money(today.chargedMinor)} testId="money-charged" />
        <Fact label="Оплачено" value={money(today.paidMinor)} testId="money-paid" />
        <Fact label="Возвраты" value={money(today.refundedMinor)} testId="money-refunded" />
        <Fact
          label="К оплате"
          value={day instanceof ApiError ? '—' : money(day.debtMinor)}
          testId="money-debt"
        />
      </Grid>
      <p className="fund-note">проживание начисляется в день заезда целиком</p>
      <div className="fund-footer">
        <Link className="card-heading__link" href={`/finance?from=${date}&to=${date}`}>
          Финансы
          <Icon name="chevron" width={14} />
        </Link>
      </div>
    </Panel>
  );
}
