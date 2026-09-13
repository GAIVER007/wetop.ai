import type { IconName } from '../components/icon';

export interface NavigationItem {
  href: string;
  label: string;
  icon: IconName;
  description: string;
  pending?: boolean;
  children?: NavigationItem[];
}
export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: 'Рабочее место',
    items: [
      {
        href: '/today',
        label: 'Сегодня',
        icon: 'today',
        description: 'Заезды, выезды и задачи смены.',
      },
      {
        href: '/chessboard',
        label: 'Шахматка',
        icon: 'board',
        description: 'Размещение по номерам, койкам и датам.',
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
          {
            href: '/rooms/promotions',
            label: 'Акции',
            icon: 'rates',
            description: 'Специальные предложения и скидки.',
            pending: true,
          },
        ],
      },
      {
        href: '/hotel-settings',
        label: 'Настройка гостиницы',
        icon: 'settings',
        description: 'Правила проживания, услуги и информация об объекте.',
        children: [
          {
            href: '/hotel-settings/check-in',
            label: 'Заезд и выезд',
            icon: 'clock',
            description: 'Расчётный час и часовой пояс объекта.',
          },
          {
            href: '/hotel-settings/penalties',
            label: 'Штрафы',
            icon: 'journal',
            description: 'Политика отмены для каждого тарифного плана.',
          },
          {
            href: '/hotel-settings/services',
            label: 'Услуги',
            icon: 'plus',
            description: 'Каталог дополнительных услуг и цены.',
          },
          {
            href: '/hotel-settings/description',
            label: 'Описание',
            icon: 'inventory',
            description: 'Название, адрес и сведения о гостинице.',
          },
          {
            href: '/hotel-settings/photos',
            label: 'Фото',
            icon: 'inventory',
            description: 'Фотографии объекта и категорий.',
            pending: true,
          },
          {
            href: '/hotel-settings/amenities',
            label: 'Удобства',
            icon: 'check',
            description: 'Оснащение номеров и общих зон.',
            pending: true,
          },
        ],
      },
      {
        href: '/management',
        label: 'Управление отелем',
        icon: 'inventory',
        description: 'Показатели объекта и операционная отчётность.',
        children: [
          {
            href: '/management/statistics',
            label: 'Статистика',
            icon: 'analytics',
            description: 'Занятые, свободные и заблокированные места по категориям.',
          },
          {
            href: '/management/reports',
            label: 'Отчёты',
            icon: 'journal',
            description: 'Финансы, продажи по каналам и журнал действий.',
          },
          {
            href: '/management/analytics',
            label: 'Аналитика отеля',
            icon: 'analytics',
            description: 'Загрузка, продажи и привлечение гостей.',
          },
        ],
      },
      {
        href: '/finance',
        label: 'Финансовый учёт',
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
        href: '/analytics',
        label: 'Аналитика',
        icon: 'analytics',
        description: 'Посещаемость сайта, источники трафика и бронирования.',
      },
      {
        href: '/marketing',
        label: 'Маркетинг',
        icon: 'rates',
        description: 'Сайты, модуль бронирования и источники привлечения.',
      },
    ],
  },
  {
    label: 'Система',
    items: [
      {
        href: '/connections',
        label: 'Подключения API',
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
    ],
  },
];
export const navigationItems = navigation.flatMap((group) =>
  group.items.flatMap((item) => [item, ...(item.children ?? [])]),
);
export function activeNavigation(path: string) {
  return navigationItems
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
