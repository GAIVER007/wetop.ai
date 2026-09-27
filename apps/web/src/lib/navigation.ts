import {
  can,
  parseMembershipRole,
  rolesWith,
  type MembershipRole,
  type Permission,
} from '@pms/domain';
import type { IconName } from '../components/icon';

/**
 * Что открыто вошедшему (ADR-083, ADR-098): «Платформа» — главному администратору; остальное — по роли в организации
 * (права — DATA_MODEL §16.5, таблица в домене). Расширение «ИИ-продавец» пункт меню не прячет (ADR-090).
 */
export interface NavigationAccess {
  aiSeller: boolean;
  platform: boolean;
  /**
   * Роль вошедшего. `null` — API ответил, что никто не вошёл: так бывает, только пока замок выключен (разработка, проверки
   * стенда), и тогда разделы по ролям не прячутся — как и API без человека за запросом ролей не проверяет. Сбой
   * `/auth/me` — не `null`, а `PENDING_ACCESS` (`desk-shell.ts`).
   */
  role: MembershipRole | null;
}

/** Никто не вошёл (или API не ответил): «Платформы» нет, разделы по ролям не прячутся */
export const CLOSED_ACCESS: NavigationAccess = { aiSeller: false, platform: false, role: null };

/** Пока `/auth/me` не ответил, меню — как у администратора: пункты появляются, а не исчезают у него на глазах */
export const PENDING_ACCESS: NavigationAccess = { aiSeller: false, platform: false, role: 'STAFF' };

/** Право, которым открыт пункт: право роли (§16.5) или «Платформа» — отметка главного администратора */
export type NavigationRequirement = Permission | 'platform';

