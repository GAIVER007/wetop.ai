import Link from 'next/link';
import { ApiError, financeApi, type PeriodReport } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/icon';
import { Alert, Fact, Grid, Panel } from '../../components/ui';
import { loadDeskDay } from './desk-section';

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const report = (from: string) =>
  financeApi.report(from, from).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });

/**
 * Деньги дня (A2, план `plans/today-a2-2026-09-28.md` §3.4): отчёт финансов за один день — тот же расчёт,
 * что на «Финансах», своих формул нет. «К оплате» — `debtMinor` стойки, то же число, что плитка полосы
 * «На стойке» (день уже загружен — `loadDeskDay` из кэша отрисовки). Сравнение с прошлыми днями — только
 * владельцу: оно про выручку, а не про работу смены.
 */
export async function MoneyToday({ date }: { date: string }) {
  const { access } = await deskShell();
  const owner = access.role === 'OWNER' || access.role === null;
  const [today, yesterday, weekAgo, day] = await Promise.all([
    report(date),
    owner ? report(shift(date, -1)) : null,
    owner ? report(shift(date, -7)) : null,
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
  const paid = (r: PeriodReport | ApiError | null) =>
    r && !(r instanceof ApiError) ? money(r.paidMinor) : null;
  const compare = [
    { label: 'вчера', value: paid(yesterday) },
    { label: 'неделю назад', value: paid(weekAgo) },
  ].filter((c): c is { label: string; value: string } => c.value !== null);
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
      {compare.length > 0 && (
        <p className="money-compare" data-testid="money-compare">
          <span>Оплачено</span>
          {compare.map((c) => (
            <span key={c.label}>
              {c.label} {c.value}
            </span>
          ))}
        </p>
      )}
      <div className="fund-footer">
        <Link className="card-heading__link" href={`/finance?from=${date}&to=${date}`}>
          Финансы
          <Icon name="chevron" width={14} />
        </Link>
      </div>
    </Panel>
  );
}
