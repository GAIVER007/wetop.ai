import type { WebVertical } from './vertical-landing';
import {
  ORGANIZATION_LEVEL_PERMISSIONS,
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
   * У человека область доступа (DATA_MODEL §31.1): права уровня организации (команда, роли, журнал) ему закрыты,
   * даже если роль в филиале управляющая. API это проверяет; стойка не показывает то, что API откажет.
   */
  restricted?: true;
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
      { href: '/floor-plan', label: 'План зала', icon: 'board', requires: 'desk', description: 'Столы зала сейчас: свободны, забронированы, заняты, ждут уборки.' },
      { href: '/table-reservations', label: 'Бронирования', icon: 'booking', requires: 'desk', description: 'Брони столов на день: время, гости, стол и статус.' },
      { href: '/dining-areas', label: 'Залы и столы', icon: 'settings', requires: 'desk', description: 'Залы, столы и их вместимость.' },
      // Ресторан по ТЗ владельца 09.10.2026 (ADR-159)
      { href: '/orders', label: 'Заказы', icon: 'receipt', requires: 'desk', description: 'Заказы ресторана' },
      { href: '/kitchen', label: 'Кухня', icon: 'kitchen', requires: 'desk', description: 'Экран кухни (KDS)' },
      { href: '/menu', label: 'Меню', icon: 'kettle', requires: 'desk', description: 'Меню и техкарты' },
      // Склад кухни FS2 (DATA_MODEL §34, ADR-KITCHEN-FS)
      { href: '/stock', label: 'Склад', icon: 'stock', requires: 'desk', description: 'Склад кухни: ингредиенты и остатки' },
      { href: '/payroll', label: 'Зарплата', icon: 'money', requires: 'staff', description: 'Зарплата и финансы' },
      { href: '/cashbox', label: 'Касса', icon: 'money', requires: 'desk', description: 'Касса филиала' },
      // макет ресторана из 14 экранов (12.10.2026): бар, финансы и настройки ресторана своими экранами
      { href: '/drinks', label: 'Бар', icon: 'breakfast', requires: 'desk', description: 'Бар: напитки и заказы' },
      { href: '/restaurant-finance', label: 'Финансы', icon: 'money', requires: 'reports', description: 'Выручка, расходы и поступления ресторана' },
      { href: '/restaurant-settings', label: 'Настройки', icon: 'settings', requires: 'property', description: 'Часы работы, бронирования и разделы ресторана' },

      {
        href: '/calendar',
        label: 'Календарь',
        icon: 'board',
        requires: 'desk',
        description: 'Записи дня по мастерам на оси времени и свободные окна.',
      },
      {
        href: '/appointments',
        label: 'Записи',
        icon: 'booking',
        requires: 'desk',
        description: 'Все записи дня списком: клиент, услуга, мастер и статус.',
      },
      {
        href: '/customers',
        label: 'Клиенты',
        icon: 'guests',
        requires: 'desk',
        description: 'Клиенты бизнеса: контакты и история визитов.',
      },
      {
        href: '/employees',
        label: 'Мастера',
        icon: 'guests',
        requires: 'desk',
        description: 'Мастера филиала: что умеют и где работают.',
      },
      {
        href: '/services',
        label: 'Услуги',
        icon: 'rates',
        requires: 'desk',
        description: 'Каталог услуг: длительность и цена.',
      },
      {
        href: '/staff',
        label: 'Сотрудники и доступ',
        icon: 'guests',
        requires: 'staff',
        description: 'Люди организации: роли, приглашения и доступ.',
      },
      { href: '/help', label: 'Помощь', icon: 'help', requires: 'desk', description: 'Ответы на частые вопросы и связь с поддержкой.' },
      {
        href: '/profile',
        label: 'Профиль',
        icon: 'guests',
        requires: 'desk',
        description: 'Ваши данные, вход и оформление.',
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
        label: 'Сегодня',
        icon: 'today',
        description: 'Главная: загрузка, события дня и задачи объекта; у салона и ресторана их рабочий день.',
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
        // «Гости и бронирования» (09.10.2026): один экран вместо вкладок «Брони» и «Гости»; список броней
        // `/reservations` остаётся кнопкой внутри экрана, а в меню своего пункта у него нет
        href: '/guests',
        requires: 'desk',
        label: 'Гости и бронирования',
        shortLabel: 'Брони', // на вкладке телефона 75 px «Гости и брони» переносится на две строки и поднимает панель
        icon: 'guests',
        description: 'Единая база гостей, бронирований и проживаний.',
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
        label: 'Финансы',
        icon: 'money',
        description: 'Доходы, поступления, расходы, прибыль, операции, касса и отчёты.',
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
        // Хаб «Продажи» (SALES2.2, plans/sales2-audit-2026-10-09.md): один вход к конкурентам, ИИ-продавцу и числам
        href: '/sales',
        requires: 'reports',
        label: 'Обзор продаж',
        icon: 'rates',
        description: 'Брони из диалогов, выручка, конкуренты и ИИ-продавец на одной странице.',
      },
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
        label: 'ИИ-продавцы',
        icon: 'chat',
        description:
          'ИИ-продавец на сайте объекта: настройки, знания, диалоги с гостями и код чата.',
        // Раздел доступен для знакомства; действия и данные защищены сервером.
      },
    ],
  },
  {
    // MKT2 (ADR-149): маркетинг отдельно от «Продаж». Право прежнее, `settings`, как у сайта: своего права «маркетинг»
    // нет (Q-273). Хаб `/marketing` первый вход, `/website/*` его продукт «Сайт и SEO», адреса не менялись.
    // ADR-184: раздел называется «Продвижение»
    label: 'Продвижение',
    items: [
      {
        href: '/marketing',
        requires: 'marketing',
        label: 'Продвижение',
        icon: 'send',
        description: 'Сайт и SEO, реклама, конкуренты, контент и бюджет в одном разделе.',
      },
      {
        // МКТ-В1/В2 (ADR-MKT-B1): учёт рекламного бюджета и расходов; право раздела, как у хаба
        href: '/marketing/budget',
        requires: 'marketing',
        label: 'Бюджет маркетинга',
        icon: 'money',
        description: 'План месяца и расходы на продвижение по каналам.',
      },
      {
        // «Маркетинг → Аналитика» (10.10.2026): эффективность источников; лиды и выручка с этапов В3/В5/В6
        href: '/marketing/analytics',
        requires: 'marketing',
        label: 'Аналитика маркетинга',
        icon: 'analytics',
        description: 'Расходы, лиды и продажи по источникам: куда уходят деньги и что они приносят.',
      },
      {
        // «Продвижение» (ADR-184): ИИ-таргетолог, пункт меню у всех направлений
        href: '/marketing/ads',
        requires: 'marketing',
        label: 'Реклама',
        icon: 'channels',
        description: 'ИИ-таргетолог: кампании Facebook и Instagram, запуск по вашему подтверждению.',
      },
      {
        href: '/marketing/content',
        requires: 'marketing',
        label: 'Контент',
        icon: 'journal',
        description: 'Посты, фото и план публикаций.',
      },
      {
        // Фишка №1 (ADR-142): загрузка ближайших отелей рядом со своей; с ADR-184 в «Продвижении»
        href: '/market',
        requires: 'reports',
        label: 'Анализ конкурентов',
        icon: 'analytics',
        description:
          'Ваша загрузка рядом с загрузкой ближайших отелей на каждую ночь и подсказки к цене.',
      },
      {
        // ADR-117: сайт объекта — одно место (раньше «Аналитика сайта», «Настройки сайта» и панель в «Интеграциях»)
        href: '/website',
        requires: 'marketing',
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
        description: 'Сведения об объекте, часы заезда и выезда, услуги, способы оплаты и статьи кассы.',
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
          {
            href: '/hotel-settings/directories',
            requires: 'settings',
            label: 'Справочники',
            icon: 'card',
            description: 'Способы оплаты и статьи кассы.',
          },
        ],
      },
      {
        // Команда — видимый раздел (TEAM1, план settings-hub-2026-10-02): раньше жила только в «Профиль → Доступ» —
        // при слиянии 02.10 заменил параллельный /staff (список на login/team-section): /staff — переадресация
        href: '/team',
        requires: 'staff',
        label: 'Сотрудники и доступ',
        icon: 'guests',
        description: 'Люди организации: роли, приглашения и доступ.',
      },
      {
        href: '/connections',
        requires: 'settings',
        label: 'Подключения',
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
        label: 'Журнал операций',
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
        description: 'Организации платформы и их расширения: только для главного администратора.',
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
  /**
   * Адреса вне пунктов меню, которые принадлежат разделу: карточка места в «Номерном фонде», задачи смены
   * в «Календаре», мастера салона в «Мастерах». По ним кнопка раздела в шапке называет раздел, а не «Разделы»
   */
  match?: string[];
}

// Метаданные и дочерние ссылки нужны страницам-обзорам. Меню группирует тот же
// реестр по задачам сотрудника, не меняя заголовки страниц и их маршруты.
function menuItem(href: string, label?: string): NavigationItem {
  const item = navigationItems.find((entry) => entry.href === href);
  if (!item) throw new Error(`Unknown navigation route: ${href}`);
  return label ? { ...item, label } : item;
}

function direct(
  id: string,
  href: string,
  icon: IconName,
  label?: string,
  match?: string[],
): MenuSection {
  const item = menuItem(href, label);
  return { id, label: item.label, icon, direct: true, items: [item], ...(match ? { match } : {}) };
}

/**
 * «Продвижение» (ADR-184): один состав у всех направлений. «Конкуренты» сегодня только у гостиницы (мониторинг
 * загрузки номеров, ADR-142); у салона и ресторана пункт появится со срезом PROMO-8.
 */
function promotionSection(vertical: WebVertical): MenuSection {
  return {
    id: 'marketing',
    label: 'Продвижение',
    icon: 'send' as IconName,
    items: [
      menuItem('/marketing', 'Обзор'),
      menuItem('/marketing/ads', 'Реклама'),
      ...(vertical === 'HOSPITALITY' ? [menuItem('/market', 'Конкуренты')] : []),
      menuItem('/marketing/content', 'Контент'),
      menuItem('/marketing/budget', 'Бюджет'),
      menuItem('/marketing/analytics', 'Аналитика'),
    ],
    match: ['/website'],
  };
}

/**
 * Разделы стойки в порядке строки вкладок (ADR-134): на компьютере строка в шапке, на телефоне и планшете
 * то же меню выдвижное. Работа смены одним щелчком; группы с несколькими экранами
 * («Продажи», «Маркетинг», «Отчёты», «Настройки») раскрывают список.
 */
// Порядок гостиничного меню утверждён владельцем 13.10.2026: календарь, гости, фонд,
// финансы, продажи, маркетинг, отчёты и настройки. Адреса и права сохраняются.
export const menuSections: MenuSection[] = [
  // «Главная» первой (решение владельца 13.10.2026, ADR-180); дальше порядок #501
  direct('today', '/today', 'today', 'Главная'),
  // задачи смены открываются из панели «Сегодня» календаря (ADR-145): раздел тот же
  direct('chessboard', '/chessboard', 'board', undefined, ['/tasks']),
  // Одна вкладка вместо «Брони» и «Гости» (поручение владельца 09.10.2026): экран `/guests` по макету; список
  // броней со всеми отборами и экспортом открывается кнопкой на нём, адреса и права страниц прежние
  direct('guests', '/guests', 'guests', undefined, ['/reservations']),
  direct('inventory', '/inventory', 'bed', undefined, ['/units', '/rooms', '/rates']),
  {
    // «Бар» живёт внутри «Финансов» (ADR-157, поручение владельца 09.10.2026): товарно-денежный учёт
    // рядом с кассой, своей вкладки у него нет. Маршруты и права не менялись.
    id: 'finance',
    label: 'Финансы',
    icon: 'money',
    items: [menuItem('/finance', 'Оплаты и касса'), menuItem('/bar')],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates',
    items: [
      // «Тарифы и цены» сняты 06.10.2026: цена категории — в «Категориях номеров»
      menuItem('/sales'),
      // «Конкуренты» с ADR-184 в «Продвижении»
      menuItem('/channels'),
      menuItem('/ai-agents'),
    ],
    match: ['/ai-seller', '/channel-manager'],
  },
  // MKT2: страницы сайта (`/website/*`) подсвечивают хаб (`activeMenuRoute`); ADR-184: «Продвижение»
  promotionSection('HOSPITALITY'),
  {
    // хаб REP1 плюс «Аналитика» одной группой; «Оплаты» — вкладка «Финансов» (ADR-134)
    id: 'reports',
    label: 'Отчёты',
    icon: 'analytics',
    items: [menuItem('/reports', 'Все отчёты'), menuItem('/management/analytics', 'Аналитика бизнеса')],
    match: ['/management'],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      menuItem('/hotel-settings', 'Объект'),
      menuItem('/team', 'Сотрудники и доступ'),
      menuItem('/connections'),
      menuItem('/journal'),
      // право `desk`: администратор видит неисправности (ADR-107) — для него группа сводится к этому пункту
      menuItem('/incidents'),
      // Вкладка «Платформа» снята по поручению владельца 09.10.2026: «Организации» главного администратора живут
      // в «Настройках», пункт виден только по его отметке. «Техподдержка» по-прежнему под переключателем агентов
      // на «ИИ-продавце»: своего пункта меню у неё нет, маршрут /platform/support остаётся в реестре ради прав
      menuItem('/platform'),
    ],
    match: ['/branches', '/hotel-settings', '/connections', '/team', '/staff', '/platform'],
  },
];

