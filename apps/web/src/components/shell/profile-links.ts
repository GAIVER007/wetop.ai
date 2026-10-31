import { msg } from '../../i18n';
import { allowedItem, mayAccess, routeRule, type NavigationAccess } from '../../lib/navigation';
import type { IconName } from '../icon';

type Vertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
export interface ProfileLink {
  label: string;
  href: string;
  icon: IconName;
}

const SCHEDULE: Record<Vertical, string> = {
  HOSPITALITY: '/staff-schedule',
  BEAUTY: '/beauty/schedule',
  FOOD_SERVICE: '/employees/shifts',
};

/**
 * Рабочая часть меню профиля по ролям (владелец 31.10.2026, эскиз «да»): владелец видит бизнесы, людей и настройки,
 * управляющий, админ и кассир свою смену, кассу, график и филиал, сотрудник только своё. «Организаций» нет:
 * у владельца «Все бизнесы и филиалы». Пункт выводится, только если его экран человеку открыт.
 */
export function profileLinks(access: NavigationAccess, vertical: Vertical | undefined): ProfileLink[] {
  const open = (href: string) => allowedItem(routeRule(href) ?? {}, access);
  const out: ProfileLink[] = [{ label: msg('Профиль'), href: '/profile', icon: 'person' }];
  if (access.role === 'OWNER') {
    out.push(
      { label: msg('Все бизнесы и филиалы'), href: '/owner', icon: 'hotel' },
      { label: msg('Сотрудники и доступ'), href: '/team', icon: 'person' },
      { label: msg('Все настройки'), href: '/settings', icon: 'settings' },
      { label: msg('История действий'), href: '/journal', icon: 'file' },
    );
    return out;
  }
  if (access.role === 'EMPLOYEE') {
    if (vertical) out.push({ label: msg('Моя работа: записи, график, зарплата'), href: '/my-work', icon: 'person' });
    return out;
  }
  if (vertical) out.push({ label: msg('Моя работа'), href: '/my-work', icon: 'person' });
  if (mayAccess(access, 'desk')) {
    out.push({ label: msg('Смена и касса'), href: '/cashbox', icon: 'money' });
    if (vertical) out.push({ label: msg('График работы'), href: SCHEDULE[vertical], icon: 'clock' });
  }
  if (access.role === 'MANAGER' && open('/branches')) out.push({ label: msg('Мой филиал'), href: '/branches', icon: 'hotel' });
  return out;
}
