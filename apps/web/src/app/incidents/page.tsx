import { guardApi } from '../../lib/api';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { Alert, Panel, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { GuardTickButton } from './buttons';
import { IncidentList } from './incident-list';
import { Suspense } from 'react';
import { RefreshButton } from '../../components/refresh-button';
import { ControlNavigation } from '../../components/control-navigation';
import '../directory.css';

/**
 * Неисправности системы — одно место (срез 11, ADR-028). Сторож проверяет систему раз в минуту и пишет сюда
 * всё, что сломалось. Технику он чинит сам; брони, места и деньги — только человек; ошибки кода — дежурный агент.
 */
const RESOLVED_BY_RU = { GUARD: 'сторож', AGENT: 'дежурный агент', STAFF: 'вручную' } as const;

/** Время по часам объекта: страница рендерится на сервере, у которого может быть другой пояс */
const atText = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
/** Время словами внутри `<time>`: сырое значение остаётся тестам и копированию (§14) */
const at = (iso: string | null) => (iso ? <time dateTime={iso}>{atText(iso)}</time> : '—');

/** Сколько записей истории читаем: если пришло ровно столько, список обрезан — и это написано на экране */
const HISTORY_LIMIT = 200;

/**
 * D4 (план владельца 19.09): отказ состояния сторожа — `LoadError` с повтором, а не строка «API не отвечает»;
 * пустые таблицы называют, что это значит и откуда возьмётся новая запись; время в `<time>`; на телефоне
 * строки складываются в карточки. Сторож, его проверки и действия по неисправностям не менялись.
 */
export default function IncidentsPage() {
  return (
    <Page
      title="Неисправности"
      subtitle="Состояние системы и задачи для команды."
      actions={
        <>
          <RefreshButton />
          <GuardTickButton />
        </>
      }
    >
      <ControlNavigation current="incidents" />
      <Suspense
        fallback={
          <Panel role="status" data-testid="incidents-loading">
            Читаем состояние сторожа…
          </Panel>
        }
      >
        <IncidentContent />
      </Suspense>
    </Page>
  );
}

async function IncidentContent() {
  const [loadedStatus, open, all] = await Promise.all([
    guardApi.status().then(
      (r) => ({ ok: true as const, r }),
      (e: unknown) => ({ ok: false as const, e }),
    ),
    guardApi.incidents('open').catch(() => null),
    guardApi.incidents('all', HISTORY_LIMIT).catch(() => null),
  ]);
  const status = loadedStatus.ok ? loadedStatus.r : null;
  const truncated = all !== null && all.length >= HISTORY_LIMIT;
  const dayAgo = Date.now() - 24 * 3_600_000;
  const closed = all?.filter(
    (i) => i.status === 'RESOLVED' && Date.parse(i.resolvedAt ?? '') > dayAgo,
  );
  const tick = status?.lastTick ?? null;
  return (
    <div className="control-page">
      {!loadedStatus.ok && (
        <LoadError testId="incidents-status-error" {...loadErrorProps(loadedStatus.e)} />
      )}
      {status && !status.notifier.configured && (
        <Alert boxed tone="warning" data-testid="notifier-missing">
          Уведомления не настроены. Неисправности доступны только здесь.
        </Alert>
      )}
      <Stats min={150}>
        <Stat label="Открыто" value={String(status?.open.total ?? '—')} testId="incidents-open" />
        <Stat
          label="Срочных"
          value={
            <span className={status && status.open.critical > 0 ? 'danger-text' : undefined}>
              {String(status?.open.critical ?? '—')}
            </span>
          }
        />
        <Stat
          label="Ждут человека"
          value={
            <span className={status && status.open.escalated > 0 ? 'danger-text' : undefined}>
              {String(status?.open.escalated ?? '—')}
            </span>
          }
        />
      </Stats>
      {status && (
        <div className="facts facts--card control-monitor">
          <div>
            <div className="fact__label">Мониторинг</div>
            <div className="fact__value" data-testid="guard-running">
              {status.running ? 'работает, проход раз в минуту' : 'выключен'}
            </div>
          </div>
          <div>
            <div className="fact__label">Автовосстановление</div>
            <div className="fact__value">{status.autofix ? 'включена' : 'выключено'}</div>
          </div>
          <div>
            <div className="fact__label">Последний проход</div>
            <div className="fact__value">{tick ? at(tick.at) : 'ещё не было'}</div>
            {tick && (
              <div className="cell-sub">
                проверок {tick.checked.length}
                {tick.checkErrors.length > 0 && (
                  <span className="danger-text">
                    , не отработали: {tick.checkErrors.map((e) => e.check).join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="fact__label">Уведомления</div>
            <div className="fact__value">
              {status.notifier.configured
                ? `Telegram, чатов: ${status.notifier.recipients}`
                : 'не настроен'}
            </div>
            {tick?.alertError && status.notifier.configured && (
              <div className="cell-sub danger-text">{tick.alertError}</div>
            )}
          </div>
        </div>
      )}

      <SectionTitle>Открытые</SectionTitle>
      {open === null && (
        <Alert boxed>
          Список неисправностей не загрузился. Обновите страницу — текущее состояние неизвестно.
        </Alert>
      )}
      {open !== null && (
        <IncidentList
          incidents={open.map(
            ({
              id,
              kind,
              class: incidentClass,
              severity,
              status: incidentStatus,
              title,
              occurrences,
              firstSeenAt,
              lastSeenAt,
              fixAttempts,
              lastFixResult,
              alertedAt,
            }) => ({
              id,
              kind,
              class: incidentClass,
              severity,
              status: incidentStatus,
              title,
              occurrences,
              firstSeenAt,
              lastSeenAt,
              fixAttempts,
              lastFixResult,
              alertedAt,
            }),
          )}
          total={status?.open.total ?? null}
          emptyHint={`Открытых неисправностей нет.${tick ? ` Последний проход в ${atText(tick.at)}: ${pluralRu(tick.checked.length, ['проверка', 'проверки', 'проверок'])}.` : ''} ${status?.running ? 'Сторож проверяет систему раз в минуту; новые записи появятся здесь.' : 'Автоматический мониторинг сейчас выключен.'}`}
        />
      )}

      <SectionTitle>Закрыты за сутки</SectionTitle>
      {truncated && (
        <p className="note" data-testid="incidents-truncated" role="status">
          Показаны последние {HISTORY_LIMIT} записей истории, и их пришло ровно столько: закрытых за
          сутки могло быть больше, чем в таблице.
        </p>
      )}
      {all === null && (
        <Alert boxed>
          История неисправностей не загрузилась. Это не означает, что закрытых записей нет.
        </Alert>
      )}
      <Table
        size="sm"
        className="dir-table dir-table--incidents-closed control-table"
        data-testid="incidents-closed"
      >
        <thead>
          <tr>
            {['Что случилось', 'Замечена', 'Закрыта', 'Кем'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {closed?.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-state" data-testid="incidents-closed-empty">
                За сутки ничего не закрывалось: ни сторож, ни человек не закрывали записей. Закрытые
                раньше — в истории API, здесь только последние 24 часа.
              </td>
            </tr>
          )}
          {closed?.map((i) => (
            <tr key={i.id}>
              <td>
                {i.title}
                {i.lastFixResult && <div className="cell-sub">{i.lastFixResult}</div>}
              </td>
              <td className="nowrap">{at(i.firstSeenAt)}</td>
              <td className="nowrap">{at(i.resolvedAt)}</td>
              <td>{i.resolvedBy ? RESOLVED_BY_RU[i.resolvedBy] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