/** Verified Business.vertical selects the working Beauty routes (MV5). */
export const beautyMenuSections: MenuSection[] = [
  direct('today', '/today', 'today', 'Сегодня'),
  // `/beauty` прежний адрес календаря салона: тот же экран
  direct('calendar', '/calendar', 'board', undefined, ['/beauty']),
  direct('appointments', '/appointments', 'booking'),
  direct('customers', '/customers', 'guests'),
  direct('employees', '/employees', 'guests', undefined, ['/beauty/masters']),
  // «График» салона отдельной вкладкой (решение владельца №1 по плану DS2, 09.10.2026)
  direct('schedule', '/beauty/schedule', 'clock'),
  direct('services', '/services', 'rates', undefined, ['/beauty/services']),
  {
    id: 'money',
    label: 'Финансы',
    icon: 'money' as IconName,
    // касса салона: касса филиала §35.2, общая с рестораном (§48); бар продаёт в неё
    items: [menuItem('/finance', 'Выручка'), menuItem('/cashbox'), menuItem('/bar', 'Бар')],
  },
  {
    id: 'team',
    label: 'Команда',
    icon: 'guests' as IconName,
    items: [menuItem('/team', 'Сотрудники и доступ')],
    match: ['/staff'],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates' as IconName,
    items: [menuItem('/sales'), menuItem('/ai-agents')],
    match: ['/ai-seller'],
  },
  promotionSection('BEAUTY'),
  {
    id: 'reports',
    label: 'Отчёты',
    icon: 'analytics' as IconName,
    items: [menuItem('/reports', 'Все отчёты'), menuItem('/management/analytics', 'Аналитика бизнеса')],
    match: ['/management'],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings' as IconName,
    items: [
      menuItem('/connections'),
      menuItem('/journal'),
      menuItem('/incidents'),
    ],
  },
  direct('help', '/help', 'help'),
  direct('profile', '/profile', 'guests'),
];

