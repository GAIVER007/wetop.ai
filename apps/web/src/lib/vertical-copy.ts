import type { WebVertical } from './vertical-landing';

/**
 * Слова раздела под направление бизнеса (единая система, решение владельца 14.10.2026): экраны общие, меняются
 * только термины. Гостиница: гости и брони; салон: клиенты и записи; ресторан: гости и брони столов, заказы.
 */
export interface VerticalCopy {
  /** «гостиница» / «салон» / «ресторан» */
  business: string;
  /** родительный падеж: «сайт гостиницы» */
  businessOf: string;
  /** кого привлекаем, мн. ч.: «гостей» / «клиентов» */
  clientsAcc: string;
  /** именительный мн. ч.: «Гости» / «Клиенты» */
  clients: string;
  /** родительный мн. ч. для «из отзывов …» */
  clientsOf: string;
  /** онлайн-действие клиента: «Онлайн-бронирование» / «Онлайн-запись» */
  onlineAction: string;
  /** заявка: «Заявки на бронирование» / «Заявки на запись» */
  requests: string;
  /** во что конвертируем: «в бронь» / «в запись» / «в заказ» */
  conversionTo: string;
  /** главный объект для фото контента */
  photoSubject: string;
  /** иконка фото-формата */
  photoIcon: 'bed' | 'beauty' | 'kitchen';
  /** родительный мн. ч.: «для гостиниц» / «для салонов» / «для ресторанов» */
  businessesOf: string;
  /** главная кнопка сайта (SITE-1): «Забронировать» / «Записаться» / «Забронировать стол» */
  bookAction: string;
  /** что продаёт филиал, для карточки фактов: «Номера и цены» / «Услуги и цены» / «Меню и цены» */
  catalogTitle: string;
  /** подсказки-чипы чата первого экрана «Сайт и SEO» (plans/site-seo-flow-2026-10-15.md §1 шаг 2) */
  siteChips: readonly string[];
  /** подсказки-чипы правки готового сайта в простом редакторе (SITE-1): частые просьбы владельца */
  siteEditChips: readonly string[];
}

const COPY: Record<WebVertical, VerticalCopy> = {
  HOSPITALITY: {
    business: 'гостиница',
    businessOf: 'гостиницы',
    clientsAcc: 'гостей',
    clients: 'Гости',
    clientsOf: 'гостей',
    onlineAction: 'Онлайн-бронирование',
    requests: 'Заявки на бронирование',
    conversionTo: 'в бронь',
    photoSubject: 'номера',
    photoIcon: 'bed',
    businessesOf: 'гостиниц',
    bookAction: 'Забронировать',
    catalogTitle: 'Номера и цены',
    siteChips: ['Сайт с онлайн-бронированием', 'Акцент на семейном отдыхе', 'Покажи трансфер'],
    siteEditChips: ['Сделай тексты короче и проще', 'Сделай первый экран ярче', 'Подчеркни удобное расположение', 'Добавь блок «Почему мы»'],
  },
  BEAUTY: {
    business: 'салон',
    businessOf: 'салона',
    clientsAcc: 'клиентов',
    clients: 'Клиенты',
    clientsOf: 'клиентов',
    onlineAction: 'Онлайн-запись',
    requests: 'Заявки на запись',
    conversionTo: 'в запись',
    photoSubject: 'работы мастера',
    photoIcon: 'beauty',
    businessesOf: 'салонов',
    bookAction: 'Записаться',
    catalogTitle: 'Услуги и цены',
    siteChips: ['Сайт для записи на услуги', 'Акцент на мастерах', 'Акция на первое посещение'],
    siteEditChips: ['Сделай тексты короче и проще', 'Сделай первый экран ярче', 'Подчеркни опыт мастеров', 'Добавь акцию на первое посещение'],
  },
  FOOD_SERVICE: {
    business: 'ресторан',
    businessOf: 'ресторана',
    clientsAcc: 'гостей',
    clients: 'Гости',
    clientsOf: 'гостей',
    onlineAction: 'Онлайн-бронь столов',
    requests: 'Заявки на бронь стола',
    conversionTo: 'в заказ',
    photoSubject: 'блюда',
    photoIcon: 'kitchen',
    businessesOf: 'ресторанов',
    bookAction: 'Забронировать стол',
    catalogTitle: 'Меню и цены',
    siteChips: ['Сайт с меню и бронью столов', 'Акцент на банкетах', 'Покажи бизнес-ланч'],
    siteEditChips: ['Сделай тексты короче и проще', 'Сделай первый экран аппетитнее', 'Расскажи про банкеты', 'Выдели бизнес-ланч'],
  },
};

export function verticalCopy(vertical: WebVertical | string | null | undefined): VerticalCopy {
  return COPY[(vertical as WebVertical) in COPY ? (vertical as WebVertical) : 'HOSPITALITY'];
}
