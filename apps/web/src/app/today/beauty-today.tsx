import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { STATUS_WORD } from '../beauty/appointment-status';
import { clock } from '../beauty/time';
import { loadBeautyToday } from './vertical-load';
import { VerticalDay, type DayAttention } from './vertical-day';

/** «Сегодня» салона (MV8): день журнала филиала одним запросом `GET /beauty/appointments` */
export async function BeautyToday() {
  const loaded = await loadBeautyToday(new Date().toISOString()).then(
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
  const { day, metrics: m } = loaded.value;
  const attention: DayAttention[] = [];
  if (m.awaitingConfirmation > 0)
    attention.push({
      text: `Ждут подтверждения: ${m.awaitingConfirmation}`,
      href: '/calendar',
      action: 'Открыть календарь',
      testId: 'today-attention-unconfirmed',
    });
  if (m.noShow > 0)
    attention.push({
      text: `Не пришли: ${m.noShow}`,
      href: '/calendar',
      action: 'Открыть календарь',
      testId: 'today-attention-no-show',
    });
  return (
    <VerticalDay
      testId="beauty-today"
      subtitle={`${day.location.name ?? 'Салон'}, ${displayDate(day.date, 'full')}`}
      action={{ href: '/calendar', label: 'Открыть календарь' }}
      stats={[
        { label: 'Запланировано', value: m.planned, testId: 'today-planned' },
        { label: 'Подтверждено', value: m.confirmed, testId: 'today-confirmed' },
        { label: 'Завершено', value: m.done, testId: 'today-done' },
        { label: 'Мастеров', value: m.masters, testId: 'today-masters' },
      ]}
      attention={attention}
      upcomingTitle="Ближайшие записи"
      upcoming={m.upcoming.map((u) => ({
        id: u.id,
        time: `${clock(u.startMinutes)}–${clock(u.endMinutes)}`,
        title: u.customer,
        detail: `${u.service}, ${u.master}`,
        status: STATUS_WORD[u.status],
      }))}
      empty="Записей впереди на сегодня нет."
    />
  );
}
