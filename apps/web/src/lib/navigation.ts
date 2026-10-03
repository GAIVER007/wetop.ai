import {
  can,
  parseMembershipRole,
  rolesWith,
  type MembershipRole,
  type Permission,
} from '@pms/domain';
import type { IconName } from '../components/icon';

/**
 * Что открыто вошедшему (ADR-083, ADR-107): «Платформа» — главному администратору; остальное — по роли в организации
 * (права — DATA_MODEL §16.5, таблица в домене). Расширение «ИИ-продавец» пункт меню не прячет (ADR-090).
 */
export interface NavigationAccess {
  aiSeller: boolean;
  platform: boolean;
  /**
   * Роль вошедшего. `null` — API ответил, что никто не вошёл: так бывает, только пока замок выключен (разработка, проверки
   * стенда), и тогда разделы по ролям не прячутся — как и API без человека за запросом ролей не проверяет. Сбой
   * `/auth/me` — не `null`, а `UNKNOWN_ACCESS` (`desk-shell.ts`).
   */
  role: MembershipRole | null;
  /**
   * Роль не узнали: `/auth/me` не ответил (сбой, тайм-аут). Меню и кнопки тогда — как у администратора, а страница по
   * адресу открывается как есть (`pageOpen`): решает API, а «нет доступа» было бы неправдой.
   */
  unknown?: true;
}

/** Никто не вошёл (или API не ответил): «Платформы» нет, разделы по ролям не прячутся */
export const CLOSED_ACCESS: NavigationAccess = { aiSeller: false, platform: false, role: null };

/** Пока `/auth/me` не ответил, меню — как у администратора: пункты появляются, а не исчезают у него на глазах */
export const PENDING_ACCESS: NavigationAccess = { aiSeller: false, platform: false, role: 'STAFF' };

