import { describe, expect, it } from 'vitest';
import type { TrackedSiteCard } from './api';
import { propertyClock } from './property-time';
import { isPlaceholderHost, primaryHost, siteState } from './website';

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
