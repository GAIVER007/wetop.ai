import { financeDateRange } from '../../lib/finance-period';
import type { SearchParams } from '../../lib/search-params';
import { ApiError } from '../../lib/api-error';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi, type BeautyAppointmentRow, type BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { EmptyState, Panel, SectionTitle, Table } from '../../components/ui';
import { KpiTile } from '../../components/kpi-tile';
import './finance.css';
import '../sales/sales.css';

/**
 * «Финансы» салона (единая навигация всех направлений): деньги из записей салона, без выдуманных чисел.
 * Источник один: `GET /beauty/appointments?date=` (день филиала), запрашивается по дням периода.
 * - выручка: снимки цен записей в статусе DONE (Q-252);
 * - ожидается: BOOKED и CONFIRMED (ещё не оказано);
 * - потери: NO_SHOW и CANCELLED.
 * Касса и расходы салона отдельной моделью пока не ведутся: экран говорит об этом прямо.
 */
/** Как у CSV записей: не больше месяца отдельных дневных запросов. */
const MAX_DAYS = 31;

const sum = (rows: BeautyAppointmentRow[]) =>
  rows.reduce((acc, a) => acc + BigInt(a.priceMinor || '0'), 0n);

interface DayTotals {
  date: string;
  done: number;
  revenue: bigint;
}

export interface BeautyFinanceView {
  today: string;
  from: string;
  currency: string;
  timezone: string;
  revenue: bigint;
  /** возвраты по выполненным записям периода (§54), отдельно от выручки, как ADR-176 */
  refunded: bigint;
  expected: bigint;
  lost: bigint;
  done: BeautyAppointmentRow[];
  doneByDate: Map<string, string>;
  days: DayTotals[];
  masters: Array<{ name: string; count: number; revenue: bigint }>;
}

/** Чистая сборка вида из ответов по дням: проверяется тестом без сети */
export function buildBeautyFinance(days: BeautyDay[]): BeautyFinanceView {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted.at(-1)?.date ?? '';
  const currencies = new Set(sorted.flatMap((day) => day.appointments.map((row) => row.currency)));
  if (currencies.size > 1) throw new Error('Different currencies require separate finance totals');
  const currency = [...currencies][0] ?? sorted.at(-1)?.location.currency ?? 'KZT';
  const names = new Map<string, string>();
  for (const day of sorted) for (const c of day.columns) names.set(c.id, c.name);
  const all = sorted.flatMap((d) => d.appointments.map((a) => ({ a, date: d.date })));
  const done = all.filter((x) => x.a.status === 'DONE');
  const masters = new Map<string, { name: string; count: number; revenue: bigint }>();
  for (const { a } of done) {
    const counted = new Set<string>();
    for (const item of a.items?.length ? a.items : [a]) {
      const master = masters.get(item.employeeId) ?? {
        name: names.get(item.employeeId) ?? 'Мастер', count: 0, revenue: 0n,
      };
      if (!counted.has(item.employeeId)) master.count += 1;
      counted.add(item.employeeId);
      master.revenue += BigInt(item.priceMinor || '0');
      masters.set(item.employeeId, master);
    }
  }
  return {
    today,
    from: sorted[0]?.date ?? today,
    currency,
    // пояс филиала приходит в каждом ответе дня; без ответов строк нет и пояс не нужен
    timezone: sorted.at(-1)?.location.timezone ?? 'UTC',
    revenue: sum(done.map((x) => x.a)),
    refunded: done.reduce((acc, x) => acc + BigInt(x.a.refundedMinor ?? '0'), 0n),
    expected: sum(
      all.filter((x) => x.a.status === 'BOOKED' || x.a.status === 'CONFIRMED').map((x) => x.a),
    ),
    lost: sum(
      all.filter((x) => x.a.status === 'NO_SHOW' || x.a.status === 'CANCELLED').map((x) => x.a),
    ),
    done: done.map((x) => x.a).sort((p, q) => q.startsAt.localeCompare(p.startsAt)),
    doneByDate: new Map(done.map((x) => [x.a.id, x.date])),
    days: sorted.map((d) => {
      const rows = d.appointments.filter((a) => a.status === 'DONE');
      return { date: d.date, done: rows.length, revenue: sum(rows) };
    }),
    masters: [...masters.values()].sort((p, q) => (q.revenue > p.revenue ? 1 : -1)),
  };
}

/** Historical currencies stay separate; no exchange rate is inferred from the current settings. */
export function buildBeautyFinanceGroups(days: BeautyDay[]): BeautyFinanceView[] {
  const current = days.at(-1)?.location.currency ?? 'KZT';
  const currencies = new Set([current, ...days.flatMap((day) => day.appointments.map((row) => row.currency))]);
  return [...currencies].map((currency) => buildBeautyFinance(days.map((day) => ({
    ...day,
    location: { ...day.location, currency },
    appointments: day.appointments.filter((row) => row.currency === currency),
  }))));
}

