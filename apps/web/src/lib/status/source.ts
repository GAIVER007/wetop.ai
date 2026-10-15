import type { ReservationSource } from '@pms/domain';
import type { StatusRegistry } from './types';

/**
 * Источник брони гостиницы (`ReservationSource`). Подписи собраны из отбора и списка броней, где их
 * видели чаще всего; бренды и каналы не переименованы (решение владельца №3). `short` для плашки
 * шахматки. Имя канала продаж (Booking.com и др.) приходит с бронью и в реестр не входит.
 */
export const sourceStatus: StatusRegistry<ReservationSource> = {
  OTA: { label: 'Канал продаж', short: 'OTA', tone: 'neutral' },
  DESK: { label: 'Стойка', short: 'Стойка', tone: 'neutral' },
  PHONE: { label: 'Телефон', short: 'Тел.', tone: 'neutral' },
  WHATSAPP: { label: 'WhatsApp', short: 'WA', tone: 'neutral', proper: true },
  WALK_IN: { label: 'Без предварительной брони', short: 'Без брони', tone: 'neutral' },
  INSTAGRAM: { label: 'Instagram', short: 'IG', tone: 'neutral', proper: true },
  WEBSITE: { label: 'Сайт', short: 'Сайт', tone: 'neutral' },
};
