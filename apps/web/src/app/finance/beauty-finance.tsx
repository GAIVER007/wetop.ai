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
import { shortPeriod } from '../../lib/human-period';
import { PeriodBar } from '../../lib/period-bar';
import { EmptyState, SectionTitle, Table } from '../../components/ui';
import './finance.css';
import './summary.css';
import '../sales/sales.css';

/**
 * «Финансы» салона (единая навигация всех направлений): деньги из записей салона, без выдуманных чисел.
 * Источник один: `GET /beauty/appointments?date=` (день филиала), запрашивается по дням периода.
 * - выручка: цены записей в статусе DONE на момент записи (Q-252);
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

async function loadPeriod(params: SearchParams): Promise<{ views: BeautyFinanceView[]; today: string; from: string; to: string }> {
  // Только API знает текущую дату филиала; сегодняшний ответ повторно не запрашиваем.
  const first = await beautyApi.financeDay();
  const { dates, from, to } = financeDateRange(params, first.date, { period: 'week', maxDays: MAX_DAYS });
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
  return { views: buildBeautyFinanceGroups(days), today: first.date, from, to };
}

const timeOf = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));

export async function BeautyFinanceScreen({ searchParams = {} }: { searchParams?: SearchParams } = {}) {
  let period: Awaited<ReturnType<typeof loadPeriod>>;
  try {
    period = await loadPeriod(searchParams);
  } catch (error: unknown) {
    unstable_rethrow(error);
    return (
      <Page title="Финансы">
        <LoadError testId="beauty-finance-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
  const { views, today, from, to } = period;
  return (
    <Page
      title="Финансы"
      subtitle={`Стоимость услуг за ${shortPeriod(from, to)}`}
      actions={
        // записи периода экрана в CSV (Q-BS-6), без имён клиентов
        <a className="btn btn--secondary" href={`/finance/export-appointments?from=${from}&to=${to}`} download>
          Выгрузить записи (CSV)
        </a>
      }
    >
      <PeriodBar path="/finance" from={from} to={to} today={today} testId="finance-period" note="период до 31 дня" />
      {views.length > 1 && <p>Итоги показаны отдельно по валютам записей. Пересчёт валют не выполняется.</p>}
      {views.map((group) => <BeautyFinanceReport key={group.currency} view={group} multiple={views.length > 1} />)}
    </Page>
  );
}


function BeautyFinanceReport({ view, multiple }: { view: BeautyFinanceView; multiple: boolean }) {
  const avg = view.done.length ? view.revenue / BigInt(view.done.length) : 0n;
  const money = (value: bigint) => formatMoney(value, view.currency);
  // аудит 21.10.2026 п. 29: дни без оказанных услуг не занимают строки нулями
  const days = [...view.days].reverse().filter((d) => d.done > 0);
  return (
      <section data-testid="beauty-finance" aria-label={`Финансы, ${view.currency}`}>
        {multiple && <SectionTitle>{view.currency}</SectionTitle>}
        {/* итоги одной строкой вместо плиток (решение владельца: без декоративных плиток над списками) */}
        <dl className="money-summary" data-testid="beauty-finance-summary">
          <div>
            <dt>Стоимость оказанных услуг</dt>
            <dd data-testid="beauty-revenue">{money(view.revenue)}</dd>
          </div>
          {view.refunded > 0n && (
            <div>
              <dt>Возвраты</dt>
              <dd data-testid="beauty-refunded">{money(view.refunded)}</dd>
            </div>
          )}
          <div>
            <dt>Выполнено записей</dt>
            <dd data-testid="beauty-services-count">
              <Link href="/appointments">{view.done.length}</Link>
            </dd>
          </div>
          <div>
            <dt>Средняя стоимость записи</dt>
            <dd data-testid="beauty-avg">{money(avg)}</dd>
          </div>
          <div>
            <dt>Ожидается по записям</dt>
            <dd data-testid="beauty-expected">
              <Link href="/calendar">{money(view.expected)}</Link>
            </dd>
          </div>
          <div>
            <dt>Стоимость отмен и неявок</dt>
            <dd data-testid="beauty-lost">{money(view.lost)}</dd>
          </div>
        </dl>

        <SectionTitle>По дням</SectionTitle>
        {days.length === 0 ? (
          <EmptyState title="За период услуги не оказаны">
            Дни появятся здесь, когда записи отметят как выполненные в <Link href="/calendar">календаре</Link>.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>День</th>
                <th>Записей</th>
                <th>Стоимость оказанных услуг</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{displayDate(d.date)}</td>
                  <td>{d.done}</td>
                  <td>{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Итого</th>
                <td>{view.done.length}</td>
                <td>{money(view.revenue)}</td>
              </tr>
            </tfoot>
          </Table>
        )}

        <SectionTitle>По мастерам</SectionTitle>
        {view.masters.length === 0 ? (
          <EmptyState title="Пока нет оказанных услуг">
            Стоимость услуг по мастерам появится, когда записи отметят как выполненные в{' '}
            <Link href="/calendar">календаре</Link>.
          </EmptyState>
        ) : (
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
        )}

        <SectionTitle>Выполненные записи</SectionTitle>
        {view.done.length === 0 ? (
          <EmptyState title="Нет выполненных записей за период" />
        ) : (
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
        )}
        <p className="settings-note beauty-finance__note">
          Суммы посчитаны по ценам на момент записи, это не поступления денег. Отмены и неявки показаны для сведения. Фактические поступления и возвраты: в <Link href="/cashbox">кассе</Link>. Оплата труда ведётся отдельно.
        </p>
      </section>
  );
}