async function loadPeriod(params: SearchParams): Promise<BeautyFinanceView[]> {
  // Только API знает текущую дату филиала; сегодняшний ответ повторно не запрашиваем.
  const first = await beautyApi.financeDay();
  const { dates } = financeDateRange(params, first.date, { period: 'week', maxDays: MAX_DAYS });
  const days: BeautyDay[] = new Array(dates.length);
  let cursor = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const index = cursor++;
      const date = dates[index];
      if (!date) return;
      try {
        const day = date === first.date ? first : await beautyApi.financeDay(date);
        if (day.date !== date || day.location.id !== first.location.id ||
            day.location.timezone !== first.location.timezone) {
          throw new ApiError(502, 'Данные периода не совпадают с филиалом отчёта.');
        }
        days[index] = day;
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, dates.length) }, worker));
  return buildBeautyFinanceGroups(days);
}

const timeOf = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));

export async function BeautyFinanceScreen({ searchParams = {} }: { searchParams?: SearchParams } = {}) {
  let views: BeautyFinanceView[];
  try {
    views = await loadPeriod(searchParams);
  } catch (error: unknown) {
    unstable_rethrow(error);
    return (
      <Page title="Финансы">
        <LoadError testId="beauty-finance-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
  const view = views[0]!;
  return (
    <Page
      title="Финансы"
      subtitle={`Стоимость услуг за ${displayDate(view.from)}: ${displayDate(view.today)}`}
      actions={
        // записи периода экрана в CSV (Q-BS-6), без имён клиентов
        <a className="btn btn--secondary" href={`/finance/export-appointments?from=${view.from}&to=${view.today}`} download>
          Выгрузить записи (CSV)
        </a>
      }
    >
      {views.length > 1 && <p>Итоги показаны отдельно по валютам записей. Пересчёт валют не выполняется.</p>}
      {views.map((group) => <BeautyFinanceReport key={group.currency} view={group} multiple={views.length > 1} />)}
    </Page>
  );
}


function BeautyFinanceReport({ view, multiple }: { view: BeautyFinanceView; multiple: boolean }) {
  const avg = view.done.length ? view.revenue / BigInt(view.done.length) : 0n;
  const money = (value: bigint) => formatMoney(value, view.currency);
  return (
      <section data-testid="beauty-finance" aria-label={`Финансы, ${view.currency}`}>
        {multiple && <SectionTitle>{view.currency}</SectionTitle>}
        <div className="kpi-row" data-testid="beauty-finance-kpis">
          <KpiTile
            icon="money"
            label="Стоимость оказанных услуг"
            value={money(view.revenue)}
            caption={view.refunded > 0n ? `снимки цен за выбранный период, не поступления, возвраты ${money(view.refunded)}` : 'снимки цен за выбранный период, не поступления'}
            testId="beauty-revenue"
          />
          <KpiTile
            icon="check"
            label="Выполнено записей"
            value={String(view.done.length)}
            caption="выполнено за выбранный период"
            testId="beauty-services-count"
            href="/appointments"
          />
          <KpiTile icon="receipt" label="Средняя стоимость записи" value={money(avg)} caption="по выполненным записям" testId="beauty-avg" />
          <KpiTile
            icon="booking"
            label="Ожидается по записям"
            value={money(view.expected)}
            caption="записи без отметки «Выполнено»"
            testId="beauty-expected"
            href="/calendar"
          />
          <KpiTile
            icon="incidents"
            label="Стоимость отмен и неявок"
            value={money(view.lost)}
            caption="снимки цен, не потерянные деньги"
            testId="beauty-lost"
          />
        </div>

        <SectionTitle>По дням</SectionTitle>
        <Panel>
          <Table>
            <thead>
              <tr>
                <th>День</th>
                <th>Записей</th>
                <th>Стоимость оказанных услуг</th>
              </tr>
            </thead>
            <tbody>
              {[...view.days].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{displayDate(d.date)}</td>
                  <td>{d.done}</td>
                  <td>{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <SectionTitle>По мастерам</SectionTitle>
        {view.masters.length === 0 ? (
          <EmptyState title="Пока нет оказанных услуг">
            Стоимость услуг по мастерам появится, когда записи отметят как выполненные в{' '}
            <Link href="/calendar">календаре</Link>.
          </EmptyState>
        ) : (
          <Panel>
            <Table>
              <thead>
                <tr>
                  <th>Мастер</th>
                  <th>Записей</th>
                  <th>Стоимость оказанных услуг</th>
                </tr>
              </thead>
              <tbody>
                {view.masters.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.count}</td>
                    <td>{money(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}

        <SectionTitle>Выполненные записи</SectionTitle>
        {view.done.length === 0 ? (
          <EmptyState title="Нет выполненных записей за неделю" />
        ) : (
          <Panel>
            <Table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Время</th>
                  <th>Клиент</th>
                  <th>Услуга</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {view.done.map((a) => (
                  <tr key={a.id}>
                    <td>{displayDate(view.doneByDate.get(a.id) ?? view.today)}</td>
                    <td>{timeOf(a.startsAt, view.timezone)}</td>
                    <td>{a.customer.name}</td>
                    <td>{a.items?.length ? a.items.map((item) => item.serviceName).join(', ') : a.serviceName}</td>
                    <td>{formatMoney(a.priceMinor, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}
        <p className="settings-note beauty-finance__note">
          Здесь снимки цен записей, а не денежные поступления. Отмены и неявки не означают потерю денег. Фактические поступления и возвраты: в <Link href="/cashbox">кассе</Link>. Оплата труда ведётся отдельно.
        </p>
      </section>
  );
}
