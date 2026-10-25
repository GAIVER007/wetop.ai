import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import {
  ApiError,
  marketingVoiceApi,
  type VoiceBookingsView,
  type VoiceBookingView,
  type VoiceCallbackRow,
  type VoiceCallsView,
  type VoiceSummaryView,
} from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { loadErrorProps } from '../../../lib/load-error';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import '../marketing.css';
import '../budget/budget.css';
import '../../finance/summary.css';
import { LoadError } from '../../../components/load-error';
import { Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Badge, EmptyState, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import { ChooseLocation, MonthNav } from '../budget/parts';
import { BookingForm } from './booking-form';
import { CloseCallbackButton } from './close-button';
import {
  bookingKindLabel,
  bookingStatus,
  bookingTitle,
  callbackStatusLabel,
  formatDuration, formatPhone, formatWhen, stateBadge, summaryItems } from './format';
import { msg, type DeskLocale, type Translate } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';

/**
 * Модуль «Голосовой агент» (ИИ-колл-центр, docs/voice/voice-channel.md, DATA_MODEL VOICE-OWNER-APPROVAL-20261022).
 * Итоги месяца, журнал звонков и очередь просьб перезвонить. Данные из API `/marketing/voice` (право `marketing`,
 * филиал строго из указателя). Полные телефоны видны только у просьб; в журнале номер маской. Ничего не выдумываем:
 * без звонков стоит «Нет данных» и памятка, как подключить номер.
 */
type Loaded =
  | {
      summary: VoiceSummaryView;
      calls: VoiceCallsView;
      callbacks: VoiceCallbackRow[];
      done: VoiceCallbackRow[];
      booking: VoiceBookingView | null;
      bookings: VoiceBookingsView | null;
    }
  | { chooseLocation: true }
  | { error: ReturnType<typeof loadErrorProps> };

async function load(month: string | undefined): Promise<Loaded> {
  try {
    const [summary, calls, callbacks, done, booking, bookings] = await Promise.all([
      marketingVoiceApi.summary(month),
      marketingVoiceApi.calls(month, 50, 0),
      marketingVoiceApi.callbacks('NEW', 100),
      marketingVoiceApi.callbacks('DONE', 10),
      // настройка брони не должна ронять весь экран: без неё вкладка просто не показывается
      marketingVoiceApi.booking().catch(() => null),
      marketingVoiceApi.bookings(7).catch(() => null),
    ]);
    return { summary, calls, callbacks, done, booking, bookings };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 409) return { chooseLocation: true };
    return { error: loadErrorProps(e) };
  }
}

/** В ссылку tel: идут только плюс и цифры: служебные знаки номеронабирателя (; , #) из данных не пропускаем */
const telDigits = (phone: string) => phone.replace(/[^+\d]/g, '');

const SETUP_STEPS = [
  msg('Номер у SIP-провайдера (например Twilio) и шлюзы в панели VideoSDK.'),
  msg('Правило маршрутизации: звонок на ваш номер идёт на агента-воркера, в metadata правила указаны организация и агент.'),
  msg('Агент ИИ-продавца этого филиала в состоянии «Действует».'),
  msg('Ключ приёма событий и запуск воркера на сервере: делает владелец, значения ключей здесь не вводятся.'),
];
const NO_DATA = msg('Нет данных');

