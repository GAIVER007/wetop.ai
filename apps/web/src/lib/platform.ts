import type { BadgeTone } from '../components/ui';
import type { ExtensionAccessView, PlatformOrganization, PlatformVertical } from './api';
import { extensionLastDay } from './ai-seller';
import { PLATFORM_TIMEZONE } from '@pms/domain';
import { propertyClock } from './property-time';
import { displayDay } from './display-date';

/**
 * «Платформа → Организации» (DATA_MODEL §16, ADR-083): слова для таблицы главного администратора. Без зависимостей от
 * сервера — ими пользуются и страница, и форма.
 */

/** Состояние организации словами (срез 13, ADR-046): пробный — с последним днём по Алматы */
export function organizationStatusLine(o: Pick<PlatformOrganization, 'status' | 'trialEndsAt'>): {
  label: string;
  tone: BadgeTone;
} {
  if (o.status === 'TRIAL')
    return {
      label: o.trialEndsAt
        ? `пробный по ${displayDay(extensionLastDay(o.trialEndsAt))}`
        : 'пробный',
      tone: 'info',
    };
  if (o.status === 'ACTIVE') return { label: 'работает', tone: 'ok' };
  if (o.status === 'READ_ONLY') return { label: 'только чтение', tone: 'warn' };
  // `SUSPENDED` ставит только архив организации (ORG1, ADR-ORG1): люди не входят, данные целы
  if (o.status === 'SUSPENDED') return { label: 'в архиве', tone: 'danger' };
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

/** Направление бизнеса словом — как в карточках филиалов своей организации */
export const PLATFORM_VERTICAL_LABEL: Record<PlatformVertical, string> = {
  HOSPITALITY: 'Гостиница',
  BEAUTY: 'Салон',
  FOOD_SERVICE: 'Ресторан',
};

/** Статус организации без даты пробного — для списков отбора, где дата конкретной организации неуместна */
export const PLATFORM_STATUS_LABEL: Record<string, string> = {
  TRIAL: 'пробный',
  ACTIVE: 'работает',
  READ_ONLY: 'только чтение',
  SUSPENDED: 'в архиве',
};
