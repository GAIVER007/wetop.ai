import type { WebVertical } from './vertical-landing';
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
      { href: '/floor-plan', label: 'План зала', icon: 'board', requires: 'desk', description: 'План зала' },
      { href: '/table-reservations', label: 'Бронирования', icon: 'booking', requires: 'desk', description: 'Бронирования' },
      { href: '/dining-areas', label: 'Залы и столы', icon: 'settings', requires: 'desk', description: 'Залы и столы' },

      {
        href: '/calendar',
        label: 'Календарь',
        icon: 'board',
        requires: 'desk',
        description: 'Календарь',
      },
      {
        href: '/appointments',
        label: 'Записи',
        icon: 'booking',
        requires: 'desk',
        description: 'Записи',
      },
      {
        href: '/customers',
        label: 'Клиенты',
        icon: 'guests',
        requires: 'desk',
        description: 'Клиенты',
      },
      {
        href: '/employees',
        label: 'Мастера',
        icon: 'guests',
        requires: 'desk',
        description: 'Мастера',
      },
      {
        href: '/services',
        label: 'Услуги',
        icon: 'rates',
        requires: 'desk',
        description: 'Услуги',
      },
      {
        href: '/staff',
        label: 'Сотрудники и доступ',
        icon: 'guests',
        requires: 'staff',
        description: 'Сотрудники и доступ',
      },
      { href: '/help', label: 'Помощь', icon: 'help', requires: 'desk', description: 'Помощь' },
      {
        href: '/profile',
        label: 'Профиль',
        icon: 'guests',
        requires: 'desk',
        description: 'Профиль',
      },
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
      {
        // Задачи стойки (DATA_MODEL §22, ADR-145): вход из панели «Сегодня» календаря, отдельного пункта меню нет
        href: '/tasks',
        requires: 'desk',
        label: 'Задачи',
        icon: 'check',
        description: 'Что сделать смене: срок, приоритет, ответственный.',
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
            // Фишка №1 (ADR-142): загрузка ближайших отелей рядом со своей; смотрят, кто видит отчёты
            href: '/market',
            requires: 'reports',
            label: 'Загрузка конкурентов',
            icon: 'analytics',
            description:
              'Ваша загрузка рядом с загрузкой ближайших отелей на каждую ночь и подсказки к цене.',
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
        href: '/bar',
        requires: 'reports',
        label: 'Бар',
        icon: 'receipt',
        description: 'Приходы, товары, остатки, наценка и долги поставщикам.',
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
    ],
  },
  {
    // MKT2 (ADR-149): маркетинг отдельно от «Продаж». Право прежнее, `settings`, как у сайта: своего права «маркетинг»
    // нет (Q-273). Хаб `/marketing` первый вход, `/website/*` его продукт «Сайт и SEO», адреса не менялись
    label: 'Маркетинг',
    items: [
      {
        href: '/marketing',
        requires: 'settings',
        label: 'Маркетинг',
        icon: 'send',
        description: 'Сайт и SEO, а дальше реклама, контент и репутация.',
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

/**
 * Пункт меню направления (DS2a, план mv8-5-ds2-shell-navigation §12): канонический адрес `href`, свой `id` и префиксы
 * `match`, на которых он подсвечен (по умолчанию `[href]`). `hidden`: пункт уже есть в реестре и подсвечивается, но
 * в меню виден только с DS2b («График», «Филиалы», «Техподдержка», профиль гостиницы). Права `match` не даёт:
 * `routeRule` его не читает.
 */
export interface MenuItem extends NavigationItem {
  id: string;
  match?: string[];
  hidden?: true;
}

export interface MenuSection {
  id: string;
  label: string;
  icon: IconName;
  items: MenuItem[];
  /** Раздел из одного пункта: вкладка в шапке и прямая ссылка в меню телефона без раскрывашки (ADR-108) */
  direct?: boolean;
}

interface MenuOptions {
  label?: string;
  match?: string[];
  hidden?: true;
}

// Метаданные и дочерние ссылки нужны страницам-обзорам. Меню группирует тот же
// реестр по задачам сотрудника, не меняя заголовки страниц и их маршруты.
function menuItem(id: string, href: string, options: MenuOptions = {}): MenuItem {
  const item = navigationItems.find((entry) => entry.href === href);
  if (!item) throw new Error(`Unknown navigation route: ${href}`);
  const { label, ...rest } = options;
  return { ...item, ...(label ? { label } : {}), id, ...rest };
}

function direct(id: string, href: string, icon: IconName, options: MenuOptions = {}): MenuSection {
  const item = menuItem(id, href, options);
  return { id, label: item.label, icon, direct: true, items: [item] };
}

/**
 * «Филиалы» (DS2 §13): страница общая для трёх направлений, в `navigation` её нет, поэтому `routeRule` для `/branches`
 * пуст, как и раньше (F7). Право `desk` есть у всех ролей: подсветка видна каждому, кто видит страницу.
 */
const branchesItem: MenuItem = {
  id: 'branches',
  href: '/branches',
  label: 'Филиалы',
  icon: 'inventory',
  description: 'Филиалы организации и переход между ними.',
  requires: 'desk',
  hidden: true,
};

/** «Сотрудники и доступ» трёх направлений ведут сразу на `/team`; старый `/staff` остаётся перенаправлением (§14) */
const TEAM: MenuOptions = { label: 'Сотрудники и доступ', match: ['/team', '/staff'] };

/**
 * Разделы стойки в порядке строки вкладок (ADR-134): на компьютере строка в шапке, на телефоне и планшете
 * то же меню выдвижное. Работа смены (Главная, Шахматка, Брони, Гости) одним щелчком; группы с несколькими
 * экранами («Продажи», «Маркетинг», «Настройки», «Платформа») раскрывают список.
 */
// Порядок вкладок — по частоте использования (поручение владельца 03.10): работа смены,
// затем деньги дня (касса живёт в «Финансах»), продажи, отчётность; фонд и настройки — реже всего.
// «Отчёты» и «Аналитика» объединены в одну группу: оба раздела — «посмотреть цифры».
const hospitalityRegistry: MenuSection[] = [
  // задачи смены открываются из «Сегодня» (ADR-145), своего пункта у них нет
  direct('home', '/today', 'today', { match: ['/today', '/tasks'] }),
  direct('chessboard', '/chessboard', 'board'),
  direct('reservations', '/reservations', 'booking'),
  direct('guests', '/guests', 'guests'),
  direct('finance', '/finance', 'money', { label: 'Финансы' }),
  direct('bar', '/bar', 'receipt'),
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates',
    items: [
      // «Тарифы и цены» сняты 06.10.2026: цена категории — в «Категориях номеров»
      menuItem('market', '/market'),
      // подключение Channex относится к каналам, хоть и лежит под `/connections` (ADR-112)
      menuItem('channels', '/channels', {
        match: ['/channels', '/channel-manager', '/connections/channex'],
      }),
      menuItem('ai-agents', '/ai-agents', { label: 'ИИ-продавцы', match: ['/ai-agents', '/ai-seller'] }),
    ],
  },
  {
    // MKT2: «Сайт и SEO» ведёт в хаб; страницы сайта (`/website/*`) подсвечивают его же
    id: 'marketing',
    label: 'Маркетинг',
    icon: 'send',
    items: [menuItem('site', '/marketing', { label: 'Сайт и SEO', match: ['/marketing', '/website'] })],
  },
  {
    // хаб REP1 плюс «Аналитика» одной группой; «Оплаты» — вкладка «Финансов» (ADR-134)
    id: 'reports',
    label: 'Отчёты',
    icon: 'analytics',
    items: [
      menuItem('reports', '/reports', { label: 'Все отчёты' }),
      // старые `/management/*` перенаправляют в аналитику
      menuItem('analytics', '/management/analytics', { match: ['/management'] }),
    ],
  },
  // вкладки номерного фонда (ADR-108), старые `/rates` и карточка единицы `/units/*`
  direct('inventory', '/inventory', 'bed', { match: ['/inventory', '/rooms', '/rates', '/units'] }),
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      menuItem('property', '/hotel-settings', { label: 'Объект' }),
      menuItem('team', '/team', TEAM),
      menuItem('connections', '/connections', { label: 'Подключения' }),
      branchesItem,
      menuItem('journal', '/journal', { label: 'Журнал операций' }),
      // право `desk`: администратор видит неисправности (ADR-107) — для него группа сводится к этому пункту
      menuItem('incidents', '/incidents'),
    ],
  },
  {
    // «Техподдержка» живёт под переключателем агентов на «ИИ-продавце»: видимого пункта до DS2b у неё нет (В4)
    id: 'platform',
    label: 'Платформа',
    icon: 'system',
    items: [
      menuItem('organizations', '/platform'),
      menuItem('support', '/platform/support', { hidden: true }),
    ],
  },
  {
    // профиль и справка гостиницы открываются из меню профиля, вкладки у них нет; в DS2b переезжают в общее меню профиля
    id: 'account',
    label: 'Профиль',
    icon: 'guests',
    items: [
      menuItem('profile', '/profile', { hidden: true }),
      menuItem('help', '/help', { hidden: true }),
    ],
  },
];

