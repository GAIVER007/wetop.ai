import { requireFeature } from '../../lib/vertical-guard';
import { guardApi } from '../../lib/api';
import { countLabel, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { Page } from '../../components/page';
import { Alert, Panel, SectionTitle, StateBar, StateFact } from '../../components/ui';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { GuardTickButton } from './buttons';
import { IncidentList, type IncidentRow } from './incident-list';
import { Suspense } from 'react';
import { RefreshButton } from '../../components/refresh-button';
import { ControlNavigation } from '../../components/control-navigation';
import { hotelClock } from '../../lib/hotel-api';
import type { PropertyClock } from '../../lib/property-time';
import { unstable_rethrow } from 'next/navigation';
import './incidents.css';

/**
 * Неисправности системы — одно место (срез 11, ADR-028). Сторож проверяет систему раз в минуту и пишет сюда
 * всё, что сломалось. Технику он чинит сам; брони, места и деньги — только человек; ошибки кода — дежурный агент.
 */
const RESOLVED_BY_RU = { GUARD: msg('сторож'), AGENT: msg('дежурный агент'), STAFF: msg('вручную') } as const;

/** Время по часам объекта: страница рендерится на сервере, у которого может быть другой пояс */
const atText = (iso: string, clock: PropertyClock) =>
  new Date(iso).toLocaleString('ru-RU', {
    timeZone: clock.timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
/** Время словами внутри `<time>`: сырое значение остаётся тестам и копированию (§14) */
const at = (iso: string | null, clock: PropertyClock) =>
  iso ? <time dateTime={iso}>{clock.when(iso)}</time> : '—';

/** Сколько записей истории читаем: если пришло ровно столько, список обрезан — и это написано на экране */
const HISTORY_LIMIT = 200;

/**
 * 21.09.2026 (поручение владельца по снимку рабочего экрана — «чтобы каши не было»): три плитки с числами
 * и панель сторожа на четыре колонки сведены в одну полосу состояния, отбор переехал в чипы-счётчики
 * рядом со списком, закрытые за сутки убраны под раскрывашку. Сам сторож, его проверки и действия по
 * неисправностям не менялись; D4 (LoadError с повтором, объяснённые пустые состояния, время в `<time>`,
 * телефон без прокрутки вбок) остаётся в силе.
 */
export default async function IncidentsPage() {
  // гостиничный экран: салон и ресторан по прямому адресу уходят на свою стартовую (DS2 F1, как `/reports`)
  await requireFeature('/incidents');
  const t = await serverT();
  return (
    <Page
      title={t('Неисправности')}
      subtitle={t('Состояние системы и задачи для команды.')}
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
            {t('Читаем состояние сторожа…')}
          </Panel>
        }
      >
        <IncidentContent />
      </Suspense>
    </Page>
  );
}

async function IncidentContent() {
  const clock = await hotelClock();
  const locale = await currentLocale();
  const t = await serverT();
  const checks = (n: number) => countLabel(locale, t, n, [msg('проверка'), 'проверки', msg('проверок')]); // kk-allow: форма склонения
  const [loadedStatus, open, all] = await Promise.all([
    guardApi.status().then(
      (r) => ({ ok: true as const, r }),
      (e: unknown) => {
        unstable_rethrow(e);
        return { ok: false as const, e };
      },
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
  // Что показывает полоса: числа сторожа (они могут быть больше загруженного списка) и одна фраза о том,
  // требует ли что-то человека прямо сейчас. Тон — по тому же правилу, что цвет числа раньше: §9.
  const summary = status
    ? status.open.total === 0
      ? t('Сторож ничего не нашёл.')
      : [
          status.open.critical > 0 ? t('срочных {n}', { n: status.open.critical }) : '',
          status.open.escalated > 0 ? t('ждут человека {n}', { n: status.open.escalated }) : '',
        ]
          .filter(Boolean)
          .join(', ') || t('сторож разбирается сам')
    : t('Состояние сторожа не прочиталось.');
  const tone =
    status && status.open.escalated + status.open.critical > 0
      ? 'alarm'
      : status && status.open.total > 0
        ? 'warn'
        : 'calm';
  return (
    <div className="control-page">
      {!loadedStatus.ok && (
        <LoadError testId="incidents-status-error" {...loadErrorProps(loadedStatus.e)} />
      )}
      {status && !status.notifier.configured && (
        <Alert boxed tone="warning" data-testid="notifier-missing">
          {t('Уведомления не настроены. Неисправности доступны только здесь.')}
        </Alert>
      )}
      <StateBar
        tone={tone}
        label={t('Открыто')}
        value={<span data-testid="incidents-open">{String(status?.open.total ?? '—')}</span>}
        summary={<span data-testid="incidents-summary">{summary}</span>}
      >
        <StateFact
          label={t('Сторож')}
          value={
            <span data-testid="guard-running">
              {status
                ? `${status.running ? t('работает, проход раз в минуту') : t('выключен')}, ${status.autofix ? t('технику чинит сам') : t('технику сам не чинит')}`
                : '—'}
            </span>
          }
        />
        <StateFact
          label={t('Последний проход')}
          value={
            <>
              {tick ? at(tick.at, clock) : status ? t('ещё не было') : '—'}
              {tick && (
                <span className="state-bar__sub">
                  {checks(tick.checked.length)}
                  {tick.checkErrors.length > 0 && (
                    <span className="danger-text">
                      , {t('не отработали: {checks}', { checks: tick.checkErrors.map((e) => e.check).join(', ') })}
                    </span>
                  )}
                </span>
              )}
            </>
          }
        />
        <StateFact
          label={t('Будильник')}
          value={
            <>
              {status
                ? status.notifier.configured
                  ? `Telegram, ${countLabel(locale, t, status.notifier.recipients, [msg('чат'), 'чата', msg('чатов')])}` // kk-allow: форма склонения
                  : t('не настроен')
                : '—'}
              {tick?.alertError && status?.notifier.configured && (
                <span className="state-bar__sub danger-text">{tick.alertError}</span>
              )}
            </>
          }
        />
      </StateBar>

      <SectionTitle>{t('Открытые')}</SectionTitle>
      {open === null && (
        <Alert boxed>
          {t('Список неисправностей не загрузился. Обновите страницу — текущее состояние неизвестно.')}
        </Alert>
      )}
      {open !== null && (
        <>
          {status !== null && status.open.total > open.length && (
            <p className="note">
              {t('Загружены последние {n} из {total} открытых неисправностей.', { n: open.length, total: status.open.total })}
            </p>
          )}
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
              }): IncidentRow => ({
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
            emptyTitle={t('Открытых неисправностей нет')}
            emptyHint={`${tick ? `${t('Последний проход в {at}: {checks}.', { at: atText(tick.at, clock), checks: checks(tick.checked.length) })} ` : ''}${status?.running ? t('Сторож проверяет систему раз в минуту; новые записи появятся здесь.') : t('Автоматический мониторинг сейчас выключен.')}`}
          />
        </>
      )}

      {all === null && (
        <Alert boxed>
          {t('История неисправностей не загрузилась. Это не означает, что закрытых записей нет.')}
        </Alert>
      )}
      {/*
       * Закрытые за сутки — справка, а не работа: на экране владельца они занимали столько же места,
       * сколько открытые. Список под раскрывашкой, а его длина названа прямо в подписи.
       */}
      <details className="incident-history" data-testid="incidents-closed">
        <summary>
          {t('Закрыты за сутки: {n}', { n: closed?.length ?? '—' })}
          {truncated && ` ${t('(показаны не все)')}`}
        </summary>
        {truncated && (
          <p className="note" data-testid="incidents-truncated" role="status">
            {t('Показаны последние {n} записей истории, и их пришло ровно столько: закрытых за сутки могло быть больше, чем в списке.', { n: HISTORY_LIMIT })}
          </p>
        )}
        {closed?.length === 0 && (
          <p className="incident-history__empty" data-testid="incidents-closed-empty">
            {t('За сутки ничего не закрывалось: ни сторож, ни человек не закрывали записей. Закрытые раньше — в истории API, здесь только последние 24 часа.')}
          </p>
        )}
        {closed && closed.length > 0 && (
          <ul className="incident-history__list">
            {closed.map((i) => (
              <li key={i.id} data-testid="incidents-closed-row">
                <span className="incident-history__title">{i.title}</span>
                <span className="incident-history__meta">
                  {t('Замечена')} {at(i.firstSeenAt, clock)}, {t('закрыта')} {at(i.resolvedAt, clock)},{' '}
                  {i.resolvedBy ? t(RESOLVED_BY_RU[i.resolvedBy]) : t('кем — неизвестно')}.
                  {i.lastFixResult ? ` ${i.lastFixResult}.` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
