import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/**
 * Скачивание фото Channex для библиотеки сайта (MKT8, план §11). Адрес фото это внешние недоверенные данные, поэтому
 * загрузчик защищён от SSRF:
 * - только `https:`, без логина в адресе, порт только 443, IP-адрес вместо имени не принимается;
 * - имя разрешается до соединения, и **все** его адреса обязаны быть публичными; соединение идёт ровно на проверенный
 *   адрес (своя функция `lookup`), повторного разрешения, которое могло бы вернуть внутренний адрес, нет;
 * - до 3 переадресаций, каждая проверяется заново; 10 с на весь путь; тело до 10 МиБ (длиннее рвётся);
 * - `Content-Type` не учитывается: дальше файл проходит ту же проверку по содержимому, что загрузка.
 * Тело ответа с ошибкой и полный адрес в ошибку и лог не попадают.
 */
export type SafeFetchErrorCode =
  | 'URL_REJECTED'
  | 'HOST_NOT_PUBLIC'
  | 'DNS_FAILED'
  | 'HTTP_ERROR'
  | 'TOO_LARGE'
  | 'TOO_MANY_REDIRECTS'
  | 'TIMEOUT'
  | 'FETCH_FAILED';

export class SafeFetchError extends Error {
  constructor(readonly code: SafeFetchErrorCode) {
    super(code);
  }
}

export interface FetchResponse {
  status: number;
  location: string | null;
  contentLength: number | null;
  body: AsyncIterable<Uint8Array>;
  /** Оборвать соединение, если тело не нужно или оно длиннее предела */
  abort(): void;
}

export interface SafeFetchDeps {
  /** Все адреса имени (IPv4 и IPv6) */
  resolve(hostname: string): Promise<string[]>;
  /** GET на ровно этот адрес; имя остаётся в TLS (SNI, проверка сертификата) и в заголовке Host */
  get(url: URL, address: string, signal: AbortSignal): Promise<FetchResponse>;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  deps?: SafeFetchDeps;
}

const V4_DENY = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  V4_DENY.addSubnet(net, prefix, 'ipv4');

/** Глобальные одноадресные IPv6 (2000::/3) без документационных, Teredo и 6to4 (последние два несут IPv4 внутри) */
const V6_GLOBAL = new BlockList();
V6_GLOBAL.addSubnet('2000::', 3, 'ipv6');
const V6_DENY = new BlockList();
V6_DENY.addSubnet('2001:db8::', 32, 'ipv6');
V6_DENY.addSubnet('2001::', 32, 'ipv6');
V6_DENY.addSubnet('2002::', 16, 'ipv6');

/** Публичный ли адрес: loopback, частные, link-local, CGNAT, служебные, документационные, multicast и ULA нет */
export function isPublicAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return !V4_DENY.check(address, 'ipv4');
  if (kind !== 6) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]!);
  return V6_GLOBAL.check(address, 'ipv6') && !V6_DENY.check(address, 'ipv6');
}

/** Адрес годится для скачивания: https, имя (не IP), без логина, порт 443 */
export function checkFetchUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('URL_REJECTED');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password) throw new SafeFetchError('URL_REJECTED');
  if (url.port !== '' && url.port !== '443') throw new SafeFetchError('URL_REJECTED');
  if (!host || isIP(host) || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost'))
    throw new SafeFetchError('URL_REJECTED');
  return url;
}

/** `lookup` для сокета: всегда отдаёт заранее проверенный адрес, какое бы имя ни спросили */
export function pinnedLookup(address: string): LookupFunction {
  const family = isIP(address);
  return ((_hostname: string, options: { all?: boolean } | number | undefined, callback: (...args: unknown[]) => void) => {
    if (typeof options === 'object' && options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;
}

export const nodeFetchDeps: SafeFetchDeps = {
  async resolve(hostname) {
    const found = await dnsLookup(hostname, { all: true, verbatim: true });
    return found.map((a) => a.address);
  },
  get(url, address, signal) {
    return new Promise<FetchResponse>((resolve, reject) => {
      const req = httpsRequest(
        url,
        {
          method: 'GET',
          lookup: pinnedLookup(address),
          signal,
          headers: { 'User-Agent': 'WETOP-site-assets/1', Accept: 'image/jpeg, image/png, image/webp' },
        },
        (res) => {
          const length = Number(res.headers['content-length']);
          resolve({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === 'string' ? res.headers.location : null,
            contentLength: Number.isFinite(length) ? length : null,
            body: res,
            abort: () => res.destroy(),
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  },
};

/** Скачивает до `maxBytes` байтов по проверенному пути; любая ошибка это `SafeFetchError` с кодом, без тела ответа */
export async function safeDownload(raw: string, options: SafeFetchOptions): Promise<Buffer> {
  const deps = options.deps ?? nodeFetchDeps;
  const maxRedirects = options.maxRedirects ?? 3;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    let url = checkFetchUrl(raw);
    for (let hop = 0; ; hop++) {
      let addresses: string[];
      try {
        addresses = await deps.resolve(url.hostname);
      } catch {
        throw new SafeFetchError(controller.signal.aborted ? 'TIMEOUT' : 'DNS_FAILED');
      }
      if (!addresses.length) throw new SafeFetchError('DNS_FAILED');
      if (!addresses.every(isPublicAddress)) throw new SafeFetchError('HOST_NOT_PUBLIC');
      let res: FetchResponse;
      try {
        res = await deps.get(url, addresses[0]!, controller.signal);
      } catch {
        throw new SafeFetchError(controller.signal.aborted ? 'TIMEOUT' : 'FETCH_FAILED');
      }
      if (res.status >= 300 && res.status < 400 && res.location) {
        res.abort();
        if (hop >= maxRedirects) throw new SafeFetchError('TOO_MANY_REDIRECTS');
        url = checkFetchUrl(new URL(res.location, url).toString());
        continue;
      }
      if (res.status !== 200) {
        res.abort();
        throw new SafeFetchError('HTTP_ERROR');
      }
      if (res.contentLength !== null && res.contentLength > options.maxBytes) {
        res.abort();
        throw new SafeFetchError('TOO_LARGE');
      }
      const chunks: Buffer[] = [];
      let total = 0;
      try {
        for await (const chunk of res.body) {
          total += chunk.length;
          if (total > options.maxBytes) {
            res.abort();
            throw new SafeFetchError('TOO_LARGE');
          }
          chunks.push(Buffer.from(chunk));
        }
      } catch (error) {
        if (error instanceof SafeFetchError) throw error;
        throw new SafeFetchError(controller.signal.aborted ? 'TIMEOUT' : 'FETCH_FAILED');
      }
      return Buffer.concat(chunks);
    }
  } finally {
    clearTimeout(timer);
  }
}
