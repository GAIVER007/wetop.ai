import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { foodStatusLabels } from '../../lib/food-data';
import { localInput } from '../beauty/time';
import { pluralRu } from '../../lib/plural';
import { loadFoodToday } from './vertical-load';
import { VerticalDay, type DayAttention } from './vertical-day';

/** «Сегодня» ресторана (MV8): залы, столы и брони дня филиала, плюс вчерашние брони через полночь */
export async function FoodToday() {
  const loaded = await loadFoodToday(new Date().toISOString()).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="Сегодня">
        <LoadError testId="today-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { date, timezone, branchName, metrics: m } = loaded.value;
  const attention: DayAttention[] =
    m.withoutTable > 0
      ? [
          {
            text: `Брони без стола: ${m.withoutTable}`,
            href: `/table-reservations?date=${date}`,
            action: 'Открыть бронирования',
            testId: 'today-attention-no-table',
          },
        ]
      : [];
  return (
    <VerticalDay
      testId="food-today"
      subtitle={`${branchName}, ${displayDate(date, 'full')}`}
      action={{ href: '/floor-plan', label: 'Открыть план зала' }}
      stats={[
        { label: 'Бронирований', value: m.reservations, testId: 'today-reservations' },
        { label: 'Гостей в бронях', value: m.guests, testId: 'today-guests' },
        { label: 'Сидят сейчас', value: m.seatedNow, testId: 'today-seated' },
        {
          label: 'Свободно столов сейчас',
          value: m.freeNow,
          testId: 'today-free',
          hint: `из ${m.activeTables}`,
        },
        { label: 'Не пришли', value: m.noShow, testId: 'today-no-show', tone: 'warn' },
        { label: 'Отменено', value: m.cancelled, testId: 'today-cancelled' },
      ]}
      attention={attention}
      upcomingTitle="Ближайшие брони"
      upcoming={m.upcoming.map((u) => ({
        id: u.id,
        time: localInput(u.startsAt, timezone).slice(11, 16),
        title: u.guest,
        detail: `${pluralRu(u.partySize, ['гость', 'гостя', 'гостей'])}, ${u.table ? `стол ${u.table}` : 'без стола'}`,
        status: foodStatusLabels[u.status],
      }))}
      empty="Броней впереди на сегодня нет."
    />
  );
}