/**
 * Меню ресторана (ADR-159): группы по выбору владельца 11.10.2026, чтобы в левой колонке под кнопкой раздела
 * были видны подразделы, как у гостиницы. Адреса и права прежние.
 */
export const foodMenuSections: MenuSection[] = [
  direct('today', '/today', 'today', 'Главная'),
  {
    id: 'hall',
    label: 'Зал',
    icon: 'board' as IconName,
    items: [menuItem('/floor-plan'), menuItem('/table-reservations'), menuItem('/dining-areas')],
  },
  {
    id: 'orders',
    label: 'Заказы',
    icon: 'receipt' as IconName,
    items: [
      menuItem('/orders'),
      menuItem('/kitchen'),
      menuItem('/drinks'),
      menuItem('/menu'),
      menuItem('/stock'),
    ],
  },
  // гости ресторана это его клиенты (`customers`); гостиничный `/guests` ресторану не нужен
  direct('customers', '/customers', 'guests', 'Гости'),
  {
    id: 'money',
    label: 'Финансы',
    icon: 'money' as IconName,
    // бар филиала (ADR-178): деньги бара ресторана в кассе ресторана (§45)
    items: [menuItem('/restaurant-finance'), menuItem('/cashbox'), menuItem('/finance', 'Оплаты и касса'), menuItem('/bar', 'Бар')],
  },
  {
    id: 'team',
    label: 'Команда',
    icon: 'guests' as IconName,
    // «Сотрудники и доступ» ведут прямо на `/team`; старый `/staff` только перенаправляет сюда (DS2 §14)
    items: [menuItem('/employees', 'Сотрудники'), menuItem('/payroll'), menuItem('/team', 'Сотрудники и доступ')],
    match: ['/staff'],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: 'rates' as IconName,
    items: [menuItem('/sales'), menuItem('/ai-agents')],
  },
  promotionSection('FOOD_SERVICE'),
  {
    id: 'reports',
    label: 'Отчёты',
    icon: 'analytics' as IconName,
    items: [menuItem('/reports', 'Все отчёты'), menuItem('/management/analytics', 'Аналитика бизнеса')],
    match: ['/management'],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings' as IconName,
    items: [
      menuItem('/restaurant-settings'),
      menuItem('/connections'),
      menuItem('/journal'),
      menuItem('/incidents'),
    ],
  },
  direct('help', '/help', 'help'),
  direct('profile', '/profile', 'guests'),
];

