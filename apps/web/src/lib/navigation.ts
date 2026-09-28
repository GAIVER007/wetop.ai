import type { IconName } from '../components/icon';

/**
 * Что открыто вошедшему (ADR-083): пункт «ИИ-продавец» — организации с расширением, которое действует или у которого
 * вышел срок (тогда раздел только для чтения, Q-183); «Платформа» — главному администратору. Не знаем — закрыто.
 */
export interface NavigationAccess {
  aiSeller: boolean;
  platform: boolean;
}

export const CLOSED_ACCESS: NavigationAccess = { aiSeller: false, platform: false };

export interface NavigationItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: IconName;
  description: string;
  pending?: boolean;
  children?: NavigationItem[];
  /** Пункт виден только тому, кому это открыто; без поля — всем */
  requires?: keyof NavigationAccess;
}
export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Рабочее место',
    items: [
      {
        href: '/today',
        label: 'Главная',
        icon: 'today',
        description: 'Загрузка, деньги за период и задачи дня.',
      },
      {
        href: '/chessboard',
        label: 'Шахматка',
        icon: 'board',
        description: 'Размещение по номерам, койкам и датам.',
      },
      {
        href: '/reservations',
        label: 'Брони',
        icon: 'booking',
        description: 'Брони и проживания за выбранный день.',
      },
      {
        href: '/guests',
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
        label: 'Управление номерами',
        shortLabel: 'Номера',
        icon: 'bed',
        description: 'Номерной фонд, свободные места и условия продажи.',
        children: [
          {
            href: '/inventory',
            label: 'Номерной фонд',
            icon: 'inventory',
            description: 'Все номера и койки, состав и карточки размещения.',
          },
          {
            href: '/rooms/categories',
            label: 'Категории номеров',
            icon: 'bed',
            description: 'Типы размещения, количество единиц и вместимость.',
          },
          {
            href: '/rooms/availability',
            label: 'Доступность номеров',
            icon: 'board',
            description: 'Свободные номера и койки на весь срок проживания.',
          },
          {
            href: '/rates',
            label: 'Тарифы',
            icon: 'rates',
            description: 'Календарь цен, ограничения и массовое редактирование.',
          },
        ],
      },
      {
        // «Статистика» стала вкладкой «Загрузка» этого модуля (ТЗ «Аналитика v2», ADR-114)
        href: '/management/analytics',
        label: 'Аналитика',
        icon: 'analytics',
        description: 'Загрузка, выручка, брони, отмены и категории за период со сравнением.',
      },
      {
        href: '/finance',
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
        label: 'Менеджер каналов',
        icon: 'channels',
        description: 'Брони и стоимость по Booking.com, Trip.com и другим источникам.',
        children: [
          {
            href: '/channels',
            label: 'Синхронизация',
            icon: 'channels',
            description: 'Сопоставления, события и очередь Channex.',
          },
        ],
      },
      {
        href: '/ai-seller',
        label: 'ИИ-продавец',
        icon: 'chat',
        description: 'Бот на сайте объекта: настройки, знания, диалоги с гостями и код чата.',
        // Раздел доступен для знакомства; действия и данные защищены сервером.
      },
      {
        href: '/analytics',
        // «Аналитика» — теперь модуль показателей объекта; этот пункт — посещаемость сайта
        label: 'Аналитика сайта',
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
        label: 'Настройки гостиницы',
        shortLabel: 'Гостиница',
        icon: 'settings',
        description: 'Правила проживания, услуги и информация об объекте.',
        children: [
          {
            href: '/hotel-settings/penalties',
            label: 'Правила отмены',
            icon: 'journal',
            description: 'Политика отмены для каждого тарифного плана.',
          },
          {
            href: '/hotel-settings/services',
            label: 'Услуги',
            icon: 'plus',
            description: 'Каталог дополнительных услуг и цены.',
          },
        ],
      },
      {
        href: '/connections',
        label: 'Интеграции',
        icon: 'channels',
        description: 'Подключение каналов, счётчика и модуля бронирования.',
      },
      {
        href: '/analytics/setup',
        label: 'Настройки сайта',
        icon: 'settings',
        description: 'Подключение сайта и настройка виджета.',
      },
      {
        href: '/incidents',
        label: 'Неисправности',
        icon: 'incidents',
        description: 'Ошибки и состояние фоновых процессов.',
      },
      {
        href: '/journal',
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
      menuItem('/analytics'),
    ],
  },
  {
    id: 'finance',
    label: 'Финансы и отчёты',
    icon: 'money',
    items: [menuItem('/finance'), menuItem('/management/analytics')],
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
    // только главному администратору (ADR-083): данных чужих гостиниц здесь нет — названия, люди и расширения.
    // Техподдержка переехала под «ИИ-продавец» — там теперь два агента (переключатель на странице раздела)
    id: 'platform',
    label: 'Платформа',
    icon: 'system',
    items: [menuItem('/platform')],
  },
];

/** Открыт ли пункт этому вошедшему */
export function allowedItem(item: NavigationItem, access: NavigationAccess): boolean {
  return !item.requires || access[item.requires];
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

/** Ответ `/auth/me` → что открыто. Нет вошедшего или ответа — закрыто: пункт не появляется по ошибке */
export function deskAccessOf(
  me: {
    user: { platformAdmin?: boolean } | null;
    access?: { aiSeller?: { access?: string } | null } | null;
  } | null,
): NavigationAccess {
  if (!me?.user) return CLOSED_ACCESS;
  const seller = me.access?.aiSeller?.access;
  return {
    aiSeller: seller === 'active' || seller === 'expired',
    platform: me.user.platformAdmin === true,
  };
}

export function activeNavigation(path: string) {
  return navigationItems
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
