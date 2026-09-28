import { describe, expect, it } from 'vitest';
import type { TrackedSiteCard } from './api';
import { propertyClock } from './property-time';
import {
  hostsAfterAdd,
  hostsAfterRemove,
  isPlaceholderHost,
  parseDomainInput,
  primaryHost,
  siteState,
} from './website';

const clock = propertyClock('Asia/Almaty');
// 27.09.2026 15:00 по Алматы
const NOW = new Date('2026-09-27T10:00:00Z');

function card(
  site: Partial<TrackedSiteCard['site']> = {},
  status: Partial<TrackedSiteCard['status']> = {},
): TrackedSiteCard {
  return {
    site: {
      id: 'site',
      name: 'Сайт Luxx Aparts',
      hosts: ['luxxaparts.kz'],
      publicKey: 'pms_000000000000',
      status: 'ACTIVE',
      createdAt: '2026-09-12T15:00:00Z',
      timezone: 'Asia/Almaty',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bookingEnabled: true,
      bookingRatePlan: { id: 'plan', code: 'BASE', name: 'Базовый тариф' },
      ...site,
    },
    status: { lastEventAt: null, sessionsToday: 0, pageviewsToday: 0, ...status },
    snippet: {
      key: 'pms_000000000000',
      scriptUrl: 'https://api.wetop.ai/a/pms.js',
      code: '',
      demoUrl: '',
      bookingCode: '',
      bookingDemoUrl: '',
    },
  };
}

describe('домен-заглушка', () => {
  it.each([
    'luxx-aparts.example',
    'example.invalid',
    'updated.example.invalid',
    'example.com',
    'www.example.org',
    'example.net',
  ])('%s — не адрес настоящего сайта', (host) => {
    expect(isPlaceholderHost(host)).toBe(true);
  });

  // `.localhost` и `.test` — адреса локального стенда: запросы с них доходят (сквозные тесты — test-site.localhost)
  it.each([
    'luxxaparts.kz',
    'luxx-aparts.kz',
    'example.kz',
    'myexample.com',
    'examples.com',
    'test-site.localhost',
    'hotel.test',
  ])('%s — адрес, с которого запросы доходят', (host) => {
    expect(isPlaceholderHost(host)).toBe(false);
  });

  it('основной домен — первый настоящий, заглушки пропускаются', () => {
    expect(primaryHost({ hosts: ['luxx-aparts.example', 'luxxaparts.kz'] })).toBe('luxxaparts.kz');
    expect(primaryHost({ hosts: ['luxx-aparts.example'] })).toBeNull();
  });
});

describe('состояние сайта на обзоре', () => {
  it('заготовка с доменом-заглушкой не выглядит подключённым сайтом', () => {
    // «Сайт Luxx Aparts» на боевой базе: счётчик ACTIVE, бронирование включено, домен — заглушка (Q-111)
    const s = siteState(card({ hosts: ['luxx-aparts.example'] }), clock, NOW);
    expect(s.connected).toBe(false);
    expect(s.host).toBeNull();
    expect(s.overall).toEqual({ value: 'Не подключён', tone: 'warn' });
    expect(s.counter.state).toBe('blocked');
    expect(s.booking.state).toBe('blocked');
  });

  it('событие сегодня — счётчик работает', () => {
    const s = siteState(card({}, { lastEventAt: '2026-09-27T09:54:00Z' }), clock, NOW);
    expect(s.connected).toBe(true);
    expect(s.host).toBe('luxxaparts.kz');
    expect(s.overall).toEqual({ value: 'Работает', tone: 'calm' });
    expect(s.counter).toMatchObject({ state: 'today', value: 'Работает', tone: 'calm' });
    expect(s.counter.note).toContain('14:54');
  });

  it('событий ещё не было — ждём первое посещение, а не «работает»', () => {
    const s = siteState(card(), clock, NOW);
    expect(s.counter).toMatchObject({
      state: 'waiting',
      value: 'Ждём первое посещение',
      tone: 'warn',
    });
    expect(s.overall.value).toBe('Ждём первое посещение');
  });

  it('последнее событие было не сегодня — так и сказано, с датой', () => {
    const s = siteState(card({}, { lastEventAt: '2026-09-20T11:50:00Z' }), clock, NOW);
    expect(s.counter).toMatchObject({ state: 'quiet', value: 'Сегодня событий нет', tone: 'warn' });
    expect(s.counter.note).toContain('20.09');
  });

  it('пауза сайта останавливает и счётчик, и бронирование (так работает API)', () => {
    const s = siteState(
      card({ status: 'PAUSED' }, { lastEventAt: '2026-09-27T09:54:00Z' }),
      clock,
      NOW,
    );
    expect(s.overall).toEqual({ value: 'Приостановлен', tone: 'warn' });
    expect(s.counter.state).toBe('paused');
    expect(s.booking).toMatchObject({ state: 'paused', value: 'Остановлено' });
  });

  it('бронирование: включено с тарифом, выключено, без тарифа', () => {
    expect(siteState(card(), clock, NOW).booking).toMatchObject({
      state: 'on',
      value: 'Включено',
      note: 'Тариф «Базовый тариф»',
    });
    expect(siteState(card({ bookingEnabled: false }), clock, NOW).booking).toMatchObject({
      state: 'off',
      value: 'Выключено',
    });
    expect(siteState(card({ bookingRatePlan: null }), clock, NOW).booking.state).toBe('blocked');
  });
});

