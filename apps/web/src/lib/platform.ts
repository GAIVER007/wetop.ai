import type { BadgeTone } from '../components/ui';
import type { ExtensionAccessView, PlatformOrganization } from './api';
import { extensionLastDay } from './ai-seller';
import { PLATFORM_TIMEZONE } from '@pms/domain';
import { propertyClock } from './property-time';
import { displayDay } from './display-date';

/**
 * «Платформа → Организации» (DATA_MODEL §16, ADR-083): слова для таблицы главного администратора. Без зависимостей от
 * сервера — ими пользуются и страница, и форма.
 */

/**
 * Состояние организации словами. Пробного периода в разделе нет: API отдаёт «работает» или «только чтение»
 * (`visibleStatus` в домене), здесь только слова и тон.
 */
export function organizationStatusLine(o: Pick<PlatformOrganization, 'status'>): {
  label: string;
  tone: BadgeTone;
} {
  if (o.status === 'ACTIVE') return { label: 'работает', tone: 'ok' };
  if (o.status === 'READ_ONLY') return { label: 'только чтение', tone: 'warn' };
  if (o.status === 'SUSPENDED') return { label: 'приостановлена', tone: 'danger' };
  return { label: String(o.status), tone: 'neutral' };
}

/** Расширение «ИИ-продавец» словами: действует ли, до какого дня и какой статус стоит (Q-183) */
export function extensionLine(e: ExtensionAccessView): {
  label: string;
  detail: string;
  tone: BadgeTone;
} {
  const until = e.activeUntil ? `по ${displayDay(extensionLastDay(e.activeUntil))}` : 'бессрочно';
  const kind = e.status === 'TRIAL' ? 'пробный' : 'оплачен';
  if (e.access === 'active') return { label: 'действует', detail: `${kind}, ${until}`, tone: 'ok' };
  if (e.access === 'expired')
    return { label: 'срок вышел', detail: `${kind}, ${until}`, tone: 'warn' };
  return {
    label: 'не подключён',
    detail: e.status === 'OFF' ? 'выключен' : 'не подключали',
    tone: 'neutral',
  };
}

/** Что подставить в форму изменения: текущий статус, последний день и заметка; не подключали — «оплачен», пусто */
export function extensionFormDefaults(e: PlatformOrganization['aiSeller']): {
  status: 'TRIAL' | 'ACTIVE' | 'OFF';
  activeUntil: string;
  note: string;
} {
  return {
    status: e.status ?? 'ACTIVE',
    activeUntil: e.activeUntil ? extensionLastDay(e.activeUntil) : '',
    note: e.note ?? '',
  };
}

/** Дата регистрации организации — по поясу платформы (Алматы): это раздел оператора, а не одной гостиницы */
export function organizationSince(createdAt: string): string {
  return displayDay(propertyClock(PLATFORM_TIMEZONE).date(createdAt));
}
