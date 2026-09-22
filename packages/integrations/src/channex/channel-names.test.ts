import { describe, expect, it } from 'vitest';
import {
  CHANNEX_PULLS_EXISTING_BOOKINGS,
  channelCodeOf,
  channelKey,
  KNOWN_CHANNEL_KEYS,
  otaChannelKey,
  otaChannelLabel,
} from './channel-names';

/**
 * ADR-024: имена каналов у Exely (`sourceChannelName`) и у Channex (`ota_name`) разные — сопоставление
 * перенесённых броней идёт по общему ключу.
 *
 * Имена Exely — как в нашей БД после импорта. Имена Channex — ТОЛЬКО из документации (AGENTS.md §5):
 * `docs/channex/site/api-v.1-documentation/bookings-collection.md` — `"Booking.com"` (:340),
 * `"BookingCom"` (:1192), `"Airbnb"` (:1651), `"A-Expedia"` (:1802, :1881), `"Goibibo"` (:1966);
 * `webhook-collection.md:502` — `"Klook"`; `booking-crs-api.md:101` — `"Offline"`;
 * `messages-collection.md:71` — провайдеры `"BookingCom"`, `"Airbnb"`, `"Expedia"`.
 * Имена из прогона 11.09.2026 (`Ctrip`, `Agoda`, `Hostelworld`, `Ostrovok`) мы вписали в `ota_name` сами
 * через Booking CRS API — это не документация, здесь они только как «правдоподобные варианты».
 */
const EXELY = [
  'Trip.com Group',
  'booking.com',
  'Expedia/Hotels.com',
  'Agoda',
  'Ostrovok.ru (Emerging Travel Group)',
  'Hostelworld',
  'Bronevik.com',
  'OneTwoTrip',
];
const DOCUMENTED = [
  'Booking.com',
  'BookingCom',
  'A-Expedia',
  'Expedia',
  'Airbnb',
  'Goibibo',
  'Klook',
];

describe('otaChannelKey', () => {
  it('документированные ota_name Channex и имена Exely одного канала дают один ключ', () => {
    const pairs: Array<[string, string]> = [
      ['booking.com', 'Booking.com'], // bookings-collection.md:340
      ['booking.com', 'BookingCom'], // bookings-collection.md:1192, messages-collection.md:71
      ['Expedia/Hotels.com', 'A-Expedia'], // bookings-collection.md:1802 — примеры Expedia
      ['Expedia/Hotels.com', 'Expedia'], // messages-collection.md:71
    ];
    for (const [exely, channex] of pairs)
      expect(otaChannelKey(exely), `${exely} ↔ ${channex}`).toBe(otaChannelKey(channex));
  });

  it('Trip.com: настоящий ota_name в документации не встречается — все правдоподобные написания ведут к одному ключу, а неизвестное имя не сопоставится ни с чем', () => {
    // канал в Channex называется «Ctrip» (channel-mapping-guides/ctrip-trip.com.md:22); что придёт в ota_name — вопрос
    for (const spelling of ['Ctrip', 'CTrip', 'Trip.com', 'Trip.com Group', 'ctrip.com'])
      expect(otaChannelKey(spelling), spelling).toBe(otaChannelKey('Trip.com Group'));
    expect(KNOWN_CHANNEL_KEYS.has(otaChannelKey('Trip Hotels Ltd'))).toBe(false);
  });

  it('разные каналы не сходятся между собой ни в одной комбинации', () => {
    const keysExely = EXELY.map(otaChannelKey);
    expect(new Set(keysExely).size).toBe(EXELY.length);
    // среди документированных имён совпадают только два написания Booking.com и два — Expedia
    expect(new Set(DOCUMENTED.map(otaChannelKey)).size).toBe(DOCUMENTED.length - 2);
    const legal = new Set(['bookingcom', 'ctrip', 'expedia', 'agoda', 'ostrovok', 'hostelworld']);
    for (const e of EXELY)
      for (const c of [...DOCUMENTED, 'Ctrip', 'Agoda', 'Hostelworld', 'Ostrovok']) {
        if (otaChannelKey(e) === otaChannelKey(c))
          expect(legal.has(otaChannelKey(c)), `${e} ↔ ${c}`).toBe(true);
      }
    // Airbnb, Goibibo, Klook — не каналы объекта: ни с одним именем Exely не сходятся
    for (const foreign of ['Airbnb', 'Goibibo', 'Klook'])
      for (const e of EXELY) expect(otaChannelKey(foreign)).not.toBe(otaChannelKey(e));
  });

  it('регистр, пробелы, точки и скобки не влияют; алиасы Hotels.com и ETG ведут к своему каналу', () => {
    expect(otaChannelKey('BOOKING.COM')).toBe('bookingcom');
    expect(otaChannelKey('  Trip.com ')).toBe('ctrip');
    expect(otaChannelKey('Hotels.com')).toBe('expedia');
    expect(otaChannelKey('Ostrovok.ru')).toBe('ostrovok');
    expect(otaChannelKey('ETG')).toBe('ostrovok');
    expect(otaChannelKey('Emerging Travel Group')).toBe('ostrovok');
    expect(otaChannelKey('Bronevik.com')).toBe('bronevik');
    expect(otaChannelKey('Островок')).toBe(''); // кириллица не даёт ключа — такое имя ни с чем не сопоставится
  });

  it('подтяжку существующих броней Channex делает только для Booking.com, Trip.com и Expedia (how-channex-works-for-us.md)', () => {
    expect([...CHANNEX_PULLS_EXISTING_BOOKINGS].sort()).toEqual(['bookingcom', 'ctrip', 'expedia']);
    for (const k of CHANNEX_PULLS_EXISTING_BOOKINGS) expect(KNOWN_CHANNEL_KEYS.has(k)).toBe(true);
    // восемь каналов объекта известны; чужие — нет
    for (const e of EXELY) expect(KNOWN_CHANNEL_KEYS.has(otaChannelKey(e)), e).toBe(true);
    for (const foreign of ['Airbnb', 'Klook', 'Offline', ''])
      expect(KNOWN_CHANNEL_KEYS.has(otaChannelKey(foreign)), foreign).toBe(false);
  });
});

