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
  },
};

export function verticalCopy(vertical: WebVertical | string | null | undefined): VerticalCopy {
  return COPY[(vertical as WebVertical) in COPY ? (vertical as WebVertical) : 'HOSPITALITY'];
}
