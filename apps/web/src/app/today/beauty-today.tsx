import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { clock } from '../beauty/time';
import { loadBeautyToday } from './vertical-load';
import { VerticalDay, fullDay, type DayAttention } from './vertical-day';
import { UNAVAILABLE_MASTER } from './vertical-metrics';
import { translator } from '../../i18n';
import { currentLocale } from '../../i18n/server';
import { beautyStatus } from '../../lib/status/beauty';
import { Tabs } from '../../components/tabs';

/**
 * «Сегодня» салона: «Главная» по макету ТЗ «Модуль для салонов красоты» (09.10.2026).
 * Один запрос `GET /beauty/appointments`; выручка это сумма снимков цен DONE (Q-252), сравнений
 * со вчера нет (второго запроса не делаем), чисел макета не имитируем.
 */
export async function BeautyToday({ operations = false }: { operations?: boolean } = {}) {
  const locale = await currentLocale();
  const t = translator(locale);
  const loaded = await loadBeautyToday(new Date().toISOString()).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title={operations ? t('Рабочий день') : t('Главная')}>
        <LoadError testId="today-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const { day, metrics: m } = loaded.value;
  const attention: DayAttention[] = [];
  if (m.awaitingConfirmation > 0)
    attention.push({
      text: t('Ждут подтверждения: {n}', { n: m.awaitingConfirmation }),
      href: '/calendar',
      action: t('Открыть журнал'),
      testId: 'today-attention-unconfirmed',
    });
  if (m.noShow > 0)
    attention.push({
      text: t('Не пришли: {n}', { n: m.noShow }),
      href: '/calendar',
      action: t('Открыть журнал'),
      testId: 'today-attention-no-show',
    });
  const [revenue, ...otherCurrencies] = m.revenue;
  return (
    <VerticalDay
      testId="beauty-today"
      t={t}
      // подписи по меню салона (решение владельца 18.10.2026): «Главная», «Журнал», «Специалисты»;
      // /today/operations это «Рабочий день» с вкладками назад к обзору (аудит 21.10.2026, п. 11)
      title={operations ? t('Рабочий день') : t('Главная')}
      tabs={
        operations ? (
          <Tabs
            label={t('Главная')}
            items={[
              { href: '/today', label: t('Обзор'), current: false },
              { href: '/today/operations', label: t('Рабочий день'), current: true },
            ]}
          />
        ) : undefined
      }
      subtitle={`${day.location.name ?? t('Салон')}, ${fullDay(day.date, locale)}`}
      // главное действие смены сразу видно; запись создаётся в журнале
      action={{ href: '/calendar', label: t('+ Новая запись'), primary: true }}
      // числа дня в заголовках списков, без плиток над ними (аудит 21.10.2026, п. 12)
      upcomingSummary={
        <>
          {t('Записей сегодня:')} <b data-testid="today-total">{m.total}</b>, {t('клиентов:')}{' '}
          <b data-testid="today-clients">{m.clients}</b>, {t('выручка:')}{' '}
          <b data-testid="today-revenue">
            {formatMoney(revenue?.minor ?? '0', revenue?.currency ?? day.location.currency)}
          </b>
          {otherCurrencies.length > 0 &&
            ` ${t('и')} ${otherCurrencies.map((r) => formatMoney(r.minor, r.currency)).join(', ')}`}
        </>
      }
      attention={attention}
      upcomingTitle={t('Ближайшие записи')}
      upcoming={m.upcoming.map((u) => ({
        id: u.id,
        time: `${clock(u.startMinutes)}–${clock(u.endMinutes)}`,
        title: u.customer,
        detail: `${u.service}, ${u.master === UNAVAILABLE_MASTER ? t(UNAVAILABLE_MASTER) : u.master}`,
        status: t(beautyStatus[u.status].label),
      }))}
      empty={t('Записей впереди на сегодня нет.')}
      aside={{
        title: t('Специалисты на смене'),
        summary: (
          <>
            {t('На смене:')} <b data-testid="today-shift">{t('{done} из {total}', { done: m.onShift, total: m.masters })}</b>
          </>
        ),
        empty: t('Сегодня смен нет.'),
        rows: m.shift.map((s) => ({
          id: s.id,
          title: s.name,
          detail: s.hours,
          note: pluralRu(s.appointments, [t('запись'), t('записи'), t('записей')]),
        })),
      }}
    />
  );
}
