import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import {
  ApiError,
  marketingVoiceApi,
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
import { CloseCallbackButton } from './close-button';
import { callbackStatusLabel, formatDuration, formatPhone, formatWhen, stateBadge, summaryItems } from './format';

/**
 * Модуль «Голосовой агент» (ИИ-колл-центр, docs/voice/voice-channel.md, DATA_MODEL VOICE-OWNER-APPROVAL-20261022).
 * Итоги месяца, журнал звонков и очередь просьб перезвонить. Данные из API `/marketing/voice` (право `marketing`,
 * филиал строго из указателя). Полные телефоны видны только у просьб; в журнале номер маской. Ничего не выдумываем:
 * без звонков стоит «Нет данных» и памятка, как подключить номер.
 */
type Loaded =
  | { summary: VoiceSummaryView; calls: VoiceCallsView; callbacks: VoiceCallbackRow[]; done: VoiceCallbackRow[] }
  | { chooseLocation: true }
  | { error: ReturnType<typeof loadErrorProps> };

async function load(month: string | undefined): Promise<Loaded> {
  try {
    const [summary, calls, callbacks, done] = await Promise.all([
      marketingVoiceApi.summary(month),
      marketingVoiceApi.calls(month, 50, 0),
      marketingVoiceApi.callbacks('NEW', 100),
      marketingVoiceApi.callbacks('DONE', 10),
    ]);
    return { summary, calls, callbacks, done };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 409) return { chooseLocation: true };
    return { error: loadErrorProps(e) };
  }
}

/** В ссылку tel: идут только плюс и цифры: служебные знаки номеронабирателя (; , #) из данных не пропускаем */
const telDigits = (phone: string) => phone.replace(/[^+\d]/g, '');

const SETUP_STEPS = [
  'Номер у SIP-провайдера (например Twilio) и шлюзы в панели VideoSDK.',
  'Правило маршрутизации: звонок на ваш номер идёт на агента-воркера, в metadata правила указаны организация и агент.',
  'Агент ИИ-продавца этого филиала в состоянии «Действует».',
  'Ключ приёма событий и запуск воркера на сервере: делает владелец, значения ключей здесь не вводятся.',
];

