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
  if (m.unconfirmed > 0)
    attention.push({
      text: `Не подтверждены записи: ${m.unconfirmed}`,
      href: '/calendar',
      action: 'Открыть календарь',
      testId: 'today-attention-unconfirmed',
    });
  if (m.unavailableMaster > 0)
    attention.push({
      text: `Записи к мастеру, которого нет в графике дня: ${m.unavailableMaster}`,
      href: '/calendar',
      action: 'Открыть календарь',
      testId: 'today-attention-master',
    });
  return (
    <VerticalDay
      testId="beauty-today"
      subtitle={`${day.location.name ?? 'Салон'}, ${displayDate(day.date, 'full')}`}
      action={{ href: '/calendar', label: 'Открыть календарь' }}
      stats={[
        { label: 'Записей', value: m.appointments, testId: 'today-appointments' },
        { label: 'Впереди', value: m.remaining, testId: 'today-remaining' },
        { label: 'Мастеров', value: m.masters, testId: 'today-masters' },
        { label: 'Завершено', value: m.done, testId: 'today-done' },
        { label: 'Не пришли', value: m.noShow, testId: 'today-no-show', tone: 'warn' },
        { label: 'Отменено', value: m.cancelled, testId: 'today-cancelled' },
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