/**
 * Нижняя панель телефона: первые четыре вкладки шапки и кнопка «Ещё» (ADR-050, ADR-134).
 * Группа («Финансы» с ADR-157) даёт панели свой первый пункт, но под именем группы:
 * подпись пункта «Оплаты и касса» для вкладки панели длинна и уже смысла группы.
 */
export const phoneNavigation: NavigationItem[] = menuSections
  .slice(0, 4)
  .map((section) =>
    section.direct ? section.items[0]! : { ...section.items[0]!, label: section.label },
  );

/**
 * То же для салона: разделы его вертикали (Q-254). Не передана, значит гостиница, как было до среза B2.
 * В панель идут только одиночные вкладки: группы («Продажи», «Настройки») живут за кнопкой «Ещё».
 */
export function phoneNavigationFor(
  vertical: WebVertical = 'HOSPITALITY',
): NavigationItem[] {
  if (vertical === 'HOSPITALITY') return phoneNavigation;
  // у ресторана группы: вкладка группы ведёт на её первый пункт под именем группы, как у гостиницы
  if (vertical === 'FOOD_SERVICE')
    return foodMenuSections
      .slice(0, 4)
      .map((section) =>
        section.direct ? section.items[0]! : { ...section.items[0]!, label: section.label },
      );
  return beautyMenuSections
    .filter((section) => section.direct)
    .slice(0, 4)
    .map((section) => section.items[0]!);
}