export interface NavigationItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: IconName;
  description: string;
  pending?: boolean;
  children?: NavigationItem[];
  /** Кому открыт пункт и страница по его адресу (ADR-098); у пункта меню поле обязательно — тест */
  requires?: NavigationRequirement;
}
export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Рабочее место',
    items: [
      {
        href: '/today',
        requires: 'desk',
        label: 'Главная',
        icon: 'today',
        description: 'Загрузка, деньги за период и задачи дня.',
      },
      {
        href: '/chessboard',
        requires: 'desk',
        label: 'Шахматка',
        icon: 'board',
        description: 'Размещение по номерам, койкам и датам.',
      },
      {
        href: '/reservations',
        requires: 'desk',
        label: 'Брони',
        icon: 'booking',
        description: 'Брони и проживания за выбранный день.',
      },
      {
        href: '/guests',
        requires: 'desk',
        label: 'Гости',
        icon: 'guests',
        description: 'Карточки гостей и история проживания.',
      },
    ],
  },
  {
    label: 'Управление',
    items: [
      {
        href: '/rooms',
        requires: 'property',
        label: 'Управление номерами',
        shortLabel: 'Номера',
        icon: 'bed',
        description: 'Номерной фонд, свободные места и условия продажи.',
        children: [
          {
            href: '/inventory',
            requires: 'property',
            label: 'Номерной фонд',
            icon: 'inventory',
            description: 'Все номера и койки, состав и карточки размещения.',
          },
          {
            href: '/rooms/categories',
            requires: 'property',
            label: 'Категории номеров',
            icon: 'bed',
            description: 'Типы размещения, количество единиц и вместимость.',
          },
          {
            href: '/rooms/availability',
            requires: 'property',
            label: 'Доступность номеров',
            icon: 'board',
            description: 'Свободные номера и койки на весь срок проживания.',
          },
          {
            href: '/rates',
            requires: 'rates',
            label: 'Тарифы',
            icon: 'rates',
            description: 'Календарь цен, ограничения и массовое редактирование.',
          },
        ],
      },
      {
        href: '/management/statistics',
        requires: 'reports',
        label: 'Статистика',
        icon: 'analytics',
        description: 'Занятые, свободные и заблокированные места по категориям.',
      },
      {
        href: '/finance',
        requires: 'reports',
        label: 'Оплаты',
        icon: 'money',
        description: 'Начисления, оплаты, возвраты и остатки за период.',
      },
    ],
  },
  {
    label: 'Продажи',
    items: [
      {
        href: '/channel-manager',
        requires: 'channels',
        label: 'Менеджер каналов',
        icon: 'channels',
        description: 'Брони и стоимость по Booking.com, Trip.com и другим источникам.',
        children: [
          {
            href: '/channels',
            requires: 'channels',
            label: 'Синхронизация',
            icon: 'channels',
            description: 'Сопоставления, события и очередь Channex.',
          },
        ],
      },
      {
        href: '/ai-seller',
        requires: 'dialogs',
        label: 'ИИ-продавец',
        icon: 'chat',
        description: 'Бот на сайте объекта: настройки, знания, диалоги с гостями и код чата.',
        // Раздел доступен для знакомства; действия и данные защищены сервером.
      },
      {
        href: '/analytics',
        requires: 'settings',
        label: 'Аналитика',
        icon: 'analytics',
        description: 'Посещаемость сайта, источники трафика и бронирования.',
      },
    ],
  },
  {
    label: 'Система',
    items: [
      {
        href: '/hotel-settings',
        requires: 'settings',
        label: 'Настройки гостиницы',
        shortLabel: 'Гостиница',
        icon: 'settings',
        description: 'Правила проживания, услуги и информация об объекте.',
        children: [
          {
            href: '/hotel-settings/penalties',
            requires: 'settings',
            label: 'Правила отмены',
            icon: 'journal',
            description: 'Политика отмены для каждого тарифного плана.',
          },
          {
            href: '/hotel-settings/services',
            requires: 'settings',
            label: 'Услуги',
            icon: 'plus',
            description: 'Каталог дополнительных услуг и цены.',
          },
        ],
      },
      {
        href: '/connections',
        requires: 'settings',
        label: 'Интеграции',
        icon: 'channels',
        description: 'Подключение каналов, счётчика и модуля бронирования.',
      },
      {
        href: '/analytics/setup',
        requires: 'settings',
        label: 'Настройки сайта',
        icon: 'settings',
        description: 'Подключение сайта и настройка виджета.',
      },
      {
        href: '/incidents',
        requires: 'desk',
        label: 'Неисправности',
        icon: 'incidents',
        description: 'Ошибки и состояние фоновых процессов.',
      },
      {
        href: '/journal',
        requires: 'journal',
        label: 'Журнал',
        icon: 'journal',
        description: 'История операций в системе.',
      },
      {
        href: '/platform',
        label: 'Организации',
        icon: 'inventory',
        description: 'Гостиницы платформы и их расширения — только для главного администратора.',
        requires: 'platform',
      },
      {
        href: '/platform/support',
        label: 'Техподдержка',
        icon: 'chat',
        description: 'Диалоги ИИ-помощника с пользователями платформы, его знания и сводка.',
        requires: 'platform',
      },
    ],
  },
];
export const navigationItems = navigation.flatMap((group) =>
  group.items.flatMap((item) => [item, ...(item.children ?? [])]),
);

export interface SidebarSection {
  id: string;
  label: string;
  icon: IconName;
  items: NavigationItem[];
}

// Метаданные и дочерние ссылки нужны страницам-обзорам. Меню группирует тот же
// реестр по задачам сотрудника, не меняя заголовки страниц и их маршруты.
function menuItem(href: string, label?: string): NavigationItem {
  const item = navigationItems.find((entry) => entry.href === href);
  if (!item) throw new Error(`Unknown navigation route: ${href}`);
  return label ? { ...item, label } : item;
}