describe('channelKey: код из unique_id важнее имени (channel-codes.md: «match by the code, not by the name»)', () => {
  it('документированные коды ведут к ключам каналов объекта', () => {
    expect(channelKey('BDC-9996013801', 'BookingCom')).toBe('bookingcom');
    expect(channelKey('EXP-1695093244', 'A-Expedia')).toBe('expedia');
    expect(channelKey('HTL-1', 'Hotels.com')).toBe('expedia');
    expect(channelKey('CTP-1', 'Trip.com Group')).toBe('ctrip');
    expect(channelKey('AGO-1', 'Agoda')).toBe('agoda');
    expect(channelKey('HWL-PRB-1WNGH', 'Hostelworld Group')).toBe('hostelworld');
    expect(channelKey('OVK-1', 'Emerging Travel Group')).toBe('ostrovok');
  });
  it('код побеждает незнакомое имя; без документированного кода работает имя', () => {
    expect(channelKey('CTP-1', 'Trip Hotels Ltd')).toBe('ctrip');
    expect(channelKey('ZZZ-1', 'Booking.com')).toBe('bookingcom');
    expect(channelKey('CTRIP-777', 'Trip Hotels Ltd')).toBe('triphotelsltd');
    expect(channelCodeOf('bdc-1')).toBeNull();
    expect(channelCodeOf('BDC-SHOW-22C80')).toBe('BDC');
  });
});

/**
 * Отчёты («Главная», отчёт по каналам) группируют брони по имени канала, а Channex присылает один канал под разными
 * именами (bookings-collection.md:340 и :1192). Имя для показа — одно на канал объекта
 * (plans/channel-name-canonical-2026-09-22.md).
 */
describe('otaChannelLabel: одно имя канала для отчётов', () => {
  it('написания одного канала у Channex и Exely дают одно имя для показа', () => {
    const cases: Array<[string, string]> = [
      ['Booking.com', 'Booking.com'],
      ['BookingCom', 'Booking.com'],
      ['booking.com', 'Booking.com'],
      ['A-Expedia', 'Expedia'],
      ['Expedia', 'Expedia'],
      ['Expedia/Hotels.com', 'Expedia'],
      ['Ctrip', 'Trip.com'],
      ['Trip.com Group', 'Trip.com'],
      ['Ostrovok.ru (Emerging Travel Group)', 'Ostrovok.ru'],
      ['Agoda', 'Agoda'],
      ['Hostelworld', 'Hostelworld'],
      ['Bronevik.com', 'Bronevik.com'],
      ['OneTwoTrip', 'OneTwoTrip'],
    ];
    for (const [raw, label] of cases) expect(otaChannelLabel(raw), raw).toBe(label);
  });

  it('канал, которого у объекта нет, показывается как пришёл — имя не придумывается', () => {
    for (const raw of ['Airbnb', 'Klook', 'Goibibo', 'Канал без латиницы'])
      expect(otaChannelLabel(raw), raw).toBe(raw);
  });
});
