import { describe, expect, it } from 'vitest';
import {
  checkFetchUrl,
  isPublicAddress,
  pinnedLookup,
  safeDownload,
  SafeFetchError,
  type FetchResponse,
  type SafeFetchDeps,
} from './asset-fetch';

/** MKT8: загрузчик фото Channex не ходит во внутреннюю сеть ни прямо, ни через DNS, ни через переадресацию */
const MAX = 1024;

type Scripted = { status: number; location?: string; body?: Buffer; contentLength?: number | null };

function fakeDeps(dns: Record<string, string[]>, responses: Record<string, Scripted>) {
  const fetched: Array<{ url: string; address: string }> = [];
  const deps: SafeFetchDeps = {
    async resolve(hostname) {
      const found = dns[hostname];
      if (!found) throw new Error('ENOTFOUND');
      return found;
    },
    async get(url, address) {
      fetched.push({ url: url.toString(), address });
      const r = responses[url.toString()];
      if (!r) throw new Error('ECONNREFUSED');
      const body = r.body ?? Buffer.alloc(0);
      const res: FetchResponse = {
        status: r.status,
        location: r.location ?? null,
        contentLength: r.contentLength === undefined ? body.length : r.contentLength,
        body: (async function* () {
          for (let i = 0; i < body.length; i += 100) yield body.subarray(i, i + 100);
        })(),
        abort: () => undefined,
      };
      return res;
    },
  };
  return { deps, fetched };
}

