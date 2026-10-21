import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { clock } from '../beauty/time';
import { loadBeautyToday } from './vertical-load';
import { VerticalDay, type DayAttention } from './vertical-day';
import { beautyStatus } from '../../lib/status/beauty';
import { Tabs } from '../../components/tabs';

/**
 * «Сегодня» салона: «Главная» по макету ТЗ «Модуль для салонов красоты» (09.10.2026).
 * Один запрос `GET /beauty/appointments`; выручка это сумма снимков цен DONE (Q-252), сравнений
 * со вчера нет (второго запроса не делаем), чисел макета не имитируем.
 */
export async function BeautyToday({ operations = false }: { operations?: boolean } = {}) {
  const loaded = await loadBeautyToday(new Date().toISOString()).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title={operations ? 'Рабочий день' : 'Главная'}>
        <LoadError testId="today-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { day, metrics: m } = loaded.value;
  const attention: DayAttention[] = [];
  if (m.awaitingConfirmation > 0)
    attention.push({
      text: `Ждут подтверждения: ${m.awaitingConfirmation}`,
      href: '/calendar',
      action: 'Открыть журнал',
      testId: 'today-attention-unconfirmed',
    });
  if (m.noShow > 0)
    attention.push({
      text: `Не пришли: ${m.noShow}`,
      href: '/calendar',
      action: 'Открыть журнал',
      testId: 'today-attention-no-show',
    });
  const [revenue, ...otherCurrencies] = m.revenue;
  return (
    <VerticalDay
      testId="beauty-today"
      // подписи по меню салона (решение владельца 18.10.2026): «Главная», «Журнал», «Специалисты»;
      // /today/operations это «Рабочий день» с вкладками назад к обзору (аудит 21.10.2026, п. 11)
      title={operations ? 'Рабочий день' : 'Главная'}
      tabs={
        operations ? (
          <Tabs
            label="Главная"
            items={[
              { href: '/today', label: 'Обзор', current: false },
              { href: '/today/operations', label: 'Рабочий день', current: true },
            ]}
          />
        ) : undefined
      }
      subtitle={`${day.location.name ?? 'Салон'}, ${displayDate(day.date, 'full')}`}
      // главное действие смены сразу видно; запись создаётся в журнале
      action={{ href: '/calendar', label: '+ Новая запись', primary: true }}
      // числа дня в заголовках списков, без плиток над ними (аудит 21.10.2026, п. 12)
      upcomingSummary={
        <>
          Записей сегодня: <b data-testid="today-total">{m.total}</b>, клиентов:{' '}
          <b data-testid="today-clients">{m.clients}</b>, выручка:{' '}
          <b data-testid="today-revenue">
            {formatMoney(revenue?.minor ?? '0', revenue?.currency ?? day.location.currency)}
          </b>
          {otherCurrencies.length > 0 &&
            ` и ${otherCurrencies.map((r) => formatMoney(r.minor, r.currency)).join(', ')}`}
        </>
      }
      attention={attention}
      upcomingTitle="Ближайшие записи"
      upcoming={m.upcoming.map((u) => ({
        id: u.id,
        time: `${clock(u.startMinutes)}–${clock(u.endMinutes)}`,
        title: u.customer,
        detail: `${u.service}, ${u.master}`,
        status: beautyStatus[u.status].label,
      }))}
      empty="Записей впереди на сегодня нет."
      aside={{
        title: 'Специалисты на смене',
        summary: (
          <>
            На смене: <b data-testid="today-shift">{`${m.onShift} из ${m.masters}`}</b>
          </>
        ),
        empty: 'Сегодня смен нет.',
        rows: m.shift.map((s) => ({
          id: s.id,
          title: s.name,
          detail: s.hours,
          note: pluralRu(s.appointments, ['запись', 'записи', 'записей']),
        })),
      }}
    />
  );
}