function Summary({ summary, t, locale }: { summary: VoiceSummaryView; t: Translate; locale: DeskLocale }) {
  return (
    <dl className="money-summary" data-testid="voice-summary">
      {summaryItems(summary, locale).map((item) => (
        <div key={item.key}>
          <dt>{t(item.label)}</dt>
          <dd data-testid={`voice-summary-${item.key}`} className={item.value === NO_DATA ? 'muted' : undefined}>
            {t(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SetupNote({ t }: { t: Translate }) {
  return (
    <section className="panel" aria-labelledby="voice-setup-title" data-testid="voice-setup">
      <h2 id="voice-setup-title" className="marketing-screen__title">
        {t('Как подключить голосового агента')}
      </h2>
      <ol className="settings-note">
        {SETUP_STEPS.map((step) => (
          <li key={step}>{t(step)}</li>
        ))}
      </ol>
      <p className="settings-note">
        {t(
          'Агент называет себя ИИ-помощником и предупреждает, что разговор записывается. Пока бронь по телефону выключена, он записи, брони и заказа стола не оформляет: собирает имя и номер и оставляет просьбу перезвонить. Включается она во вкладке «Бронь по телефону».',
        )}
      </p>
    </section>
  );
}

function CallbackList({
  rows,
  editable,
  done,
  timezone,
  t,
}: {
  t: Translate;
  rows: VoiceCallbackRow[];
  editable: boolean;
  done: VoiceCallbackRow[];
  /** пояс филиала: время просьбы показывается так же, как в журнале (AGENTS.md §13) */
  timezone: string;
}) {
  return (
    <div className="marketing-screen__stack">
      {rows.length === 0 ? (
        <EmptyState title={t('Просьб перезвонить нет')} data-testid="voice-callbacks-empty">
          {t('Когда клиент попросит записать его или перезвонить, просьба появится здесь с номером и пожеланием.')}
        </EmptyState>
      ) : (
        <div className="tbl-wrap" role="region" aria-label={t('Просьбы перезвонить')} tabIndex={0}>
          <Table density="normal" aria-label={t('Просьбы перезвонить')} data-testid="voice-callbacks">
            <thead>
              <tr>
                <th scope="col">{t('Клиент')}</th>
                <th scope="col">{t('Телефон')}</th>
                <th scope="col">{t('Пожелание')}</th>
                <th scope="col">{t('Получена')}</th>
                <th scope="col">{t('Статус')}</th>
                {editable && (
                  <th scope="col">
                    <span className="sr-only">{t('Действия')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} data-testid={`voice-callback-${c.id}`}>
                  <td>{c.name || '–'}</td>
                  <td>
                    <a href={`tel:${telDigits(c.phone)}`}>{formatPhone(c.phone)}</a>
                  </td>
                  <td>{c.note || '–'}</td>
                  <td>{formatWhen(c.createdAt, timezone)}</td>
                  <td>
                    <Badge tone={c.status === 'NEW' ? 'warn' : 'ok'}>{t(callbackStatusLabel(c.status))}</Badge>
                  </td>
                  {editable && (
                    <td>
                      <CloseCallbackButton id={c.id} name={c.name} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      {done.length > 0 && (
        <p className="settings-note" data-testid="voice-callbacks-done">
          {t('Недавно обработано: {names}.', { names: done.map((c) => `${c.name || formatPhone(c.phone)}`).join(', ') })}
        </p>
      )}
    </div>
  );
}

/** Брони, принятые агентом по телефону: что, когда, статус сейчас. Имён и телефонов гостей здесь нет (карточка брони по своим правам) */
function BookingsList({ view, t, locale }: { view: VoiceBookingsView; t: Translate; locale: DeskLocale }) {
  if (view.rows.length === 0)
    return (
      <EmptyState title={t('Броней по телефону пока нет')} data-testid="voice-bookings-empty">
        {t('Когда агент примет бронь, она появится здесь с видом, временем и статусом. Включить приём броней можно во вкладке «Бронь по телефону».')}
      </EmptyState>
    );
  return (
    <div className="marketing-screen__stack">
      <p className="settings-note" data-testid="voice-bookings-note">
        {t('За {days} дней принято {count}, за последние сутки {last}. Имена и телефоны гостей смотрите в карточке брони.', {
          days: view.days,
          count: view.rows.length,
          last: view.last24h,
        })}
      </p>
      <div className="tbl-wrap" role="region" aria-label={t('Брони по телефону')} tabIndex={0}>
        <Table density="normal" aria-label={t('Брони по телефону')} data-testid="voice-bookings">
          <thead>
            <tr>
              <th scope="col">{t('Принята')}</th>
              <th scope="col">{t('Вид')}</th>
              <th scope="col">{t('Что')}</th>
              <th scope="col">{t('Статус')}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => {
              const status = bookingStatus(r.kind, r.status);
              return (
                <tr key={r.id} data-testid={`voice-booking-${r.id}`}>
                  <td>{formatWhen(r.at, view.timezone)}</td>
                  <td>{t(bookingKindLabel(r.kind))}</td>
                  <td>{bookingTitle(r, view.timezone, locale) || '–'}</td>
                  <td>
                    <Badge tone={status.tone}>{t(status.label)}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function CallsTable({ view, t, locale }: { view: VoiceCallsView; t: Translate; locale: DeskLocale }) {
  if (view.rows.length === 0)
    return (
      <EmptyState title={t('Звонков за месяц нет')} data-testid="voice-calls-empty">
        {t('Когда агент примет первый звонок, он появится в журнале. Подключение номера описано во вкладке «Подключение».')}
      </EmptyState>
    );
  return (
    <div className="marketing-screen__stack">
      <div className="tbl-wrap" role="region" aria-label={t('Журнал звонков')} tabIndex={0}>
        <Table density="normal" aria-label={t('Журнал звонков')} data-testid="voice-calls">
          <thead>
            <tr>
              <th scope="col">{t('Время')}</th>
              <th scope="col">{t('Звонивший')}</th>
              <th scope="col">{t('Состояние')}</th>
              <th scope="col" className="budget-td-num">
                {t('Разговор')}
              </th>
              <th scope="col">{t('Итог')}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => {
              const badge = stateBadge(r.state);
              return (
                <tr key={r.id} data-testid={`voice-call-${r.id}`}>
                  <td>{formatWhen(r.receivedAt, view.timezone)}</td>
                  <td>{r.callerMasked ?? '–'}</td>
                  <td>
                    <Badge tone={badge.tone}>{t(badge.label)}</Badge>
                  </td>
                  <td className="budget-td-num">{formatDuration(r.durationSeconds, locale)}</td>
                  <td>
                    {[r.callbackRequested ? t('просьба перезвонить') : null, r.transferRequested ? t('переведён на человека') : null]
                      .filter(Boolean)
                      .join(', ') || '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      {view.total > view.rows.length && (
        <p className="settings-note" data-testid="voice-calls-more">
          {t('Показаны последние {shown} из {total} звонков месяца.', { shown: view.rows.length, total: view.total })}
        </p>
      )}
    </div>
  );
}

/** Что агент называет по телефону, зависит от направления (docs/voice/voice-channel.md) */
const SUBTITLE: Record<string, string> = {
  BEAUTY: msg(
    'ИИ-помощник принимает телефонные звонки: отвечает по услугам и ценам, записывает клиентов (если включена бронь по телефону), собирает просьбы перезвонить и переводит на администратора.',
  ),
  FOOD_SERVICE: msg(
    'ИИ-помощник принимает телефонные звонки: рассказывает о часах работы, бронирует (если включена бронь по телефону), собирает просьбы перезвонить и переводит на администратора.',
  ),
  HOSPITALITY: msg(
    'ИИ-помощник принимает телефонные звонки, бронирует номера (если включена бронь по телефону), собирает просьбы перезвонить и переводит на администратора.',
  ),
};

export default async function MarketingVoicePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireFeature('/marketing/voice');
  const q = normalizeSearchParams(await searchParams);
  const month = /^\d{4}-\d{2}$/.test(q['month'] ?? '') ? q['month'] : undefined;
  const [loaded, shell, t, locale] = await Promise.all([load(month), deskShell(), serverT(), currentLocale()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  return (
    <Page
      crumbs={<BackToModules />}
      title={t('Голосовой агент')}
      subtitle={t(SUBTITLE[me.context?.vertical ?? 'HOSPITALITY'] ?? SUBTITLE['HOSPITALITY']!)}
    >
      <div className="marketing-screen" data-testid="marketing-voice-screen">
        {'summary' in loaded ? (
          <>
            <div className="budget-head">
              <span />
              <MonthNav base="/marketing/voice" month={loaded.summary.month} />
            </div>
            <Summary summary={loaded.summary} t={t} locale={locale} />
            <Tabs
              label={t('Разделы голосового агента')}
              panels={[
                {
                  id: 'callbacks',
                  label: `${t('Просьбы перезвонить')}${loaded.callbacks.length ? ` (${loaded.callbacks.length})` : ''}`,
                  content: (
                    <CallbackList
                      rows={loaded.callbacks}
                      editable={editable}
                      done={loaded.done}
                      timezone={loaded.summary.timezone}
                      t={t}
                    />
                  ),
                },
                ...(loaded.bookings
                  ? [
                      {
                        id: 'bookings',
                        label: `${t('Брони по телефону')}${loaded.bookings.last24h ? ` (${loaded.bookings.last24h})` : ''}`,
                        content: <BookingsList view={loaded.bookings} t={t} locale={locale} />,
                      },
                    ]
                  : []),
                { id: 'calls', label: t('Журнал звонков'), content: <CallsTable view={loaded.calls} t={t} locale={locale} /> },
                ...(loaded.booking
                  ? [
                      {
                        id: 'booking',
                        label: t('Бронь по телефону'),
                        content: <BookingForm view={loaded.booking} editable={editable} />,
                      },
                    ]
                  : []),
                { id: 'setup', label: t('Подключение'), content: <SetupNote t={t} /> },
              ]}
            />
          </>
        ) : 'chooseLocation' in loaded ? (
          <ChooseLocation />
        ) : (
          <LoadError testId="voice-error" {...loaded.error} />
        )}
      </div>
    </Page>
  );
}
