import { describe, expect, it } from 'vitest';
import { classifySource, hostMatches, normalizeHost } from './source';

const HOSTS = ['luxx-aparts.kz', 'www.luxx-aparts.kz'];
const at = (url: string, referrer: string | null = null) =>
  classifySource({ url, referrer, siteHosts: HOSTS });

describe('источник сессии (правила плана среза 8 §5)', () => {
  it('нет реферера — DIRECT, посадочная страница без query', () => {
    expect(at('https://luxx-aparts.kz/rooms?x=1')).toMatchObject({
      kind: 'DIRECT',
      source: null,
      referrerHost: null,
      landingPath: '/rooms',
    });
  });
  it('переход со своего же домена — DIRECT (внутренний переход, не источник)', () => {
    expect(at('https://luxx-aparts.kz/rooms', 'https://www.luxx-aparts.kz/')).toMatchObject({
      kind: 'DIRECT',
      referrerHost: null,
    });
  });
  it('поисковики: google с любым TLD, yandex, bing → SEARCH', () => {
    expect(at('https://luxx-aparts.kz/', 'https://www.google.kz/')).toMatchObject({
      kind: 'SEARCH',
      source: 'google',
      referrerHost: 'google.kz',
    });
    expect(at('https://luxx-aparts.kz/', 'https://yandex.kz/search/?text=hostel')).toMatchObject({
      kind: 'SEARCH',
      source: 'yandex',
    });
    expect(at('https://luxx-aparts.kz/', 'https://www.bing.com/')).toMatchObject({
      kind: 'SEARCH',
      source: 'bing',
    });
  });
  it('соцсети по рефереру: l.instagram.com, m.facebook.com, t.me, t.co → SOCIAL', () => {
    expect(at('https://luxx-aparts.kz/', 'https://l.instagram.com/?u=x')).toMatchObject({
      kind: 'SOCIAL',
      source: 'instagram',
    });
    expect(at('https://luxx-aparts.kz/', 'https://m.facebook.com/')).toMatchObject({
      kind: 'SOCIAL',
      source: 'facebook',
    });
    expect(at('https://luxx-aparts.kz/', 'https://t.me/luxx')).toMatchObject({
      kind: 'SOCIAL',
      source: 'telegram',
    });
    expect(at('https://luxx-aparts.kz/', 'https://t.co/abc')).toMatchObject({
      kind: 'SOCIAL',
      source: 'twitter',
    });
  });
  it('чужой сайт → REFERRAL, источник — хост без www', () => {
    expect(at('https://luxx-aparts.kz/', 'https://www.2gis.kz/almaty/firm/1')).toMatchObject({
      kind: 'REFERRAL',
      source: '2gis.kz',
      referrerHost: '2gis.kz',
    });
  });
  it('utm_source=instagram&utm_medium=social → SOCIAL, utm сохраняются', () => {
    expect(
      at(
        'https://luxx-aparts.kz/?utm_source=instagram&utm_medium=social&utm_campaign=sept&utm_content=story&utm_term=x',
        'https://l.instagram.com/',
      ),
    ).toMatchObject({
      kind: 'SOCIAL',
      source: 'instagram',
      medium: 'social',
      campaign: 'sept',
      content: 'story',
      term: 'x',
      landingPath: '/',
    });
  });
  it('utm_medium=cpc или gclid → PAID', () => {
    expect(at('https://luxx-aparts.kz/?utm_source=google&utm_medium=cpc')).toMatchObject({
      kind: 'PAID',
      source: 'google',
      medium: 'cpc',
    });
    expect(at('https://luxx-aparts.kz/?gclid=abc', 'https://www.google.com/')).toMatchObject({
      kind: 'PAID',
      source: 'google',
    });
    expect(at('https://luxx-aparts.kz/?yclid=123')).toMatchObject({
      kind: 'PAID',
      source: 'yandex',
    });
  });
  it('utm_medium=email → EMAIL; utm_source неизвестный без medium → REFERRAL; utm_source=google organic → SEARCH', () => {
    expect(at('https://luxx-aparts.kz/?utm_source=sendpulse&utm_medium=email')).toMatchObject({
      kind: 'EMAIL',
      source: 'sendpulse',
    });
    expect(at('https://luxx-aparts.kz/?utm_source=partner-site')).toMatchObject({
      kind: 'REFERRAL',
      source: 'partner-site',
    });
    expect(at('https://luxx-aparts.kz/?utm_source=google&utm_medium=organic')).toMatchObject({
      kind: 'SEARCH',
      source: 'google',
    });
  });
  it('utm в нижнем регистре и обрезаны до 100 символов; кривой реферер игнорируется', () => {
    const long = 'A'.repeat(150);
    const r = at(`https://luxx-aparts.kz/?utm_source=${long}&utm_medium=Social`, 'not a url');
    expect(r.source).toHaveLength(100);
    expect(r.medium).toBe('social');
    expect(r.referrerHost).toBeNull();
  });
});

describe('домены сайта', () => {
  it('normalizeHost режет www и регистр', () => {
    expect(normalizeHost('WWW.Luxx-Aparts.KZ')).toBe('luxx-aparts.kz');
    expect(normalizeHost('luxx-aparts.kz:443')).toBe('luxx-aparts.kz');
  });
  it('hostMatches — сам домен и поддомены, но не похожий домен', () => {
    expect(hostMatches(['luxx-aparts.kz'], 'www.luxx-aparts.kz')).toBe(true);
    expect(hostMatches(['luxx-aparts.kz'], 'booking.luxx-aparts.kz')).toBe(true);
    expect(hostMatches(['luxx-aparts.kz'], 'luxx-aparts.kz.evil.com')).toBe(false);
    expect(hostMatches(['luxx-aparts.kz'], 'notluxx-aparts.kz')).toBe(false);
    expect(hostMatches([], 'anything')).toBe(false);
  });
});
