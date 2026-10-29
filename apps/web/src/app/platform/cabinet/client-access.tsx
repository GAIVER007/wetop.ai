'use client';
import { useActionState } from 'react';
import { Badge, Button, Notice, Alert } from '../../../components/ui';
import type { PlatformSiteBuilderLocation } from '../../../lib/api';
import { grantAccessAction, type SiteBuilderFormResult } from '../actions';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
import { extensionLastDay } from '../../../lib/ai-seller';
import { displayDay } from '../../../lib/display-date';

/**
 * Доступ клиента к модулям тарифа прямо в «Подписки клиентов» (владелец 29.10.2026, скрин: «давай сделаем тут выдачу
 * доступов к тарифу»). Сейчас модуль один: конструктор сайта, лицензия на каждый филиал. Одна строка на филиал:
 * статус словом и три кнопки: пробный на 14 дней, оплачен (бессрочно, срок продлевает оплата), выключить.
 * Пишет тот же API и та же серверная форма, что «Платформа → Организации» (журнал на сервере).
 */
const ACCESS: Record<PlatformSiteBuilderLocation['license']['access'], { tone: 'ok' | 'warn' | 'neutral'; label: string }> = {
  active: { tone: 'ok', label: msg('действует') },
  expired: { tone: 'warn', label: msg('срок вышел') },
  off: { tone: 'neutral', label: msg('не подключён') },
};
const TRIAL_DAYS = 14;
/** Последний день доступа по Алматы (срок платформы), как у ИИ-продавца: не сдвигается из-за пояса сервера */
const lastDay = (iso: string | null) => (iso ? displayDay(extensionLastDay(iso)) : null);

export function ClientAccess({ organizationId, location: l }: { organizationId: string; location: PlatformSiteBuilderLocation }) {
  const [state, action, pending] = useActionState<SiteBuilderFormResult | null, FormData>(
    grantAccessAction.bind(null, organizationId, l.id),
    null,
  );
  const t = useT();
  const access = ACCESS[l.license.access];
  const until = lastDay(l.license.activeUntil);
  const kind = l.license.status === 'TRIAL' ? t('пробный') : l.license.status === 'ACTIVE' ? t('оплачен') : null;
  return (
    <form action={action} className="cabinet-access" data-testid="subscription-access" aria-label={t('Доступ: {name}', { name: l.name })}>
      <div className="cabinet-access__what">
        <span className="cabinet-access__module">{t('Конструктор сайта')}</span>
        <span className="cabinet-access__place">{l.name}</span>
      </div>
      <div className="cabinet-access__state">
        <Badge tone={access.tone}>{t(access.label)}</Badge>
        {kind && (
          <span className="muted">
            {kind}
            {until ? t(', по {date}', { date: until }) : l.license.status === 'ACTIVE' ? t(', бессрочно') : ''}
          </span>
        )}
      </div>
      <input type="hidden" name="note" value={l.license.note ?? ''} />
      <div className="cabinet-access__actions">
        <Button type="submit" name="action" value="trial" size="sm" tone="secondary" disabled={pending} data-testid="access-trial">
          {t('Пробный {n} дней', { n: TRIAL_DAYS })}
        </Button>
        <Button type="submit" name="action" value="activate" size="sm" disabled={pending} data-testid="access-activate">
          {t('Оплачен')}
        </Button>
        {l.license.status && l.license.status !== 'OFF' && (
          <Button type="submit" name="action" value="off" size="sm" tone="ghost" disabled={pending} data-testid="access-off">
            {t('Выключить')}
          </Button>
        )}
      </div>
      {state?.error && <Alert className="cabinet-access__msg">{state.error}</Alert>}
      {state?.message && <Notice className="cabinet-access__msg">{state.message}</Notice>}
    </form>
  );
}