/** `/auth/me` ответил сбоем: меню и кнопки — как у администратора, страницы по адресу не закрываем (ADR-107) */
export const UNKNOWN_ACCESS: NavigationAccess = { ...PENDING_ACCESS, unknown: true };

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
  /** Кому открыт пункт и страница по его адресу (ADR-107); у пункта меню поле обязательно — тест */
  requires?: NavigationRequirement;
}
export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Рабочее место',
    items: [
      {
        href: '/beauty',
        requires: 'desk',
        label: 'Салон',
        icon: 'today',
        description: 'Рабочее место салона: филиал, что уже работает и что настраивается.',
      },
      {
        href: '/beauty/services',
        requires: 'desk',
        label: 'Услуги салона',
        icon: 'rates',
        description: 'Каталог услуг сети: длительность и цена, своя цена филиала.',
      },
      {
        href: '/beauty/masters',
        requires: 'desk',
        label: 'Мастера',
        icon: 'guests',
        description: 'Мастера сети: филиалы, в которых работают, и что умеют.',
      },
      {
        href: '/beauty/schedule',
        requires: 'desk',
        label: 'График',
        icon: 'clock',
        description: 'График мастера в филиале неделей, его отсутствия и филиалы, где он работает.',
      },
      {
        href: '/today',
        requires: 'desk',
        label: 'Главная',
        icon: 'today',
        description: 'Рабочий экран дня: стойка, задачи и быстрые действия.',
      },
      {
        href: '/chessboard',
        requires: 'desk',
        label: 'Календарь',
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
            label: 'Свободные места',
            icon: 'board',
            description:
              'Что можно продать на выбранные даты: номера и койки, свободные весь срок.',
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
        // «Статистика» стала вкладкой «Загрузка» этого модуля (ТЗ «Аналитика v2», ADR-114)
        href: '/management/analytics',
        requires: 'reports',
        label: 'Аналитика',
        icon: 'analytics',
        description: 'Загрузка, выручка, брони, отмены и категории за период со сравнением.',
      },
      {
        href: '/finance',
        requires: 'reports',
        label: 'Оплаты',
        icon: 'money',
        description: 'Начисления, оплаты, возвраты и остатки за период.',
      },
      {
        // Хаб REP1 (план reports-hub-2026-10-02): один вход ко всем отчётам, числа за период и ссылки в готовые экраны
        href: '/reports',
        requires: 'reports',
        label: 'Отчёты',
        icon: 'analytics',
        description: 'Все отчёты в одном месте: деньги, загрузка, день и сайт.',
      },
    ],
  },
  {
    label: 'Продажи',
    items: [
      {
        // Один модуль вместо «Менеджера каналов» и «Синхронизации каналов» (ADR-112)
        href: '/channels',
        requires: 'channels',
        label: 'Каналы продаж',
        icon: 'channels',
        description: 'Обмен с Booking.com и другими каналами: брони по источникам, цены, остатки.',
        children: [
          {
            href: '/channels/connections',
            requires: 'channels',
            label: 'Подключения',
            icon: 'channels',
            description: 'Подключение менеджера каналов и настройка обмена.',
          },
          {
            href: '/channels/mapping',
            requires: 'channels',
            label: 'Сопоставление',
            icon: 'channels',
            description: 'Категории и тарифы WETOP в менеджере каналов.',
          },
          {
            href: '/channels/sync',
            requires: 'channels',
            label: 'Синхронизация',
            icon: 'channels',
            description: 'Очередь изменений в каналы и её состояние.',
          },
          {
            href: '/channels/events',
            requires: 'channels',
            label: 'События',
            icon: 'channels',
            description: 'Входящие события каналов: брони, изменения, отмены.',
          },
        ],
      },
      {
        // Вход в раздел — список агентов (S0, план ai-agents-wetop-support): AI-продавец живёт по `/ai-seller`,
        // WETOP Support — по `/platform/support`, карточку видит только главный администратор
        href: '/ai-agents',
        requires: 'dialogs',
        label: 'ИИ-агенты',
        icon: 'chat',
        description:
          'ИИ-продавец на сайте объекта: настройки, знания, диалоги с гостями и код чата.',
        // Раздел доступен для знакомства; действия и данные защищены сервером.
      },
      {
        // ADR-117: сайт объекта — одно место (раньше «Аналитика сайта», «Настройки сайта» и панель в «Интеграциях»)
        href: '/website',
        requires: 'settings',
        label: 'Сайт и онлайн-бронирование',
        icon: 'analytics',
        description: 'Домен сайта, счётчик посещений, бронирование с сайта и его аналитика.',
      },
    ],
  },
  {
    label: 'Система',
    items: [
      {
        href: '/hotel-settings',
        requires: 'settings',
        label: 'Настройки объекта',
        shortLabel: 'Объект',
        icon: 'settings',
        description: 'Сведения об объекте, часы заезда и выезда, услуги.',
        // правила отмены — свойство тарифа, их место в «Тарифах» (ADR-115)
        children: [
          {
            href: '/hotel-settings/stay',
            requires: 'settings',
            label: 'Проживание',
            icon: 'clock',
            description: 'Время заезда и выезда.',
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
        // Команда — видимый раздел (TEAM1, план settings-hub-2026-10-02): раньше жила только в «Профиль → Доступ» —
        // при слиянии 02.10 заменил параллельный /staff (список на login/team-section): /staff — переадресация
        href: '/team',
        requires: 'staff',
        label: 'Сотрудники',
        icon: 'guests',
        description: 'Люди организации: роли, приглашения и доступ.',
      },
      {
        href: '/connections',
        requires: 'settings',
        label: 'Интеграции',
        icon: 'channels',
        description: 'Внешние сервисы объекта: состояние подключения и где его настроить.',
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
        href: '/platform/support',
        label: 'Техподдержка WETOP',
        description: 'Управление поддержкой платформы.',
        icon: 'chat',
        requires: 'platform',
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

export interface MenuSection {
  id: string;
  label: string;
  icon: IconName;
  items: NavigationItem[];
  /** Раздел из одного пункта: вкладка в шапке и прямая ссылка в меню телефона без раскрывашки (ADR-108) */
  direct?: boolean;
}

// Метаданные и дочерние ссылки нужны страницам-обзорам. Меню группирует тот же
// реестр по задачам сотрудника, не меняя заголовки страниц и их маршруты.
function menuItem(href: string, label?: string): NavigationItem {
  const item = navigationItems.find((entry) => entry.href === href);
  if (!item) throw new Error(`Unknown navigation route: ${href}`);
  return label ? { ...item, label } : item;
}

function direct(id: string, href: string, icon: IconName, label?: string): MenuSection {
  const item = menuItem(href, label);
  return { id, label: item.label, icon, direct: true, items: [item] };
}

/**
 * Разделы стойки в порядке строки вкладок (ADR-134): на компьютере строка в шапке, на телефоне и планшете
 * то же меню выдвижное. Работа смены (Главная, Шахматка, Брони, Гости) одним щелчком; группы с несколькими
 * экранами («Продажи», «Настройки», «Платформа») раскрывают список.
 */
// Порядок вкладок — по частоте использования (поручение владельца 03.10): работа смены,
// затем деньги дня (касса живёт в «Финансах»), продажи, отчётность; фонд и настройки — реже всего.
// «Отчёты» и «Аналитика» объединены в одну группу: оба раздела — «посмотреть цифры».
export const menuSections: MenuSection[] = [
  direct('home', '/today', 'today'),
  direct('chessboard', '/chessboard', 'board'),
  direct('reservations', '/reservations', 'booking'),
  direct('guests', '/guests', 'guests'),
  direct('finance', '/finance', 'money', 'Финансы'),
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates',
    items: [
      menuItem('/rates', 'Тарифы и цены'),
      menuItem('/channels'),
      menuItem('/ai-agents', 'ИИ-продавцы'),
      menuItem('/website'),
    ],
  },
  {
    // хаб REP1 плюс «Аналитика» одной группой; «Оплаты» — вкладка «Финансов» (ADR-134)
    id: 'reports',
    label: 'Отчёты',
    icon: 'analytics',
    items: [menuItem('/reports', 'Все отчёты'), menuItem('/management/analytics')],
  },
  direct('inventory', '/inventory', 'bed'),
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      menuItem('/hotel-settings', 'Объект'),
      menuItem('/team', 'Сотрудники и доступ'),
      menuItem('/connections', 'Подключения'),
      menuItem('/journal', 'Журнал действий'),
      // право `desk`: администратор видит неисправности (ADR-107) — для него группа сводится к этому пункту
      menuItem('/incidents'),
    ],
  },
  {
    // «Техподдержка» переехала под переключатель агентов на «ИИ-продавце»: своего пункта меню
    // у неё нет, маршрут /platform/support остаётся в реестре ради прав (routeRule)
    id: 'platform',
    label: 'Платформа',
    icon: 'system',
    items: [menuItem('/platform')],
  },
];

/**
 * Разделы салона (DATA_MODEL §19, решение Q-254 от 03.10.2026, ADR-140). Вертикаль филиала решает, какое меню
 * видит человек: у салона нет ни объекта, ни броней, ни тарифов, поэтому гостиничные разделы ему не показываются,
 * они просто не нашли бы объект. Здесь только то, что в салоне действительно работает; записи, мастера и услуги
 * появятся срезами B3...B6, и до тех пор меню их не обещает (DESIGN.md §19.9 про честность экрана).
 */
export const beautyMenuSections: MenuSection[] = [
  direct('salon', '/beauty', 'today', 'Салон'),
  direct('beauty-services', '/beauty/services', 'rates', 'Услуги'),
  direct('beauty-masters', '/beauty/masters', 'guests', 'Мастера'),
  direct('beauty-schedule', '/beauty/schedule', 'clock', 'График'),
  direct('team', '/team', 'guests'),
  direct('journal', '/journal', 'journal'),
  {
    id: 'platform',
    label: 'Платформа',
    icon: 'system',
    items: [menuItem('/platform')],
  },
];

/** Нижняя панель телефона: первые четыре вкладки (работа смены) и кнопка «Ещё» (ADR-050, ADR-134) */
export const phoneNavigation: NavigationItem[] = menuSections
  .slice(0, 4)
  .map((section) => section.items[0]!);

/**
 * То же для салона: разделы его вертикали (Q-254). Не передана, значит гостиница, как было до среза B2.
 * В панель идут только одиночные вкладки: группы («Платформа», «Настройки») живут за кнопкой «Ещё».
 */
export function phoneNavigationFor(
  vertical: 'HOSPITALITY' | 'BEAUTY' = 'HOSPITALITY',
): NavigationItem[] {
  if (vertical !== 'BEAUTY') return phoneNavigation;
  return beautyMenuSections
    .filter((section) => section.direct)
    .slice(0, 4)
    .map((section) => section.items[0]!);
}

/** Есть ли у вошедшего право. Никто не вошёл — открыто: так же поступает API (ADR-107) */
export function mayAccess(access: NavigationAccess, permission: Permission): boolean {
  return access.role === null || can(access.role, permission);
}

/**
 * Открыть ли страницу, пришедшую по адресу (ADR-107): право есть — да; роль не узнали — тоже да: данных без права API
 * всё равно не отдаст, а при недоступном API страница сама скажет, что связи нет, — вместо «Нет доступа… ваша роль —
 * администратор», неправды для владельца. Кнопки возврата и сторно этим не открываются: они смотрят `mayAccess`.
 */
export function pageOpen(access: NavigationAccess, permission: Permission): boolean {
  return mayAccess(access, permission) || access.unknown === true;
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
 * Адреса вне меню, которые открыты не всем (ADR-107): вкладки настроек продавца и его агенты. Остальные адреса наследуют
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

/**
 * Меню вошедшего: закрытые пункты убраны, раздел без пунктов не показывается. Вертикаль решает набор разделов
 * (Q-254): у филиала-салона свой, гостиничный ему нечем наполнить. Не передана, значит гостиница, как было до B2.
 */
export function menuSectionsFor(
  access: NavigationAccess,
  vertical: 'HOSPITALITY' | 'BEAUTY' = 'HOSPITALITY',
): MenuSection[] {
  return (vertical === 'BEAUTY' ? beautyMenuSections : menuSections)
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

/**
 * Какой пункт меню подсвечен на этом адресе: вкладки модулей не пункты меню, активен их корень
 * («Настройки объекта» ADR-115, «Номерной фонд» ADR-108, «Каналы продаж» ADR-112)
 */
export function activeMenuRoute(path: string): string | undefined {
  const route = activeNavigation(path)?.href;
  if (!route) return undefined;
  if (route.startsWith('/hotel-settings')) return '/hotel-settings';
  if (route.startsWith('/rooms')) return '/inventory';
  if (route.startsWith('/channels')) return '/channels';
  return route;
}

/** Страницы агентов лежат под своими адресами, но в меню это один пункт «ИИ-агенты» */
const AGENT_PAGES = '/ai-seller';

export function activeNavigation(path: string) {
  if (path === AGENT_PAGES || path.startsWith(`${AGENT_PAGES}/`)) {
    return navigationItems.find((item) => item.href === '/ai-agents');
  }
  return navigationItems
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