export const sidebarSections: SidebarSection[] = [
  {
    id: 'guests',
    label: 'Работа с гостями',
    icon: 'guests',
    items: ['/today', '/chessboard', '/reservations', '/guests'].map((href) => menuItem(href)),
  },
  {
    id: 'inventory',
    label: 'Номерной фонд',
    icon: 'bed',
    items: [
      menuItem('/inventory', 'Номера и койки'),
      menuItem('/rooms/categories', 'Категории номеров'),
      menuItem('/rooms/availability', 'Доступность'),
    ],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates',
    items: [
      menuItem('/rates'),
      menuItem('/channel-manager'),
      menuItem('/channels', 'Синхронизация каналов'),
      // рядом с каналами (ТЗ ред. 1 §4.1): бот-продавец на сайте объекта
      menuItem('/ai-seller'),
      menuItem('/analytics', 'Аналитика сайта'),
    ],
  },
  {
    id: 'finance',
    label: 'Финансы и отчёты',
    icon: 'money',
    items: [menuItem('/finance'), menuItem('/management/statistics')],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      menuItem('/hotel-settings', 'Гостиница'),
      menuItem('/connections'),
      menuItem('/analytics/setup', 'Сайт'),
    ],
  },
  {
    id: 'control',
    label: 'Контроль',
    icon: 'shield',
    items: [menuItem('/incidents'), menuItem('/journal')],
  },
  {
    // только главному администратору (ADR-083): данных чужих гостиниц здесь нет — названия, люди и расширения
    id: 'platform',
    label: 'Платформа',
    icon: 'system',
    items: [menuItem('/platform'), menuItem('/platform/support')],
  },
];

/** Есть ли у вошедшего право. Никто не вошёл — открыто: так же поступает API (ADR-098) */
export function mayAccess(access: NavigationAccess, permission: Permission): boolean {
  return access.role === null || can(access.role, permission);
}

/** Открыт ли пункт этому вошедшему */
export function allowedItem(
  item: { requires?: NavigationRequirement | undefined },
  access: NavigationAccess,
): boolean {
  if (!item.requires) return true;
  if (item.requires === 'platform') return access.platform;
  return mayAccess(access, item.requires);
}

/** Право, открытое всем ролям, страницу не закрывает: проверять его незачем */
export function openToEveryRole(requires: NavigationRequirement | undefined): boolean {
  return !requires || (requires !== 'platform' && rolesWith(requires).length === 3);
}

/**
 * Адреса вне меню, которые открыты не всем (ADR-098): вкладки настроек продавца и его агенты. Остальные адреса наследуют
 * право пункта меню по самому длинному совпадению пути. Первичную настройку объекта (`/onboarding`) не закрываем: туда
 * гейт ведёт всех, пока в отеле нет номеров, и администратору страница сама говорит, кто настраивает.
 */
const OFF_MENU_ROUTES: Array<Pick<NavigationItem, 'href' | 'label' | 'requires'>> = [
  { href: '/ai-seller/knowledge', label: 'Знания ИИ-продавца', requires: 'seller' },
  { href: '/ai-seller/connections', label: 'Подключения ИИ-продавца', requires: 'seller' },
  { href: '/ai-seller/agents', label: 'Агенты ИИ-продавца', requires: 'seller' },
];

/** Какой пункт (или адрес вне меню) отвечает за страницу — с его названием и правом. Нет такого — страница общая */
export function routeRule(
  path: string,
): Pick<NavigationItem, 'href' | 'label' | 'requires'> | undefined {
  const within = (href: string) => path === href || path.startsWith(`${href}/`);
  const extra = OFF_MENU_ROUTES.filter((r) => within(r.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return extra ?? activeNavigation(path);
}

/** Меню вошедшего: закрытые пункты убраны, раздел без пунктов не показывается */
export function sidebarSectionsFor(access: NavigationAccess): SidebarSection[] {
  return sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowedItem(item, access)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Ответ `/auth/me` → что открыто. Нет вошедшего или ответа — `CLOSED_ACCESS`. Роль незнакома (старый API) —
 * администратор: меню не обещает прав, которых у человека может не быть; решает всё равно API.
 */
export function deskAccessOf(
  me: {
    user: { platformAdmin?: boolean; role?: string } | null;
    access?: { aiSeller?: { access?: string } | null } | null;
  } | null,
): NavigationAccess {
  if (!me?.user) return CLOSED_ACCESS;
  const seller = me.access?.aiSeller?.access;
  return {
    aiSeller: seller === 'active' || seller === 'expired',
    platform: me.user.platformAdmin === true,
    role: (me.user.role && parseMembershipRole(me.user.role)) || 'STAFF',
  };
}

export function activeNavigation(path: string) {
  return navigationItems
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