/** Есть ли у вошедшего право. Никто не вошёл — открыто: так же поступает API (ADR-107) */
export function mayAccess(access: NavigationAccess, permission: Permission): boolean {
  if (access.restricted && ORGANIZATION_LEVEL_PERMISSIONS.includes(permission)) return false;
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
    user: { platformAdmin?: boolean; role?: string; restricted?: boolean } | null;
    access?: { aiSeller?: { access?: string } | null } | null;
  } | null,
): NavigationAccess {
  if (!me?.user) return CLOSED_ACCESS;
  const seller = me.access?.aiSeller?.access;
  return {
    aiSeller: seller === 'active' || seller === 'expired',
    platform: me.user.platformAdmin === true,
    role: (me.user.role && parseMembershipRole(me.user.role)) || 'STAFF',
    ...(me.user.restricted === true ? { restricted: true as const } : {}),
  };
}

/**
 * Какой пункт меню подсвечен на этом адресе: вкладки модулей не пункты меню, активен их корень
 * («Настройки объекта» ADR-115, «Номерной фонд» ADR-108, «Каналы продаж» ADR-112, «Сайт и SEO» MKT2)
 */
export function activeMenuRoute(path: string): string | undefined {
  const route = activeNavigation(path)?.href;
  if (!route) return undefined;
  if (route.startsWith('/hotel-settings')) return '/hotel-settings';
  if (route.startsWith('/rooms')) return '/inventory';
  if (route.startsWith('/channels')) return '/channels';
  // «Гости и бронирования» (09.10.2026): брони и карточка брони подсвечивают тот же единственный пункт
  if (route === '/reservations') return '/guests';
  // сайт объекта, продукт «Маркетинга»: в меню один пункт «Сайт и SEO» (MKT2)
  if (route === '/website') return '/marketing';
  return route;
}

