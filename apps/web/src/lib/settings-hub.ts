import { featureVerticals } from './features';
import { allowedItem, pageOpen, routeRule, type NavigationAccess } from './navigation';
import type { IconName } from '../components/icon';
import type { WebVertical } from './vertical-landing';
import { verticalCopy, type MenuWords } from './vertical-copy';

/**
 * Хаб «Настройки» (поручение владельца 21.10.2026: «порядок, рабочим универсальным», образец «Настройки» из записи
 * клиентов): одна страница карточками-группами со ссылками, одна таблица для всех направлений. У пункта одна подпись
 * и свой экран у направления (`at`), как у верхнего меню. Нет экрана у направления или нет права, нет ссылки; карточка
 * без ссылок не показывается. Новых экранов хаб не заводит: редкие настройки остаются компактными на своих страницах.
 */
type Screens = Partial<Record<WebVertical, string>>;
const ALL = (href: string): Screens => ({ HOSPITALITY: href, BEAUTY: href, FOOD_SERVICE: href });

export interface SettingsLink {
  /** общая подпись или слово направления из `vertical-copy.ts` (аудит ресторана 22.10.2026 P2) */
  label: string | { word: keyof MenuWords };
  at: Screens;
}
export interface SettingsGroup {
  id: string;
  title: string;
  icon: IconName;
  links: SettingsLink[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    // кто мы, где и когда работаем, кто работает: правится один раз при запуске
    id: 'main',
    title: 'Основные',
    icon: 'settings',
    links: [
      { label: 'Карточка объекта', at: { HOSPITALITY: '/hotel-settings' } },
      { label: 'Филиалы и реквизиты', at: ALL('/branches') },
      { label: 'Режим работы', at: { HOSPITALITY: '/hotel-settings/stay', BEAUTY: '/beauty-settings#hours', FOOD_SERVICE: '/restaurant-settings?section=hours' } },
      { label: 'Сотрудники и доступ', at: ALL('/team') },
      { label: 'Права ролей', at: ALL('/team/roles') },
      { label: 'Мой профиль', at: ALL('/profile') },
    ],
  },
  {
    // из чего собирается журнал: места, люди, их график и что продаём
    id: 'journal',
    title: 'Журнал',
    icon: 'board',
    links: [
      { label: 'Номера', at: { HOSPITALITY: '/inventory' } },
      { label: { word: 'specialists' }, at: { BEAUTY: '/employees', FOOD_SERVICE: '/employees' } },
      { label: 'График работы', at: { BEAUTY: '/beauty/schedule', FOOD_SERVICE: '/employees/shifts' } },
      { label: 'Залы и столы', at: { FOOD_SERVICE: '/dining-areas' } },
      { label: 'Правила бронирования', at: { FOOD_SERVICE: '/restaurant-settings?section=bookings' } },
      { label: { word: 'catalogSettings' }, at: { HOSPITALITY: '/hotel-settings/services', BEAUTY: '/services', FOOD_SERVICE: '/menu' } },
    ],
  },
  {
    // как клиент приходит и возвращается
    id: 'clients',
    title: 'Клиенты и продажи',
    icon: 'guests',
    links: [
      { label: 'Напоминания клиентам', at: { BEAUTY: '/beauty-settings#reminders', FOOD_SERVICE: '/restaurant-settings?section=reminders' } },
      { label: 'Бонусы', at: { BEAUTY: '/beauty-settings#bonuses' } },
      { label: 'Сертификаты', at: { BEAUTY: '/finance/certificates' } },
      { label: 'Каналы продаж', at: { HOSPITALITY: '/channels' } },
      { label: { word: 'siteSettings' }, at: { HOSPITALITY: '/website', BEAUTY: '/marketing/site/editor', FOOD_SERVICE: '/marketing/site/editor' } },
      { label: 'ИИ-продавец', at: ALL('/ai-agents') },
    ],
  },
  {
    // деньги, документы, внешние сервисы и след изменений
    id: 'system',
    title: 'Система',
    icon: 'system',
    links: [
      { label: 'Способы оплаты и статьи кассы', at: { HOSPITALITY: '/hotel-settings/directories' } },
      { label: 'Документы и договор', at: { HOSPITALITY: '/hotel-settings/documents' } },
      { label: 'Подключения', at: { HOSPITALITY: '/connections' } },
      { label: 'Неисправности', at: { HOSPITALITY: '/incidents' } },
      { label: 'История действий', at: ALL('/journal') },
      { label: 'Организации', at: ALL('/platform') },
    ],
  },
];

/** Открыта ли страница ссылки этому вошедшему в этом направлении: та же охрана, что у меню и страниц */
export function settingsLinkOpen(access: NavigationAccess, vertical: WebVertical, href: string): boolean {
  const path = href.split(/[?#]/)[0]!;
  if (!featureVerticals(path).includes(vertical)) return false;
  const rule = routeRule(path);
  if (!rule?.requires) return true;
  if (rule.requires === 'platform') return access.platform;
  if (vertical === 'BEAUTY' && access.beautyAccess) return pageOpen(access, rule.requires, path);
  return allowedItem(rule, access);
}

/** Карточки хаба вошедшего: свои экраны направления, только открытые ему, пустых карточек нет */
export function settingsGroupsFor(
  access: NavigationAccess,
  vertical: WebVertical,
): Array<Omit<SettingsGroup, 'links'> & { links: Array<{ label: string; href: string }> }> {
  return SETTINGS_GROUPS.map(({ links, ...group }) => ({
    ...group,
    links: links.flatMap(({ label, at }) => {
      const href = at[vertical];
      if (!href || !settingsLinkOpen(access, vertical, href)) return [];
      return [{ label: typeof label === 'string' ? label : verticalCopy(vertical).menu[label.word], href }];
    }),
  })).filter((group) => group.links.length > 0);
}