async function code(url: string, deps: SafeFetchDeps): Promise<string> {
  try {
    await safeDownload(url, { maxBytes: MAX, deps });
  } catch (error) {
    expect(error).toBeInstanceOf(SafeFetchError);
    return (error as SafeFetchError).code;
  }
  throw new Error('ожидался отказ');
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PUBLIC = '93.184.216.34';

describe('MKT8: публичный ли адрес', () => {
  it.each([
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['172.31.255.255', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['224.0.0.1', false],
    ['255.255.255.255', false],
    ['198.18.0.1', false],
    ['::1', false],
    ['::', false],
    ['fe80::1', false],
    ['fd00::1', false],
    ['fc00::1', false],
    ['ff02::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:10.0.0.1', false],
    ['2001:db8::1', false],
    ['2002:7f00:1::', false],
    ['64:ff9b::7f00:1', false],
    ['8.8.8.8', true],
    [PUBLIC, true],
    ['172.32.0.1', true],
    ['::ffff:8.8.8.8', true],
    ['2a00:1450:4001:80b::200e', true],
    ['not-an-ip', false],
  ])('%s → %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe('MKT8: адрес фото', () => {
  it.each([
    'http://img.channex.io/a.jpg',
    'https://user:pass@img.channex.io/a.jpg',
    'https://img.channex.io:8443/a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://[::1]/a.jpg',
    'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.5/a.jpg',
    'https://2130706433/a.jpg',
    'https://localhost/a.jpg',
    'https://foo.localhost/a.jpg',
    'https://intranet/a.jpg',
    'ftp://img.channex.io/a.jpg',
    'javascript:alert(1)',
    'not a url',
  ])('отклоняется до DNS: %s', (url) => {
    expect(() => checkFetchUrl(url)).toThrow(SafeFetchError);
  });

  it('официальный img.channex.io и порт 443 проходят', () => {
    expect(checkFetchUrl('https://img.channex.io/abc.jpg').hostname).toBe('img.channex.io');
    expect(checkFetchUrl('https://img.channex.io:443/abc.jpg').hostname).toBe('img.channex.io');
  });
});

describe('MKT8: скачивание с защитой от SSRF', () => {
  it('img.channex.io с публичным адресом: байты, соединение ровно на проверенный адрес', async () => {
    const { deps, fetched } = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 200, body: JPEG } });
    const bytes = await safeDownload('https://img.channex.io/a.jpg', { maxBytes: MAX, deps });
    expect(bytes.equals(JPEG)).toBe(true);
    expect(fetched).toEqual([{ url: 'https://img.channex.io/a.jpg', address: PUBLIC }]);
  });

  it('имя разрешается во внутренний адрес (или хоть один из адресов внутренний): соединения нет', async () => {
    for (const addresses of [['127.0.0.1'], ['10.0.0.5'], ['169.254.169.254'], ['::1'], ['fe80::1'], [PUBLIC, '192.168.0.10']]) {
      const { deps, fetched } = fakeDeps({ 'evil.example.com': addresses }, { 'https://evil.example.com/a.jpg': { status: 200, body: JPEG } });
      expect(await code('https://evil.example.com/a.jpg', deps)).toBe('HOST_NOT_PUBLIC');
      expect(fetched).toEqual([]);
    }
  });

  it('переадресация публичный → внутренний и публичный → http: отказ, второго запроса нет', async () => {
    const toPrivate = fakeDeps(
      { 'img.channex.io': [PUBLIC], 'internal.example.com': ['10.0.0.7'] },
      {
        'https://img.channex.io/a.jpg': { status: 302, location: 'https://internal.example.com/secret' },
        'https://internal.example.com/secret': { status: 200, body: JPEG },
      },
    );
    expect(await code('https://img.channex.io/a.jpg', toPrivate.deps)).toBe('HOST_NOT_PUBLIC');
    expect(toPrivate.fetched.map((f) => f.url)).toEqual(['https://img.channex.io/a.jpg']);

    const toLiteral = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 301, location: 'https://169.254.169.254/latest' } });
    expect(await code('https://img.channex.io/a.jpg', toLiteral.deps)).toBe('URL_REJECTED');

    const toHttp = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 302, location: 'http://img.channex.io/a.jpg' } });
    expect(await code('https://img.channex.io/a.jpg', toHttp.deps)).toBe('URL_REJECTED');
  });

  it('переадресации: до 3 можно, четвёртая отклоняется', async () => {
    const hop = (n: number): Scripted => ({ status: 302, location: `/hop${n}` });
    const responses: Record<string, Scripted> = {
      'https://img.channex.io/a.jpg': hop(1),
      'https://img.channex.io/hop1': hop(2),
      'https://img.channex.io/hop2': hop(3),
      'https://img.channex.io/hop3': { status: 200, body: JPEG },
    };
    expect((await safeDownload('https://img.channex.io/a.jpg', { maxBytes: MAX, deps: fakeDeps({ 'img.channex.io': [PUBLIC] }, responses).deps })).length).toBe(JPEG.length);
    responses['https://img.channex.io/hop3'] = hop(4);
    expect(await code('https://img.channex.io/a.jpg', fakeDeps({ 'img.channex.io': [PUBLIC] }, responses).deps)).toBe('TOO_MANY_REDIRECTS');
  });

  it('слишком большой ответ: по заголовку длины и по потоку без заголовка', async () => {
    const big = Buffer.alloc(MAX + 1, 1);
    const declared = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 200, body: big } });
    expect(await code('https://img.channex.io/a.jpg', declared.deps)).toBe('TOO_LARGE');
    const streamed = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 200, body: big, contentLength: null } });
    expect(await code('https://img.channex.io/a.jpg', streamed.deps)).toBe('TOO_LARGE');
  });

  it('ошибка сервера и неизвестное имя: код без тела ответа', async () => {
    const err = fakeDeps({ 'img.channex.io': [PUBLIC] }, { 'https://img.channex.io/a.jpg': { status: 500, body: Buffer.from('internal secret page') } });
    expect(await code('https://img.channex.io/a.jpg', err.deps)).toBe('HTTP_ERROR');
    expect(await code('https://nowhere.example.com/a.jpg', fakeDeps({}, {}).deps)).toBe('DNS_FAILED');
  });

  it('сокет получает только проверенный адрес, какое бы имя ни спросили', () => {
    const lookup = pinnedLookup(PUBLIC) as unknown as (h: string, o: unknown, cb: (...a: unknown[]) => void) => void;
    let single: unknown[] = [];
    lookup('img.channex.io', {}, (...args) => (single = args));
    expect(single).toEqual([null, PUBLIC, 4]);
    let all: unknown[] = [];
    lookup('rebinding.example.com', { all: true }, (...args) => (all = args));
    expect(all).toEqual([null, [{ address: PUBLIC, family: 4 }]]);
  });
});
