import Link from 'next/link';
import { deskApi, formatMinor } from '../../lib/api';
import { DayWorkspace } from './day-workspace';
import { Icon } from '../../components/icon';
import { Page } from '../../components/page';
import { Button, Input, Stat, Stats } from '../../components/ui';

/** Рабочий день стойки: что делать сегодня (SPEC §6). Первое, что открывает администратор утром. */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const day = await deskApi.today(sp.date);
  const debt = day.debtMinor !== '0';
  return (
    <Page
      title={`Сегодня, ${day.date}`}
      subtitle="Рабочий день хостела — заезды, выезды и всё, что требует внимания"
      actions={
        <form method="get" className="row">
          <Input type="date" name="date" aria-label="Дата рабочего дня" defaultValue={day.date} />
          <Button type="submit" tone="secondary">
            Показать
          </Button>
        </form>
      }
    >
      {/*
       * Четыре числа вместо шести: «из них не заселены» — не отдельный показатель, а хвост заезда,
       * поэтому он подписью внутри плитки. Плитки всегда белые; цветом выделено только то, что требует
       * действия — незакрытые заезды/выезды и долг.
       */}
      <Stats min={190}>
        <Stat
          label="Заезды"
          value={String(day.counts.arrivals)}
          testId="c-arrivals"
          hint={
            <>
              <span data-testid="c-tocheckin">{day.counts.toCheckIn}</span> ещё не заселены
            </>
          }
          hintTone={day.counts.toCheckIn > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Выезды"
          value={String(day.counts.departures)}
          testId="c-departures"
          hint={
            <>
              <span data-testid="c-tocheckout">{day.counts.toCheckOut}</span> ещё не выселены
            </>
          }
          hintTone={day.counts.toCheckOut > 0 ? 'warn' : undefined}
        />
        <Stat label="Живут" value={String(day.counts.inHouse)} testId="c-inhouse" hint="в доме" />
        <Stat
          label="Долг уезжающих"
          value={
            <span className={debt ? 'danger-text' : undefined} data-testid="c-debt">
              {formatMinor(day.debtMinor)}
            </span>
          }
          hint={debt ? 'спросить при выезде' : 'все рассчитались'}
        />
      </Stats>

      <div className="day-shortcuts">
        <div>
          <span className="shortcut-icon">
            <Icon name="board" />
          </span>
          <div>
            <strong>Всё размещение — на шахматке</strong>
            <p>Свободные места, переселения и брони без назначенной ячейки.</p>
          </div>
        </div>
        <Link href={`/chessboard?from=${day.date}`} className="btn btn--secondary">
          Открыть шахматку <Icon name="arrow" />
        </Link>
      </div>
      <DayWorkspace day={day} />
    </Page>
  );
}
