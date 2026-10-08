import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { localInput } from '../beauty/time';
import { pluralRu } from '../../lib/plural';
import { loadFoodToday } from './vertical-load';
import { VerticalDay, type DayAttention } from './vertical-day';
import { foodStatus } from '../../lib/status/food';

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
  const reservations = `/table-reservations?date=${date}`;
  const attention: DayAttention[] = [];
  if (m.withoutTable > 0)
    attention.push({
      text: `Без стола: ${m.withoutTable}`,
      href: reservations,
      action: 'Открыть бронирования',
      testId: 'today-attention-no-table',
    });
  if (m.awaitingConfirmation > 0)
    attention.push({
      text: `Ждут подтверждения: ${m.awaitingConfirmation}`,
      href: reservations,
      action: 'Открыть бронирования',
      testId: 'today-attention-unconfirmed',
    });
  if (m.noShow > 0)
    attention.push({
      text: `Не пришли: ${m.noShow}`,
      href: reservations,
      action: 'Открыть бронирования',
      testId: 'today-attention-no-show',
    });
  return (
    <VerticalDay
      testId="food-today"
      subtitle={`${branchName}, ${displayDate(date, 'full')}`}
      action={{ href: '/floor-plan', label: 'Открыть план зала' }}
      stats={[
        { label: 'Запланировано', value: m.planned, testId: 'today-planned' },
        { label: 'Сидят сейчас', value: m.seatedNow, testId: 'today-seated' },
        { label: 'Завершено', value: m.completed, testId: 'today-completed' },
        {
          label: 'Свободно столов сейчас',
          value: m.freeNow,
          testId: 'today-free',
          hint: `из ${m.activeTables}`,
        },
      ]}
      attention={attention}
      upcomingTitle="Ближайшие брони"
      upcoming={m.upcoming.map((u) => ({
        id: u.id,
        time: localInput(u.startsAt, timezone).slice(11, 16),
        title: u.guest,
        detail: `${pluralRu(u.partySize, ['гость', 'гостя', 'гостей'])}, ${u.table ? `стол ${u.table}` : 'без стола'}`,
        status: foodStatus[u.status].label,
      }))}
      empty="Броней впереди на сегодня нет."
    />
  );
}
