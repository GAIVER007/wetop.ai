import type { ReservationSource } from '@pms/domain';
import { statusLabels, type StatusPresentation } from './types';

interface SourcePresentation extends StatusPresentation {
  manualLabel: string;
  code: string;
  origin: string;
}
export const source = {
  OTA: {
    label: 'Канал продаж',
    manualLabel: 'OTA (вручную)',
    code: 'OTA',
    origin: 'из канала',
    tone: 'neutral',
  },
  DESK: {
    label: 'Стойка',
    manualLabel: 'стойка',
    code: 'Стойка',
    origin: 'со стойки',
    tone: 'neutral',
  },
  PHONE: {
    label: 'Телефон',
    manualLabel: 'телефон',
    code: 'Тел.',
    origin: 'по телефону',
    tone: 'neutral',
  },
  WHATSAPP: {
    label: 'WhatsApp',
    manualLabel: 'WhatsApp',
    code: 'WA',
    origin: 'из WhatsApp',
    tone: 'neutral',
  },
  WALK_IN: {
    label: 'Без предварительной брони',
    manualLabel: 'с улицы',
    code: 'Стойка',
    origin: 'со стойки',
    tone: 'neutral',
  },
  INSTAGRAM: {
    label: 'Instagram',
    manualLabel: 'Instagram',
    code: 'IG',
    origin: 'из Instagram',
    tone: 'neutral',
  },
  WEBSITE: { label: 'Сайт', manualLabel: 'сайт', code: 'Сайт', origin: 'с сайта', tone: 'neutral' },
} as const satisfies Record<ReservationSource, SourcePresentation>;
export const sourceNames = statusLabels(source);
export const manualSources: ReadonlyArray<readonly [string, string]> = (
  ['DESK', 'PHONE', 'WHATSAPP', 'WALK_IN', 'INSTAGRAM', 'WEBSITE', 'OTA'] as const
).map((key) => [key, source[key].manualLabel]);
export const sourceOrigins: Record<string, string> = Object.fromEntries(
  Object.entries(source).map(([key, entry]) => [key, entry.origin]),
);
export const sourceCodes: Record<string, string> = Object.fromEntries(
  Object.entries(source).map(([key, entry]) => [key, entry.code]),
);
export const channels: ReadonlyArray<string> = [
  'Booking.com',
  'Trip.com',
  'Expedia',
  'Agoda',
  'Hostelworld',
  'Ostrovok.ru',
  'Bronevik.com',
  'OneTwoTrip',
];
export const channelCodes: Record<string, string> = {
  'Booking.com': 'B',
  Agoda: 'A',
  'Trip.com': 'T',
  Expedia: 'E',
  Hostelworld: 'HW',
  'Ostrovok.ru': 'O',
  Ostrovok: 'O',
  'Bronevik.com': 'BR',
  OneTwoTrip: '12',
  Airbnb: 'AB',
};

/** Existing contextual variants stay unchanged when their lookups move here. */
export const sourceCardLabels: Record<string, string> = {
  ...Object.fromEntries(manualSources),
  OTA: 'OTA',
};
export const sourceDashboardLabels: Record<string, string> = {
  ...sourceNames,
  WALK_IN: 'С улицы',
  OTA: 'Канал',
};
export const sourcePrintLabels: Record<string, string> = {
  ...sourceCardLabels,
  WALK_IN: 'без брони',
};
