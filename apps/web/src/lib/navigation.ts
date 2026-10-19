import type { WebVertical } from './vertical-landing';
import { featureVerticals } from './features';
import {
  ORGANIZATION_LEVEL_PERMISSIONS,
  can,
  parseBeautyPermissions,
  parseMembershipRole,
  rolesWith,
  type BeautyAction,
  type BeautyPositionAccess,
  type BeautySection,
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
  /** Exact Beauty position grants for the selected salon. Missing means legacy/non-Beauty access. */
  beautyAccess?: BeautyPositionAccess;
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
      { href: '/my-work', label: 'Моя работа', icon: 'person', requires: 'desk', description: 'Личный профиль, собственный график и оплата труда.' },
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
      { href: '/drinks', label: 'Напитки', icon: 'breakfast', requires: 'desk', description: 'Напитки: заказы бара и витрина' },
      { href: '/restaurant-finance', label: 'Финансы', icon: 'money', requires: 'reports', description: 'Выручка, расходы и поступления ресторана' },
      { href: '/beauty-settings', label: 'Настройки салона', icon: 'settings', requires: 'desk', description: 'Режим работы выбранного салона.' },
      { href: '/restaurant-settings', label: 'Настройки', icon: 'settings', requires: 'property', description: 'Часы работы, бронирования и разделы ресторана' },

      {
        href: '/calendar',
        label: 'Журнал',
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
        label: 'Специалисты',
        icon: 'guests',
        requires: 'desk',
        description: 'Мастера филиала: что умеют и где работают.',
      },
      {
        // смены сотрудников ресторана: пункт «График работы» раздела «Персонал» (верхнее меню 17.10.2026)
        href: '/employees/shifts',
        label: 'График работы',
        icon: 'clock',
        requires: 'desk',
        description: 'Смены сотрудников на неделю.',
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
        // заголовок как пункт меню «Персонал → Сотрудники» (решение владельца 19.10.2026)
        label: 'Сотрудники',
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
        label: 'График работы',
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
        href: '/bar/consumables',
        requires: 'reports',
        label: 'Расходники',
        icon: 'stock',
        description: 'Материалы услуг, приходы, списания и остатки салона.',
      },
      // подстраницы бара пунктами раздела «Склад» (верхнее меню 17.10.2026); право то же, что у `/bar`
      {
        href: '/bar/products',
        requires: 'reports',
        label: 'Номенклатура',
        icon: 'product',
        description: 'Товары склада: цены, остатки и наценка.',
      },
      {
        href: '/bar/operations',
        requires: 'reports',
        label: 'Движение товаров',
        icon: 'move',
        description: 'Приходы, продажи и списания товаров.',
      },
      {
        href: '/bar/receipts',
        requires: 'reports',
        label: 'Приходы',
        icon: 'receipt',
        description: 'Приходы от поставщиков: документы, суммы и долги.',
      },
      {
        href: '/bar/suppliers',
        requires: 'reports',
        label: 'Поставщики',
        icon: 'truck',
        description: 'Поставщики и долги перед ними.',
      },
      {
        href: '/reports/finance',
        requires: 'reports',
        label: 'Финансовый отчёт',
        icon: 'money',
        description: 'Доходы и поступления за период.',
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
        label: 'Сотрудники',
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
        label: 'История действий',
        icon: 'journal',
        description: 'Кто, что и когда изменил в системе.',
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

/**
 * Верхнее меню: одна таблица разделов и пунктов для всех направлений (решения владельца 17.10.2026, ADR-TOPNAV-20261017
 * и уточнение «у всех одинаково»). Разделы, пункты, их подписи и порядок одни; у пункта свой экран в каждом
 * направлении (`at`). Нет экрана у направления, пункта у него нет. Раздел из одного пункта (Главная, Журнал, Помощь)
 * это прямая ссылка, остальные открывают список у всех направлений. Адреса и права страниц прежние: их держит реестр выше.
 */
type Screens = Partial<Record<WebVertical, string>>;
const ALL = (href: string): Screens => ({ HOSPITALITY: href, BEAUTY: href, FOOD_SERVICE: href });
const ROW: Array<{
  id: string;
  label: string;
  icon: IconName;
  items: Array<{ label: string; at: Screens }>;
  match?: string[];
}> = [
  { id: 'today', label: 'Главная', icon: 'today', items: [{ label: 'Главная', at: ALL('/today') }] },
  {
    id: 'journal',
    label: 'Журнал',
    icon: 'board',
    // `/beauty` прежний адрес журнала салона; задачи смены открываются из шахматки (ADR-145)
    items: [{ label: 'Журнал', at: { HOSPITALITY: '/chessboard', BEAUTY: '/calendar', FOOD_SERVICE: '/floor-plan' } }],
    match: ['/beauty', '/tasks'],
  },
  {
    id: 'staff',
    label: 'Персонал',
    icon: 'person',
    items: [
      { label: 'Специалисты', at: { BEAUTY: '/employees', FOOD_SERVICE: '/employees' } },
      { label: 'Сотрудники', at: ALL('/team') },
      { label: 'График работы', at: { BEAUTY: '/beauty/schedule', FOOD_SERVICE: '/employees/shifts' } },
      { label: 'Зарплата', at: { BEAUTY: '/payroll', FOOD_SERVICE: '/payroll' } },
    ],
    match: ['/staff', '/beauty/masters'],
  },
  {
    id: 'clients',
    label: 'Клиенты',
    icon: 'guests',
    items: [
      { label: 'Клиенты', at: { HOSPITALITY: '/guests', BEAUTY: '/customers', FOOD_SERVICE: '/customers' } },
      {
        label: 'Записи',
        at: { HOSPITALITY: '/reservations', BEAUTY: '/appointments', FOOD_SERVICE: '/table-reservations' },
      },
    ],
  },
  {
    id: 'services',
    label: 'Услуги',
    icon: 'layers',
    items: [
      { label: 'Каталог', at: { HOSPITALITY: '/inventory', BEAUTY: '/services', FOOD_SERVICE: '/menu' } },
      { label: 'Заказы', at: { FOOD_SERVICE: '/orders' } },
      { label: 'Кухня', at: { FOOD_SERVICE: '/kitchen' } },
      { label: 'Напитки', at: { FOOD_SERVICE: '/drinks' } },
      { label: 'Залы и столы', at: { FOOD_SERVICE: '/dining-areas' } },
    ],
    match: ['/beauty/services', '/units', '/rooms', '/rates'],
  },
  {
    id: 'stats',
    label: 'Статистика',
    icon: 'chart',
    items: [
      { label: 'Аналитика бизнеса', at: ALL('/management/analytics') },
      // Отчёты салона теперь отдельный рабочий экран, не редирект в аналитику.
      { label: 'Все отчёты', at: { HOSPITALITY: '/reports', BEAUTY: '/reports' } },
    ],
    match: ['/management', '/reports'],
  },
  {
    id: 'stock',
    label: 'Склад',
    icon: 'stock',
    items: [
      // пункты в порядке вкладок экрана склада (решение владельца 19.10.2026): одно название в меню и на вкладке
      { label: 'Склад кухни', at: { FOOD_SERVICE: '/stock' } },
      { label: 'Обзор склада', at: ALL('/bar') },
      { label: 'Расходники', at: { BEAUTY: '/bar/consumables' } },
      { label: 'Приходы', at: ALL('/bar/receipts') },
      { label: 'Номенклатура', at: ALL('/bar/products') },
      { label: 'Поставщики', at: ALL('/bar/suppliers') },
      { label: 'Движение товаров', at: ALL('/bar/operations') },
    ],
  },
  {
    id: 'money',
    label: 'Финансы',
    icon: 'money',
    items: [
      // пункты называются по экранам (решение владельца 19.10.2026): касса филиала (§35.2, §48) у салона и
      // ресторана; «Финансы» каждого направления; у гостиницы касса внутри её «Финансов»
      { label: 'Касса', at: { BEAUTY: '/cashbox', FOOD_SERVICE: '/cashbox' } },
      { label: 'Обзор финансов', at: { HOSPITALITY: '/finance', BEAUTY: '/finance', FOOD_SERVICE: '/restaurant-finance' } },
      { label: 'Отчеты', at: { HOSPITALITY: '/reports/finance' } },
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: 'settings',
    items: [
      { label: 'Объект', at: { HOSPITALITY: '/hotel-settings', BEAUTY: '/beauty-settings', FOOD_SERVICE: '/restaurant-settings' } },
      { label: 'Каналы продаж', at: { HOSPITALITY: '/channels' } },
      { label: 'Подключения', at: { HOSPITALITY: '/connections' } },
      // право `desk`: администратор видит неисправности (ADR-107)
      { label: 'Неисправности', at: { HOSPITALITY: '/incidents' } },
      { label: 'История действий', at: ALL('/journal') },
      // «Организации» только главному администратору (отметка `platform`)
      { label: 'Организации', at: ALL('/platform') },
    ],
    match: ['/branches', '/beauty-settings', '/hotel-settings', '/connections', '/channel-manager', '/platform'],
  },
  {
    // «Продвижение» (ADR-184): бывшие «Маркетинг» и «Продажи»
    id: 'marketing',
    label: 'Продвижение',
    icon: 'send',
    items: [
      { label: 'Обзор', at: ALL('/marketing') },
      { label: 'ИИ-таргетолог', at: ALL('/marketing/ads') },
      { label: 'Контент', at: ALL('/marketing/content') },
      { label: 'ИИ-продавец', at: ALL('/ai-agents') },
      // мониторинг загрузки соседей пока только у гостиницы (ADR-142)
      { label: 'Анализ конкурентов', at: { HOSPITALITY: '/market' } },
      { label: 'Обзор продаж', at: ALL('/sales') },
      { label: 'Бюджет', at: ALL('/marketing/budget') },
      { label: 'Аналитика рекламы', at: ALL('/marketing/analytics') },
    ],
    match: ['/website', '/ai-seller'],
  },
  { id: 'help', label: 'Помощь', icon: 'help', items: [{ label: 'Помощь', at: ALL('/help') }] },
];

/** Меню направления из общей таблицы: свои экраны, те же подписи и тот же вид раздела */
function rowFor(vertical: WebVertical): MenuSection[] {
  return ROW.flatMap(({ items, ...section }) => {
    const own = items.flatMap((item) => (item.at[vertical] ? [{ href: item.at[vertical]!, label: item.label }] : []));
    // вид раздела общий у всех направлений: Главная, Журнал и Помощь прямые ссылки, остальные открывают список
    if (items.length === 1 && own.length)
      return [{ ...section, direct: true, items: [menuItem(own[0]!.href, section.label)] }];
    return own.length ? [{ ...section, items: own.map((item) => menuItem(item.href, item.label)) }] : [];
  });
}

export const menuSections: MenuSection[] = rowFor('HOSPITALITY');
/** Verified Business.vertical selects the working Beauty routes (MV5). */
export const beautyMenuSections: MenuSection[] = rowFor('BEAUTY');
export const foodMenuSections: MenuSection[] = rowFor('FOOD_SERVICE');

/** Разделы нижней панели телефона: Главная, Журнал, Клиенты и Услуги своего направления (ADR-050) */
const PHONE_SECTIONS = ['today', 'journal', 'clients', 'services'];

function phoneTabs(sections: MenuSection[]): NavigationItem[] {
  return PHONE_SECTIONS.flatMap((id) => {
    const section = sections.find((s) => s.id === id);
    if (!section) return [];
    // вкладка панели ведёт на первый пункт раздела под именем раздела
    return [{ ...section.items[0]!, label: section.label }];
  });
}

/** Нижняя панель телефона гостиницы: четыре вкладки и кнопка «Ещё» (ADR-050, ADR-134) */
export const phoneNavigation: NavigationItem[] = phoneTabs(menuSections);

/** То же для салона и ресторана (Q-254). Не передана вертикаль, значит гостиница */
export function phoneNavigationFor(vertical: WebVertical = 'HOSPITALITY'): NavigationItem[] {
  if (vertical === 'FOOD_SERVICE') return phoneTabs(foodMenuSections);
  if (vertical === 'BEAUTY') return phoneTabs(beautyMenuSections);
  return phoneNavigation;
}

/** Есть ли у вошедшего право. Никто не вошёл — открыто: так же поступает API (ADR-107) */
export function mayAccess(access: NavigationAccess, permission: Permission): boolean {
  if (access.restricted && ORGANIZATION_LEVEL_PERMISSIONS.includes(permission)) return false;
  return access.role === null || can(access.role, permission);
}

/** Exact Beauty permission. Legacy roles remain the fallback only until a position has been assigned. */
export function mayBeautyAccess(
  access: NavigationAccess,
  section: BeautySection,
  action: BeautyAction,
  options: { legacy: Permission; own?: boolean },
): boolean {
  if (access.role === 'OWNER') return true;
  const projection = access.beautyAccess;
  if (!projection || projection.mode === 'LEGACY') return mayAccess(access, options.legacy);
  if (!projection.assigned) return false;
  const grant = projection.permissions.find(
    (permission) => permission.section === section && permission.action === action,
  );
  return grant?.scope === 'BUSINESS' || (options.own === true && grant?.scope === 'OWN');
}

interface BeautyRouteAccess {
  section: BeautySection;
  legacy: Permission;
}

const BEAUTY_ROUTES: Array<{ href: string; access: BeautyRouteAccess }> = [
  { href: '/beauty-settings', access: { section: 'settings', legacy: 'desk' } },
  { href: '/beauty/schedule', access: { section: 'journal', legacy: 'desk' } },
  { href: '/beauty/masters', access: { section: 'employees', legacy: 'desk' } },
  { href: '/beauty/services', access: { section: 'services', legacy: 'desk' } },
  { href: '/appointments', access: { section: 'appointments', legacy: 'desk' } },
  { href: '/customers', access: { section: 'customers', legacy: 'desk' } },
  { href: '/employees', access: { section: 'employees', legacy: 'desk' } },
  { href: '/services', access: { section: 'services', legacy: 'desk' } },
  { href: '/calendar', access: { section: 'journal', legacy: 'desk' } },
  { href: '/payroll', access: { section: 'payroll', legacy: 'staff' } },
  { href: '/cashbox', access: { section: 'finance', legacy: 'desk' } },
  { href: '/finance', access: { section: 'finance', legacy: 'reports' } },
  { href: '/journal', access: { section: 'settings', legacy: 'journal' } },
  { href: '/bar', access: { section: 'stock', legacy: 'reports' } },
  { href: '/beauty', access: { section: 'journal', legacy: 'desk' } },
  { href: '/today', access: { section: 'journal', legacy: 'desk' } },
];

const within = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

function beautyRouteAccess(path: string): BeautyRouteAccess | undefined {
  return BEAUTY_ROUTES.filter((route) => within(path, route.href)).sort(
    (left, right) => right.href.length - left.href.length,
  )[0]?.access;
}

function personalBeautyWork(access: NavigationAccess): boolean {
  if (access.role === 'OWNER') return true;
  const projection = access.beautyAccess;
  if (!projection || projection.mode === 'LEGACY') return mayAccess(access, 'desk');
  if (!projection.assigned) return false;
  return projection.permissions.some(
    (permission) =>
      permission.action === 'view' &&
      ['journal', 'appointments', 'payroll', 'reviews'].includes(permission.section),
  );
}

/** Whether a path needs the selected salon's exact position projection in addition to its legacy route rule. */
export function carriesBeautyAccess(path: string): boolean {
  return (
    path === '/my-work' ||
    path.startsWith('/my-work/') ||
    path === '/team' ||
    path.startsWith('/team/') ||
    beautyRouteAccess(path) !== undefined
  );
}

/**
 * Открыть ли страницу, пришедшую по адресу (ADR-107): право есть — да; роль не узнали — тоже да: данных без права API
 * всё равно не отдаст, а при недоступном API страница сама скажет, что связи нет, — вместо «Нет доступа… ваша роль —
 * администратор», неправды для владельца. Кнопки возврата и сторно этим не открываются: они смотрят `mayAccess`.
 */
export function pageOpen(access: NavigationAccess, permission: Permission, path?: string): boolean {
  if (!path || !access.beautyAccess) return mayAccess(access, permission) || access.unknown === true;
  if (access.role === 'OWNER') return true;
  if (path === '/my-work' || path.startsWith('/my-work/')) return personalBeautyWork(access);
  if (path === '/team' || path.startsWith('/team/'))
    return mayAccess(access, 'staff') && mayBeautyAccess(access, 'employees', 'view', { legacy: 'staff' });
  const route = beautyRouteAccess(path);
  if (!route) return access.beautyAccess.mode === 'LEGACY' && (mayAccess(access, permission) || access.unknown === true);
  return mayBeautyAccess(access, route.section, 'view', { legacy: route.legacy });
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
  { href: '/whats-new', label: 'Что нового', requires: 'desk' },
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
      // реестр функций (У1): пункт чужого направления в меню не попадает, даже если его поставили в состав по ошибке
      items: section.items.filter((item) => {
        if (!featureVerticals(item.href).includes(vertical)) return false;
        if (vertical !== 'BEAUTY' || !access.beautyAccess) return allowedItem(item, access);
        if (!item.requires || item.requires === 'platform') return allowedItem(item, access);
        return pageOpen(access, item.requires, item.href);
      }),
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
    beautyAccess?: unknown;
  } | null,
): NavigationAccess {
  if (!me?.user) return CLOSED_ACCESS;
  const seller = me.access?.aiSeller?.access;
  const beautyAccess = normalizeBeautyAccess(me.beautyAccess);
  return {
    aiSeller: seller === 'active' || seller === 'expired',
    platform: me.user.platformAdmin === true,
    role: (me.user.role && parseMembershipRole(me.user.role)) || 'STAFF',
    ...(me.user.restricted === true ? { restricted: true as const } : {}),
    ...(beautyAccess ? { beautyAccess } : {}),
  };
}

function normalizeBeautyAccess(raw: unknown): BeautyPositionAccess | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  if (value.mode === 'LEGACY') return { mode: 'LEGACY', assigned: false, permissions: [] };
  if (value.mode !== 'ASSIGNED') return undefined;
  const parsed = parseBeautyPermissions(value.permissions);
  if (!parsed.ok || typeof value.assigned !== 'boolean')
    return { mode: 'ASSIGNED', assigned: false, permissions: [] };
  return { mode: 'ASSIGNED', assigned: value.assigned, permissions: parsed.value };
}

/**
 * Какой пункт меню подсвечен на этом адресе: вкладки модулей не пункты меню, активен их корень
 * («Настройки объекта» ADR-115, «Номерной фонд» ADR-108, «Каналы продаж» ADR-112, «Сайт и SEO» MKT2)
 */
export function activeMenuRoute(path: string): string | undefined {
  const route = activeNavigation(path)?.href;
  if (!route) return undefined;
  // новый приход подсвечивает пункт «Приходы» (у пункта свой адрес с 19.10.2026)
  if (path.startsWith('/bar/receipts/')) return '/bar/receipts';
  if (route.startsWith('/hotel-settings')) return '/hotel-settings';
  if (route.startsWith('/rooms')) return '/inventory';
  if (route.startsWith('/channels')) return '/channels';
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
  { href: '/whats-new', label: 'Что нового', icon: 'star' },
  { href: '/branches', label: 'Филиалы', icon: 'hotel' },
  { href: '/onboarding', label: 'Настройка объекта', icon: 'settings' },
  { href: '/platform/support', label: 'Техподдержка', icon: 'chat' },
  { href: '/journal', label: 'История действий', icon: 'journal' },
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