describe('ввод домена (WEB2)', () => {
  it.each([
    ['https://www.LuxxAparts.kz/rooms?x=1', 'luxxaparts.kz'],
    ['  luxxaparts.kz  ', 'luxxaparts.kz'],
    ['luxxaparts.kz:443', 'luxxaparts.kz'],
    ['http://promo.luxxaparts.kz/', 'promo.luxxaparts.kz'],
    ['WWW.luxxaparts.kz.', 'luxxaparts.kz'],
  ])('«%s» — это %s', (raw, host) => {
    expect(parseDomainInput(raw)).toEqual({ host });
  });

  it('пустой ввод и не-адрес названы словами до запроса в API', () => {
    expect(parseDomainInput('   ')).toEqual({
      error: 'Впишите адрес сайта, например myhotel.kz',
    });
    for (const raw of ['luxx aparts', 'https://', 'luxx_aparts.kz', '-luxx.kz'])
      expect(parseDomainInput(raw)).toHaveProperty(
        'error',
        'Не похоже на адрес сайта: впишите домен, например myhotel.kz',
      );
  });
});

describe('список доменов после правки (WEB2)', () => {
  it('настоящий домен вытесняет заглушку — так и сказано', () => {
    expect(hostsAfterAdd(['luxx-aparts.example'], 'luxxaparts.kz')).toEqual({
      hosts: ['luxxaparts.kz'],
      dropped: ['luxx-aparts.example'],
    });
  });

  it('второй домен встаёт в конец, основной не меняется', () => {
    expect(hostsAfterAdd(['luxxaparts.kz'], 'promo.kz')).toEqual({
      hosts: ['luxxaparts.kz', 'promo.kz'],
      dropped: [],
    });
  });

  it('домен, который уже есть, не дублируется', () => {
    expect(hostsAfterAdd(['luxxaparts.kz'], 'luxxaparts.kz')).toEqual({
      error: 'luxxaparts.kz уже в списке',
    });
  });

  it('убрать можно любой, кроме последнего', () => {
    expect(hostsAfterRemove(['luxxaparts.kz', 'promo.kz'], 'luxxaparts.kz')).toEqual({
      hosts: ['promo.kz'],
    });
    expect(hostsAfterRemove(['luxxaparts.kz'], 'luxxaparts.kz')).toEqual({
      error: 'Сайту нужен хотя бы один адрес: сначала добавьте другой',
    });
    expect(hostsAfterRemove(['luxxaparts.kz'], 'promo.kz')).toEqual({
      error: 'promo.kz уже нет в списке',
    });
  });
});
