/** Устройство, браузер и ОС по User-Agent. Сам User-Agent дальше приёмника не уходит (план среза 8 §9). */
export type DeviceKind = 'DESKTOP' | 'MOBILE' | 'TABLET';

export interface DeviceInfo {
  device: DeviceKind;
  browser: string | null;
  os: string | null;
}

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|curl\/|wget\/|python-requests|httpclient|okhttp|go-http-client|axios\/|node-fetch|scrapy|phantom|selenium|puppeteer|playwright/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_RE.test(ua);
}

function browserOf(ua: string): string {
  if (/YaBrowser\//.test(ua)) return 'Yandex';
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/CriOS\/|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return 'Другой';
}

function osOf(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'Другая';
}

function deviceOf(ua: string): DeviceKind {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/.test(ua)) return 'TABLET';
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return 'TABLET';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|IEMobile|Opera Mini/.test(ua)) {
    return 'MOBILE';
  }
  return 'DESKTOP';
}

export function deviceFromUserAgent(
  ua: string | null | undefined,
  width: number | null,
): DeviceInfo {
  if (!ua) {
    return {
      device: width !== null && width < 768 ? 'MOBILE' : 'DESKTOP',
      browser: null,
      os: null,
    };
  }
  return { device: deviceOf(ua), browser: browserOf(ua), os: osOf(ua) };
}
