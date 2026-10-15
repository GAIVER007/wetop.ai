import Link from 'next/link';
import { Badge } from '../../components/ui';
import { HEALTH_LABEL, HEALTH_TONE, type ChannexCard } from '../../lib/integrations';
import type { PropertyClock } from '../../lib/property-time';

/** Общие куски карточки «Интеграций» и страницы Channex (INT1 — ADR-116, INT2 — ADR-121) */

export const CHANNEX_ABOUT =
  'Цены, остатки, ограничения и брони из Booking.com, Trip.com и других каналов.';
export const CHANNEX_CONTENT_NOTE =
  'Фото, удобства и описание для каналов настраиваются в кабинете менеджера каналов или самого канала.';
/** Ключ Channex — на сервере установки (ADR-004, ADR-095): подключает и меняет поддержка WETOP, поля в интерфейсе нет */
export const CHANNEX_SUPPORT =
  'Подключает поддержка WETOP: ключ хранится на сервере и в интерфейс не вводится. Напишите в чат помощника справа внизу.';
export const CHANNEX_READ_ONLY =
  'Подключение — после оплаты подписки. Данные доступны для просмотра.';

export function HealthBadge({ health }: { health: ChannexCard['health'] }) {
  return (
    <Badge tone={HEALTH_TONE[health]} data-testid="integration-health">
      {HEALTH_LABEL[health]}
    </Badge>
  );
}

/** Причины «требует внимания» или «неизвестно» — словами и со ссылкой прямо к месту исправления */
export function IssueList({ issues }: { issues: ChannexCard['issues'] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="integration-card__issues" data-testid="integration-issues">
      {issues.map((issue) => (
        <li key={issue.text}>
          <span>{issue.text}</span>
          {issue.href && issue.action && <Link href={issue.href}>{issue.action}</Link>}
        </li>
      ))}
    </ul>
  );
}

export const environmentWord = (environment: string | undefined) =>
  environment === 'production'
    ? 'Рабочая'
    : environment === 'staging'
      ? 'Тестовая'
      : environment
        ? 'Свой сервер'
        : '—';

/** Свёрнутые технические детали: владельцу и главному администратору, не основной текст экрана (§23 ТЗ) */
export function TechDetails({ card, clock }: { card: ChannexCard; clock: PropertyClock }) {
  const c = card.connection;
  const w = card.webhook;
  return (
    <details className="integration-card__tech" data-testid="integration-tech">
      <summary>Технические детали</summary>
      <dl className="integration-card__facts">
        <div>
          <dt>Среда</dt>
          <dd>{environmentWord(c?.environment)}</dd>
        </div>
        <div>
          <dt>Объект в менеджере каналов</dt>
          <dd className="integration-card__code">{c?.propertyId ?? '—'}</dd>
        </div>
        <div>
          <dt>Webhook</dt>
          <dd>{!w ? '—' : w.registered && w.active ? 'включён' : 'не включён'}</dd>
        </div>
        <div>
          <dt>Проба адреса webhook</dt>
          <dd>{clock.full(w?.callbackCheckedAt)}</dd>
        </div>
        <div>
          <dt>Последний webhook</dt>
          <dd>{clock.full(c?.lastWebhookAt)}</dd>
        </div>
        <div>
          <dt>Последний импорт</dt>
          <dd>{clock.full(c?.lastPullAt)}</dd>
        </div>
        <div>
          <dt>Последняя отправка в каналы</dt>
          <dd>{clock.full(card.outbox?.lastSentAt)}</dd>
        </div>
        <div>
          <dt>Проверено</dt>
          <dd>{clock.full(c?.checkedAt)}</dd>
        </div>
      </dl>
    </details>
  );
}

export function EnvironmentNote({ environment }: { environment: string | undefined }) {
  return (
    <p className="integration-environment" data-testid="integration-environment">
      {environment === 'staging'
        ? 'Тестовый контур: рабочий обмен с каналами ещё не запущен.'
        : environment === 'production'
          ? 'Рабочий контур: состояние обмена показано ниже.'
          : 'Контур подключения не определён — проверьте настройки.'}
    </p>
  );
}
