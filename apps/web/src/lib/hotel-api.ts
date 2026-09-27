import { ApiError, getJsonPublic } from './api';
import { FALLBACK_TIMEZONE, propertyClock, type PropertyClock } from './property-time';
import type { DataConnection } from '@pms/shared';
import { cache } from 'react';

export interface HotelSettings {
  property: {
    id: string;
    name: string;
    legalName: string | null;
    /** ИИН/БИН объекта для печатных форм; старый API поля не шлёт */
    bin?: string | null;
    address: string | null;
    /** Контакты объекта для печатных форм (v1.7, ADR-082); старый API полей не шлёт */
    phone?: string | null;
    email?: string | null;
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
  /** У объекта ещё нет номеров — нужен онбординг (гейт уводит на /onboarding). Старый API его не шлёт. */
  needsOnboarding?: boolean;
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
  state:
    'READY' | 'NO_KEY' | 'NO_MAPPING' | 'DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNREACHABLE';
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
  connection: () => getJsonPublic<DataConnection>('/system/connection'),
  // Shared only within one server render. New requests always read the current backend.
  settings: cache(() => getJsonPublic<HotelSettings>('/hotel/settings')),
  /** Есть ли в объекте хоть одна бронь — для «Первых шагов» на Главной (ТЗ ux-retention п. 2.1) */
  firstSteps: () => getJsonPublic<{ hasReservations: boolean }>('/hotel/first-steps'),
  /** refresh — прочитать из Channex заново, минуя кэш API на 10 минут */
  content: (refresh = false) =>
    getJsonPublic<HotelContent>(`/channels/channex/content${refresh ? '?refresh=1' : ''}`),
  channelReport: (from: string, to: string, status: string) =>
    getJsonPublic<ChannelReport>(
      `/hotel/channel-report?${new URLSearchParams({ from, to, status })}`,
    ),
};

/**
 * Сколько страница ждёт настройки объекта ради пояса. Экраны намеренно не ждут настроек гостиницы (поручение
 * владельца 16.09: «выбираю период и нифига не открывает»): API отдаёт их из своего кэша за миллисекунды,
 * а задержались — стойка считает по поясу платформы, как до С-13, и не висит.
 */
export const TIMEZONE_WAIT_MS = 1000;

/**
 * Пояс объекта для этого рендера (С-13, ТЗ аудита 25.09.2026): из `/hotel/settings` — тот же запрос, что
 * макет делает на каждой странице, `cache` не даёт ему повториться. API не ответил или не успел за
 * `TIMEZONE_WAIT_MS` — пояс платформы: экран не падает и не ждёт из-за часов.
 */
export const propertyTimezone = cache(async (): Promise<string> => {
  const fromSettings = hotelApi.settings().then(
    (hotel) => hotel.property.timezone || FALLBACK_TIMEZONE,
    (error: unknown) => {
      if (error instanceof ApiError) return FALLBACK_TIMEZONE;
      throw error;
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(FALLBACK_TIMEZONE), TIMEZONE_WAIT_MS);
  });
  try {
    return await Promise.race([fromSettings, late]);
  } finally {
    clearTimeout(timer);
  }
});
/** Часы объекта для серверной страницы: «сегодня», месяц, моменты событий (`lib/property-time.ts`) */
export const hotelClock = async (): Promise<PropertyClock> =>
  propertyClock(await propertyTimezone());
/** Сегодня по часам объекта: не пояс браузера и не сдвиг на UTC+5 */
export const hotelToday = async (): Promise<string> => (await hotelClock()).today();
export const nextDay = (date: string) =>
  new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
/** Дата через n дней (n может быть отрицательным), YYYY-MM-DD */
export const plusDays = (date: string, n: number) =>
  new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
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
/** Слово о брони в единственном числе для строки списка (DESIGN.md §9, Q-135; ADR-104) —
 * как у списка гостей: «Проживают» — имя фильтра, «проживает» — состояние одной брони */
export const reservationStatusWords: Record<string, string> = {
  TENTATIVE: 'не подтверждена',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'проживает',
  CHECKED_OUT: 'завершена',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
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

/** Read-only list projection, backed by existing reservations/folios. */
export interface ReservationListRow {
  confirmationNumber: string;
  status: string;
  source: string;
  channel: string | null;
  arrivalDate: string;
  departureDate: string;
  currency: string;
  totalAmountMinor: string;
  paidMinor: string;
  balanceMinor: string;
  /** Начислено и возвращено по счетам (ADR-104, колонка «Финансы»). Старый API их не присылает. */
  chargedMinor?: string;
  refundedMinor?: string;
  hasFolios: boolean;
  unitCodes: string[];
  /** Сколько проживаний в брони — групповая бронь показывается как «N размещений». */
  itemsCount?: number;
  primaryGuest: { id: string; label: string; phone: string | null; email: string | null } | null;
}
export interface ReservationDirectoryResult {
  from: string;
  to: string;
  total: number;
  page: number;
  pageSize: number;
  /** Сколько броней в периоде по каждому статусу; ALL — все. Старый API его не присылает. */
  counts?: Record<string, number>;
  rows: ReservationListRow[];
}
export const reservationDirectory = (query: Record<string, string>) =>
  getJsonPublic<ReservationDirectoryResult>(`/hotel/reservations?${new URLSearchParams(query)}`);
