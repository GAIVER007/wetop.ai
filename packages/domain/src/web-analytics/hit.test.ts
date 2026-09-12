import { describe, expect, it } from 'vitest';
import { parseHit, HIT_LIMITS } from './hit';

const good = {
  k: 'pms_5f3c9a1b2d4e',
  v: '8d2f1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  s: 'c1a4b2c3d4e5f6a7',
  t: 'pageview',
  u: 'https://luxx-aparts.kz/rooms?utm_source=instagram',
  r: 'https://l.instagram.com/',
  w: 390,
  l: 'ru-RU',
  z: 'Asia/Almaty',
  ti: 'Номера — Luxx Aparts',
  ts: 1757664000000,
};

describe('разбор события счётчика', () => {
  it('принимает корректный pageview и возвращает разобранные поля', () => {
    const r = parseHit(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hit).toMatchObject({
      siteKey: 'pms_5f3c9a1b2d4e',
      visitorKey: good.v,
      sessionKey: good.s,
      type: 'pageview',
      referrer: 'https://l.instagram.com/',
      width: 390,
      language: 'ru-RU',
      timezone: 'Asia/Almaty',
      title: 'Номера — Luxx Aparts',
      eventName: null,
      props: null,
    });
    expect(r.hit.url.pathname).toBe('/rooms');
  });
  it('принимает строку JSON (тело text/plain от sendBeacon)', () => {
    const r = parseHit(JSON.stringify(good));
    expect(r.ok).toBe(true);
  });
  it.each([
    ['не объект', 'null'],
    ['ключ не по форме', { ...good, k: 'G-XLJ63SQTJ4' }],
    ['посетитель короче 8', { ...good, v: 'abc' }],
    ['сессия с пробелом', { ...good, s: 'a b c d e f g h' }],
    ['неизвестный тип', { ...good, t: 'click' }],
    ['адрес не http', { ...good, u: 'javascript:alert(1)' }],
    ['адрес не строка', { ...good, u: 42 }],
    ['адрес длиннее лимита', { ...good, u: 'https://a.kz/' + 'x'.repeat(HIT_LIMITS.url) }],
    ['событие без имени', { ...good, t: 'event' }],
    ['событие с чужим именем', { ...good, t: 'event', n: 'purchase' }],
  ])('отклоняет: %s', (_label, raw) => {
    const r = parseHit(raw);
    expect(r.ok).toBe(false);
  });
  it('невалидный реферер, ширина и заголовок — не причина отказа, а null/обрезка', () => {
    const r = parseHit({ ...good, r: 'nope', w: 'wide', ti: 'T'.repeat(500), l: 'x'.repeat(40) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hit.referrer).toBeNull();
    expect(r.hit.width).toBeNull();
    expect(r.hit.title).toHaveLength(HIT_LIMITS.title);
    expect(r.hit.language).toBeNull();
  });
  it('событие search: параметры только из allow-list, значения обрезаны, лишнее выброшено', () => {
    const r = parseHit({
      ...good,
      t: 'event',
      n: 'search',
      p: {
        arrival: '2026-10-01',
        departure: '2026-10-03',
        adults: 2,
        children: 0,
        email: 'guest@example.com',
        name: 'Иван',
        category: 'x'.repeat(200),
        nested: { a: 1 },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hit.eventName).toBe('search');
    expect(r.hit.props).toEqual({
      arrival: '2026-10-01',
      departure: '2026-10-03',
      adults: 2,
      children: 0,
      category: 'x'.repeat(HIT_LIMITS.propValue),
    });
  });
  it('ping и leave без реферера и заголовка проходят', () => {
    const r = parseHit({ k: good.k, v: good.v, s: good.s, t: 'ping', u: good.u });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hit.type).toBe('ping');
    expect(r.hit.referrer).toBeNull();
  });
});
