import { getJsonPublic } from './api';

export interface HotelSettings {
  property: {
    id: string;
    name: string;
    legalName: string | null;
    address: string | null;
    timezone: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
  ratePlans: Array<{
    code: string;
    name: string;
    currency: string;
    active: boolean;
    cancellationPenalty: string;
  }>;
}
export interface ChannelReport {
  from: string;
  to: string;
  status: string;
  dateBasis: 'ARRIVAL';
  rows: Array<{
    source: string;
    channel: string | null;
    currency: string;
    count: number;
    cancelled: number;
    noShow: number;
    amountMinor: string;
  }>;
}
/** Контент объекта из Channex (ADR-033): только чтение, без ключей и id провайдера */
export interface HotelContent {
  checkedAt: string;
  source: 'channex';
  environment: 'staging' | 'production' | 'custom';
  state: 'READY' | 'NO_KEY' | 'NO_MAPPING' | 'DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNREACHABLE';
  message: string;
  property: {
    title: string | null;
    description: string | null;
    importantInformation: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  policy: {
    checkInTime: string | null;
    checkOutTime: string | null;
    maxGuests: number | null;
    pets: string | null;
    smoking: string | null;
    internet: string | null;
    parking: string | null;
  } | null;
  facilities: Array<{ title: string; category: string | null }>;
  photos: Array<{ url: string; description: string | null; forRoomType: boolean }>;
}
export const hotelApi = {
  settings: () => getJsonPublic<HotelSettings>('/hotel/settings'),
  /** refresh — прочитать из Channex заново, минуя кэш API на 10 минут */
  content: (refresh = false) =>
    getJsonPublic<HotelContent>(`/channels/channex/content${refresh ? '?refresh=1' : ''}`),
  channelReport: (from: string, to: string, status: string) =>
    getJsonPublic<ChannelReport>(
      `/hotel/channel-report?${new URLSearchParams({ from, to, status })}`,
    ),
};

/** Property-local calendar date; never browser timezone. */
export const hotelToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const nextDay = (date: string) =>
  new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
export const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
export const reservationStatuses: Record<string, string> = {
  ALL: 'Все статусы',
  TENTATIVE: 'Предварительные',
  CONFIRMED: 'Подтверждены',
  CHECKED_IN: 'Проживают',
  CHECKED_OUT: 'Завершены',
  CANCELLED: 'Отменены',
  NO_SHOW: 'Незаезды',
};
export const sourceNames: Record<string, string> = {
  OTA: 'Канал продаж',
  DESK: 'Стойка',
  PHONE: 'Телефон',
  WHATSAPP: 'WhatsApp',
  WALK_IN: 'Без предварительной брони',
  INSTAGRAM: 'Instagram',
  WEBSITE: 'Сайт',
};
