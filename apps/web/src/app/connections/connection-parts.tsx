import Link from 'next/link';
import { Badge } from '../../components/ui';
import { HEALTH_LABEL, HEALTH_TONE, type ChannexCard } from '../../lib/integrations';
import type { PropertyClock } from '../../lib/property-time';
import { msg, type Translate } from '../../i18n';

/** Общие куски карточки «Интеграций» и страницы Channex (INT1 — ADR-116, INT2 — ADR-121) */

export const CHANNEX_ABOUT = msg(
  'Цены, остатки, ограничения и брони из Booking.com, Trip.com и других каналов.',
);
export const CHANNEX_CONTENT_NOTE = msg(
  'Фото, удобства и описание для каналов настраиваются в кабинете менеджера каналов или самого канала.',
);
/** Ключ Channex — на сервере установки (ADR-004, ADR-095): подключает и меняет поддержка WETOP, поля в интерфейсе нет */
export const CHANNEX_SUPPORT = msg(
  'Подключает поддержка WETOP: ключ хранится на сервере и в интерфейс не вводится. Напишите в чат помощника справа внизу.',
);
export const CHANNEX_READ_ONLY = msg(
  'Подключение — после оплаты подписки. Данные доступны для просмотра.', // текст сверяет tests/ui/integrations.spec.ts, тире оставлено
);

export function HealthBadge({ health, t }: { health: ChannexCard['health']; t: Translate }) {
  return (
    <Badge tone={HEALTH_TONE[health]} data-testid="integration-health">
      {/* HEALTH_LABEL из lib/integrations: постоянные русские подписи, переводятся при показе */}
      {t(HEALTH_LABEL[health])}
    </Badge>
  );
}

/** Причины «требует внимания» или «неизвестно» — словами и со ссылкой прямо к месту исправления */
export function IssueList({ issues, t }: { issues: ChannexCard['issues']; t: Translate }) {
  if (issues.length === 0) return null;
  return (
    <ul className="integration-card__issues" data-testid="integration-issues">
      {issues.map((issue) => (
        <li key={issue.text}>
          {/* тексты причин из lib/integrations; с числом внутри собраны шаблоном и остаются русскими */}
          <span>{t(issue.text)}</span>
          {issue.href && issue.action && <Link href={issue.href}>{t(issue.action)}</Link>}
        </li>
      ))}
    </ul>
  );
}

export const environmentWord = (environment: string | undefined, t: Translate) =>
  environment === 'production'
    ? t('Рабочая')
    : environment === 'staging'
      ? t('Тестовая')
      : environment
        ? t('Свой сервер')
        : '—';

/** Свёрнутые технические детали: владельцу и главному администратору, не основной текст экрана (§23 ТЗ) */
export function TechDetails({
  card,
  clock,
  t,
}: {
  card: ChannexCard;
  clock: PropertyClock;
  t: Translate;
}) {
  const c = card.connection;
  const w = card.webhook;
  return (
    <details className="integration-card__tech" data-testid="integration-tech">
      <summary>{t('Технические детали')}</summary>
      <dl className="integration-card__facts">
        <div>
          <dt>{t('Контур')}</dt>
          <dd>{environmentWord(c?.environment, t)}</dd>
        </div>
        <div>
          <dt>{t('Объект в менеджере каналов')}</dt>
          <dd className="integration-card__code">{c?.propertyId ?? '—'}</dd>
        </div>
        <div>
          <dt>Webhook</dt>
          <dd>{!w ? '—' : w.registered && w.active ? t('включён') : t('не включён')}</dd>
        </div>
        <div>
          <dt>{t('Проба адреса webhook')}</dt>
          <dd>{clock.full(w?.callbackCheckedAt)}</dd>
        </div>
        <div>
          <dt>{t('Последний webhook')}</dt>
          <dd>{clock.full(c?.lastWebhookAt)}</dd>
        </div>
        <div>
          <dt>{t('Последний импорт')}</dt>
          <dd>{clock.full(c?.lastPullAt)}</dd>
        </div>
        <div>
          <dt>{t('Последняя отправка в каналы')}</dt>
          <dd>{clock.full(card.outbox?.lastSentAt)}</dd>
        </div>
        <div>
          <dt>{t('Проверено@@подключение')}</dt>
          <dd>{clock.full(c?.checkedAt)}</dd>
        </div>
      </dl>
    </details>
  );
}

export function EnvironmentNote({
  environment,
  t,
}: {
  environment: string | undefined;
  t: Translate;
}) {
  return (
    <p className="integration-environment" data-testid="integration-environment">
      {environment === 'staging'
        ? t('Тестовый контур: рабочий обмен с каналами ещё не запущен.')
        : environment === 'production'
          ? t('Рабочий контур: состояние обмена показано ниже.')
          : t('Контур подключения не определён, проверьте настройки.')}
    </p>
  );
}
