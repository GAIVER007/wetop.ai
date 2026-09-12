import { describe, expect, it } from 'vitest';
import { deviceFromUserAgent, isBotUserAgent } from './device';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WIN_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const WIN_YANDEX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.6.0.0 Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';

describe('устройство, браузер и ОС из User-Agent', () => {
  it.each([
    [IPHONE, 'MOBILE', 'Safari', 'iOS'],
    [ANDROID_CHROME, 'MOBILE', 'Chrome', 'Android'],
    [ANDROID_TABLET, 'TABLET', 'Chrome', 'Android'],
    [IPAD, 'TABLET', 'Safari', 'iOS'],
    [MAC_CHROME, 'DESKTOP', 'Chrome', 'macOS'],
    [WIN_EDGE, 'DESKTOP', 'Edge', 'Windows'],
    [WIN_YANDEX, 'DESKTOP', 'Yandex', 'Windows'],
    [MAC_SAFARI, 'DESKTOP', 'Safari', 'macOS'],
    [LINUX_FIREFOX, 'DESKTOP', 'Firefox', 'Linux'],
  ])('%s', (ua, device, browser, os) => {
    expect(deviceFromUserAgent(ua, null)).toEqual({ device, browser, os });
  });
  it('без User-Agent решает ширина экрана', () => {
    expect(deviceFromUserAgent(null, 390)).toMatchObject({
      device: 'MOBILE',
      browser: null,
      os: null,
    });
    expect(deviceFromUserAgent('', 1440)).toMatchObject({ device: 'DESKTOP' });
  });
});

describe('боты', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1',
    'curl/8.4.0',
    'python-requests/2.32',
    'Chrome-Lighthouse',
  ])('отбрасывает %s', (ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });
  it('обычные браузеры и пустой UA — не боты (пустой отсеет не бот-фильтр, а лимиты)', () => {
    expect(isBotUserAgent(IPHONE)).toBe(false);
    expect(isBotUserAgent(MAC_CHROME)).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
  });
});
