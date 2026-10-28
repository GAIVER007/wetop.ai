import { msg } from '../i18n';

/** Пункт нижнего меню кабинета мастера: ведёт на вкладку кабинета по `#id` (вкладки читают адрес) */
export interface MasterNavItem { id: string; label: string; icon: string; href: string }

/**
 * Нижнее меню кабинета мастера на телефоне (владелец 28.10.2026): Сегодня, Записи, График, Деньги, Я.
 * Пункт показывается, только если у мастера есть доступ к разделу (те же флаги, что у вкладок).
 * «Сегодня» ведёт на первую вкладку: записи дня и цифры месяца; «Я» на вкладку профиля.
 */
export function masterNavItems(f: { showWork: boolean; showSchedule: boolean; showPay: boolean }): MasterNavItem[] {
  return [
    { id: 'today', label: msg('Сегодня'), icon: '⌂', href: '#today' },
    ...(f.showWork ? [{ id: 'work', label: msg('Записи'), icon: '▦', href: '#work' }] : []),
    ...(f.showSchedule ? [{ id: 'week', label: msg('График'), icon: '◷', href: '#week' }] : []),
    ...(f.showPay ? [{ id: 'pay', label: msg('Деньги'), icon: '¤', href: '#pay' }] : []),
    { id: 'professional', label: msg('Я'), icon: '☺', href: '#professional' },
  ];
}