/** Verified Business.vertical selects the working Beauty routes (MV5). */
const beautyRegistry: MenuSection[] = [
  direct('today', '/today', 'today', { label: 'Сегодня' }),
  // `/beauty` это прежний вход салона, в DS2c станет перенаправлением на календарь (§14)
  direct('calendar', '/calendar', 'board', { match: ['/calendar', '/beauty'] }),
  direct('appointments', '/appointments', 'booking'),
  direct('customers', '/customers', 'guests'),
  direct('employees', '/employees', 'guests', { match: ['/employees', '/beauty/masters'] }),
  // график мастера: канонический адрес, вкладка появится в DS2b (В1)
  direct('schedule', '/beauty/schedule', 'clock', { hidden: true }),
  direct('services', '/services', 'rates', { match: ['/services', '/beauty/services'] }),
  direct('team', '/team', 'guests', TEAM),
  direct('analytics', '/management/analytics', 'analytics'),
  direct('journal', '/journal', 'journal'),
  direct('help', '/help', 'help'),
  direct('profile', '/profile', 'guests'),
  { id: 'settings', label: 'Настройки', icon: 'settings', items: [branchesItem] },
];

const foodRegistry: MenuSection[] = [
  direct('today', '/today', 'today', { label: 'Сегодня' }),
  direct('floor-plan', '/floor-plan', 'board'),
  direct('table-reservations', '/table-reservations', 'booking'),
  direct('customers', '/customers', 'guests', { label: 'Гости' }),
  direct('dining-areas', '/dining-areas', 'settings'),
  direct('staff', '/team', 'guests', TEAM),
  direct('analytics', '/management/analytics', 'analytics'),
  direct('journal', '/journal', 'journal'),
  direct('help', '/help', 'help'),
  direct('profile', '/profile', 'guests'),
  { id: 'settings', label: 'Настройки', icon: 'settings', items: [branchesItem] },
];