function Summary({ summary }: { summary: VoiceSummaryView }) {
  return (
    <dl className="money-summary" data-testid="voice-summary">
      {summaryItems(summary).map((item) => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd data-testid={`voice-summary-${item.key}`} className={item.value === 'Нет данных' ? 'muted' : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SetupNote() {
  return (
    <section className="panel" aria-labelledby="voice-setup-title" data-testid="voice-setup">
      <h2 id="voice-setup-title" className="marketing-screen__title">
        Как подключить голосового агента
      </h2>
      <ol className="settings-note">
        {SETUP_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="settings-note">
        Агент называет себя ИИ-помощником и предупреждает, что разговор записывается. Запись, бронь и заказ стола по телефону он не оформляет:
        собирает имя и номер и оставляет просьбу перезвонить.
      </p>
    </section>
  );
}

function CallbackList({
  rows,
  editable,
  done,
  timezone,
}: {
  rows: VoiceCallbackRow[];
  editable: boolean;
  done: VoiceCallbackRow[];
  /** пояс филиала: время просьбы показывается так же, как в журнале (AGENTS.md §13) */
  timezone: string;
}) {
  return (
    <div className="marketing-screen__stack">
      {rows.length === 0 ? (
        <EmptyState title="Просьб перезвонить нет" data-testid="voice-callbacks-empty">
          Когда клиент попросит записать его или перезвонить, просьба появится здесь с номером и пожеланием.
        </EmptyState>
      ) : (
        <div className="tbl-wrap" role="region" aria-label="Просьбы перезвонить" tabIndex={0}>
          <Table density="normal" aria-label="Просьбы перезвонить" data-testid="voice-callbacks">
            <thead>
              <tr>
                <th scope="col">Клиент</th>
                <th scope="col">Телефон</th>
                <th scope="col">Пожелание</th>
                <th scope="col">Получена</th>
                <th scope="col">Статус</th>
                {editable && (
                  <th scope="col">
                    <span className="sr-only">Действия</span>
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
                    <Badge tone={c.status === 'NEW' ? 'warn' : 'ok'}>{callbackStatusLabel(c.status)}</Badge>
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
          Недавно обработано: {done.map((c) => `${c.name || formatPhone(c.phone)}`).join(', ')}.
        </p>
      )}
    </div>
  );
}

function CallsTable({ view }: { view: VoiceCallsView }) {
  if (view.rows.length === 0)
    return (
      <EmptyState title="Звонков за месяц нет" data-testid="voice-calls-empty">
        Когда агент примет первый звонок, он появится в журнале. Подключение номера описано во вкладке «Подключение».
      </EmptyState>
    );
  return (
    <div className="marketing-screen__stack">
      <div className="tbl-wrap" role="region" aria-label="Журнал звонков" tabIndex={0}>
        <Table density="normal" aria-label="Журнал звонков" data-testid="voice-calls">
          <thead>
            <tr>
              <th scope="col">Время</th>
              <th scope="col">Звонивший</th>
              <th scope="col">Состояние</th>
              <th scope="col" className="budget-td-num">Разговор</th>
              <th scope="col">Итог</th>
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
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  <td className="budget-td-num">{formatDuration(r.durationSeconds)}</td>
                  <td>
                    {[r.callbackRequested ? 'просьба перезвонить' : null, r.transferRequested ? 'переведён на человека' : null]
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
          Показаны последние {view.rows.length} из {view.total} звонков месяца.
        </p>
      )}
    </div>
  );
}

/** Что агент называет по телефону, зависит от направления (docs/voice/voice-channel.md) */
const SUBTITLE: Record<string, string> = {
  BEAUTY:
    'ИИ-помощник принимает телефонные звонки: отвечает по услугам и ценам, собирает просьбы перезвонить и переводит на администратора.',
  FOOD_SERVICE:
    'ИИ-помощник принимает телефонные звонки: рассказывает о часах работы, собирает просьбы перезвонить и переводит на администратора.',
  HOSPITALITY:
    'ИИ-помощник принимает телефонные звонки, собирает просьбы перезвонить и переводит на администратора.',
};

export default async function MarketingVoicePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireFeature('/marketing/voice');
  const q = normalizeSearchParams(await searchParams);
  const month = /^\d{4}-\d{2}$/.test(q['month'] ?? '') ? q['month'] : undefined;
  const [loaded, shell] = await Promise.all([load(month), deskShell()]);
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  return (
    <Page
      crumbs={<BackToModules />}
      title="Голосовой агент"
      subtitle={SUBTITLE[me.context?.vertical ?? 'HOSPITALITY'] ?? SUBTITLE['HOSPITALITY']}
    >
      <div className="marketing-screen" data-testid="marketing-voice-screen">
        {'summary' in loaded ? (
          <>
            <div className="budget-head">
              <span />
              <MonthNav base="/marketing/voice" month={loaded.summary.month} />
            </div>
            <Summary summary={loaded.summary} />
            <Tabs
              label="Разделы голосового агента"
              panels={[
                {
                  id: 'callbacks',
                  label: `Просьбы перезвонить${loaded.callbacks.length ? ` (${loaded.callbacks.length})` : ''}`,
                  content: (
                    <CallbackList
                      rows={loaded.callbacks}
                      editable={editable}
                      done={loaded.done}
                      timezone={loaded.summary.timezone}
                    />
                  ),
                },
                { id: 'calls', label: 'Журнал звонков', content: <CallsTable view={loaded.calls} /> },
                { id: 'setup', label: 'Подключение', content: <SetupNote /> },
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
