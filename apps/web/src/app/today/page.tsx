import Link from 'next/link';
import { deskApi, formatMinor } from '../../lib/api';
import { DayWorkspace } from './day-workspace';
import { DayAttention } from './day-attention';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Button, Input } from '../../components/ui';
import { displayDate } from '../../lib/display-date';

/** Рабочий пульт стойки. Показатели целиком из DeskDay, без придуманных сравнений/процентов. */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const day = await deskApi.today(sp.date);
  const debt = BigInt(day.debtMinor) > 0n;
  const metrics: Array<{
    label: string;
    value: string;
    id: string;
    icon: IconName;
    tone: string;
    hint: string;
    count?: number;
    countId?: string;
  }> = [
    {
      label: 'Проживают',
      value: String(day.counts.inHouse),
      id: 'c-inhouse',
      icon: 'bed',
      tone: 'home',
      hint: 'Размещений на выбранную дату',
    },
    {
      label: 'Заезды',
      value: String(day.counts.arrivals),
      id: 'c-arrivals',
      icon: 'arrival',
      tone: 'arrival',
      hint: 'ожидают заселения',
      count: day.counts.toCheckIn,
      countId: 'c-tocheckin',
    },
    {
      label: 'Выезды',
      value: String(day.counts.departures),
      id: 'c-departures',
      icon: 'departure',
      tone: 'departure',
      hint: 'ожидают выезда',
      count: day.counts.toCheckOut,
      countId: 'c-tocheckout',
    },
    {
      label: 'Долг уезжающих',
      value: formatMinor(day.debtMinor),
      id: 'c-debt',
      icon: 'money',
      tone: debt ? 'debt' : 'paid',
      hint: debt ? 'Проверьте расчёт перед выездом' : 'Все счета оплачены',
    },
  ];
  return (
    <Page
      title="Обзор дня"
      subtitle={
        <>
          <span className="day-date">{displayDate(day.date, 'full')}</span>
        </>
      }
      actions={
        <form method="get" className="row day-date-picker">
          <Input type="date" name="date" aria-label="Дата рабочего дня" defaultValue={day.date} />
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
      }
    >
      <section className="desk-metrics" aria-label="Сводка рабочего дня">
        {metrics.map((m) => (
          <article key={m.id} className={`desk-metric desk-metric--${m.tone}`}>
            <div className="desk-metric-top">
              <span>{m.label}</span>
              <span className="desk-metric-icon">
                <Icon name={m.icon} />
              </span>
            </div>
            <strong className="desk-metric-value" data-testid={m.id}>
              {m.value}
            </strong>
            <div className="desk-metric-hint">
              {m.count !== undefined && <span data-testid={m.countId}>{m.count}</span>} {m.hint}
            </div>
          </article>
        ))}
      </section>
      <div className="desk-layout">
        <DayWorkspace day={day} />
        <aside className="desk-aside" aria-label="Задачи и размещение">
          <DayAttention day={day} />
          <section className="desk-board-card">
            <h2>Размещение</h2>

            <Link href={`/chessboard?from=${day.date}`} className="btn btn--secondary">
              Открыть шахматку <Icon name="arrow" />
            </Link>
          </section>
        </aside>
      </div>
    </Page>
  );
}
