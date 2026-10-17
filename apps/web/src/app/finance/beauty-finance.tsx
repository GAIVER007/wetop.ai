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
 * Источник один: `GET /beauty/appointments?date=` (день филиала), запрашивается по дням недели.
 * - выручка: снимки цен записей в статусе DONE (Q-252);
 * - ожидается: BOOKED и CONFIRMED (ещё не оказано);
 * - потери: NO_SHOW и CANCELLED.
 * Касса и расходы салона отдельной моделью пока не ведутся: экран говорит об этом прямо.
 */
const DAYS = 7;

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

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
  const currency = sorted.at(-1)?.location.currency ?? 'KZT';
  const names = new Map<string, string>();
  for (const day of sorted) for (const c of day.columns) names.set(c.id, c.name);
  const all = sorted.flatMap((d) => d.appointments.map((a) => ({ a, date: d.date })));
  const done = all.filter((x) => x.a.status === 'DONE');
  const masters = new Map<string, { name: string; count: number; revenue: bigint }>();
  for (const { a } of done) {
    const m = masters.get(a.employeeId) ?? {
      name: names.get(a.employeeId) ?? 'Мастер',
      count: 0,
      revenue: 0n,
    };
    m.count += 1;
    m.revenue += BigInt(a.priceMinor || '0');
    masters.set(a.employeeId, m);
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

async function loadWeek(): Promise<BeautyFinanceView> {
  // Первый запрос без даты: сервер сам знает «сегодня» филиала в его часовом поясе
  const first = await beautyApi.day();
  const rest = await Promise.all(
    Array.from({ length: DAYS - 1 }, (_, i) => beautyApi.day(shiftDate(first.date, -(i + 1)))),
  );
  return buildBeautyFinance([first, ...rest]);
}

const timeOf = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso));

export async function BeautyFinanceScreen() {
  let view: BeautyFinanceView;
  try {
    view = await loadWeek();
  } catch (error: unknown) {
    unstable_rethrow(error);
    return (
      <Page title="Финансы">
        <LoadError testId="beauty-finance-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
  const avg = view.done.length ? view.revenue / BigInt(view.done.length) : 0n;
  const money = (v: bigint) => formatMoney(v, view.currency);
  return (
    <Page
      title="Финансы"
      subtitle={`Стоимость услуг за ${displayDate(view.from)}: ${displayDate(view.today)}`}
    >
      <div data-testid="beauty-finance">
        <div className="kpi-row" data-testid="beauty-finance-kpis">
          <KpiTile
            icon="money"
            label="Стоимость оказанных услуг"
            value={money(view.revenue)}
            caption={view.refunded > 0n ? `снимки цен за 7 дней, не поступления, возвраты ${money(view.refunded)}` : 'снимки цен за 7 дней, не поступления'}
            testId="beauty-revenue"
          />
          <KpiTile
            icon="check"
            label="Оказано услуг"
            value={String(view.done.length)}
            caption="выполнено за 7 дней"
            testId="beauty-services-count"
            href="/appointments"
          />
          <KpiTile icon="receipt" label="Средняя стоимость услуги" value={money(avg)} caption="по выполненным записям" testId="beauty-avg" />
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
                <th>Услуг</th>
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
                  <th>Услуг</th>
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

        <SectionTitle>Оказанные услуги</SectionTitle>
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
                    <td>{a.serviceName}</td>
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
      </div>
    </Page>
  );
}