/**
 * Раздел меню, в котором находится адрес: сначала по пункту (`activeMenuRoute`), иначе по самому длинному
 * совпадению `match`. Один ответ для кнопки раздела в шапке, меню телефона и нижней панели (ТЗ мастер-прохода §3)
 */
export function activeSectionOf(sections: MenuSection[], path: string): MenuSection | undefined {
  const route = activeMenuRoute(path);
  const byItem = route && sections.find((s) => s.items.some((i) => i.href === route));
  if (byItem) return byItem;
  const within = (href: string) => path === href || path.startsWith(`${href}/`);
  let best: { section: MenuSection; length: number } | undefined;
  for (const section of sections)
    for (const href of section.match ?? [])
      if (within(href) && href.length > (best?.length ?? -1)) best = { section, length: href.length };
  return best?.section;
}

/** Страницы вне разделов меню (профиль, помощь, филиалы): кнопка в шапке называет страницу */
const PAGE_LABELS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/profile', label: 'Профиль', icon: 'person' },
  { href: '/help', label: 'Помощь', icon: 'help' },
  { href: '/branches', label: 'Филиалы', icon: 'hotel' },
  { href: '/onboarding', label: 'Настройка объекта', icon: 'settings' },
  { href: '/platform/support', label: 'Техподдержка', icon: 'chat' },
  { href: '/journal', label: 'Журнал операций', icon: 'journal' },
];

/** Что написать на кнопке раздела: раздел меню, иначе название страницы, иначе «Разделы» */
export function currentPlace(
  sections: MenuSection[],
  path: string,
): { label: string; icon: IconName; section?: MenuSection } {
  const section = activeSectionOf(sections, path);
  if (section) return { label: section.label, icon: section.icon, section };
  const page = PAGE_LABELS.find((p) => path === p.href || path.startsWith(`${p.href}/`));
  return page ? { label: page.label, icon: page.icon } : { label: 'Разделы', icon: 'menu' };
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