const REGISTRY: Record<WebVertical, MenuSection[]> = {
  HOSPITALITY: hospitalityRegistry,
  BEAUTY: beautyRegistry,
  FOOD_SERVICE: foodRegistry,
};

/** Полный реестр направления, со скрытыми до DS2b пунктами: из него `activeItem` и тесты реестра */
export function menuRegistry(vertical: WebVertical): MenuSection[] {
  return REGISTRY[vertical];
}

/** Видимое меню: без скрытых пунктов и без разделов, в которых ничего не осталось */
function visible(sections: MenuSection[]): MenuSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.hidden) }))
    .filter((section) => section.items.length > 0);
}

export const menuSections: MenuSection[] = visible(hospitalityRegistry);
export const beautyMenuSections: MenuSection[] = visible(beautyRegistry);
export const foodMenuSections: MenuSection[] = visible(foodRegistry);

/** Нижняя панель телефона: первые четыре вкладки (работа смены) и кнопка «Ещё» (ADR-050, ADR-134) */
export const phoneNavigation: NavigationItem[] = menuSections
  .slice(0, 4)
  .map((section) => section.items[0]!);

/**
 * То же для салона: разделы его вертикали (Q-254). Не передана, значит гостиница, как было до среза B2.
 * В панель идут только одиночные вкладки: группы («Платформа», «Настройки») живут за кнопкой «Ещё».
 */
export function phoneNavigationFor(
  vertical: WebVertical = 'HOSPITALITY',
): NavigationItem[] {
  if (vertical === 'HOSPITALITY') return phoneNavigation;
  return (vertical === 'FOOD_SERVICE' ? foodMenuSections : beautyMenuSections)
    .filter((section) => section.direct)
    .slice(0, 4)
    .map((section) => section.items[0]!);
}

/** Какой пункт меню подсвечен: его раздел, `id` и канонический адрес */
export interface ActiveItem {
  sectionId: string;
  itemId: string;
  href: string;
}

/**
 * Единственное правило активного пункта (DS2 §12). Путь без `?…`, `#…` и хвостового `/`; пункты только этого
 * направления и только открытые этой роли; префикс совпадает целым сегментом (`/reservations` с `/reservations/ABC`,
 * но не с `/reservations-old`); самый длинный выигрывает, при равенстве первый по порядку меню. Направление
 * незнакомо: ничего не подсвечено, гостиница по умолчанию здесь не угадывается.
 */
export function activeItem(
  path: string,
  vertical: WebVertical | null | undefined,
  access: NavigationAccess,
): ActiveItem | null {
  const sections = vertical && Object.hasOwn(REGISTRY, vertical) ? REGISTRY[vertical] : null;
  if (!sections) return null;
  const bare = path.split(/[?#]/, 1)[0]!.replace(/\/+$/, '') || '/';
  let best: (ActiveItem & { length: number }) | null = null;
  for (const section of sections)
    for (const item of section.items) {
      if (!allowedItem(item, access)) continue;
      for (const prefix of item.match ?? [item.href]) {
        const hit = bare === prefix || bare.startsWith(`${prefix}/`);
        if (hit && (!best || prefix.length > best.length))
          best = { sectionId: section.id, itemId: item.id, href: item.href, length: prefix.length };
      }
    }
  return best && { sectionId: best.sectionId, itemId: best.itemId, href: best.href };
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
  vertical: WebVertical = 'HOSPITALITY',
): MenuSection[] {
  return (vertical === 'FOOD_SERVICE' ? foodMenuSections : vertical === 'BEAUTY' ? beautyMenuSections : menuSections)
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
