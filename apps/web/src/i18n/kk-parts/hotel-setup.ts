import type { KkPart } from './types';

/** KK3: Гостиница: настройки объекта, номерной фонд, номера, график персонала. Ключ русская фраза, значение перевод; правка перевода меняет только значение */
export const hotelSetup: KkPart = {
  paths: [
    'app/hotel-settings',
    'app/inventory',
    'app/rooms',
    'app/units',
    'app/staff-schedule',
    'app/hotel-staff',
  ],
  phrases: {},
};
