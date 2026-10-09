import { describe, expect, it } from 'vitest';
import { CONTRACT_TTL_MS, ContractClient, STALE_LIMIT_MS } from './contract';
import { current, SITE_ID } from './test/fixtures';
import type { RuntimeCurrent } from './types';

type Reply = { status: number; body?: unknown } | 'network';

/** Подставной API: отвечает по очереди, запоминает адреса запросов и ключ */
function api(replies: Reply[]) {
  const calls: Array<{ url: URL; key: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, key: new Headers(init?.headers).get('x-wetop-service-key') });
    const reply = replies.shift() ?? { status: 500 };
    if (reply === 'network') throw new TypeError('fetch failed');
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function client(replies: Reply[]) {
  const { calls, fetchImpl } = api(replies);
  let now = 1_000_000;
  const logs: Array<Record<string, unknown>> = [];
  const c = new ContractClient({ SITES_API_URL: 'https://api.example.test', SITES_RUNTIME_KEY: 'k-1' }, fetchImpl, () => now, (e) => logs.push(e));
  return { c, calls, logs, tick: (ms: number) => (now += ms) };
}

const lean = (patch: Partial<RuntimeCurrent> = {}) => {
  const { spec: _s, ...rest } = current(patch);
  void _s;
  return rest;
};

describe('контракт: запрос и ключ', () => {
  it('ходит только в /sites-runtime/current с хостом и ключом рантайма', async () => {
    const { c, calls } = client([{ status: 200, body: current() }]);
    const r = await c.get('stepnoy.example.kz');
    expect(r.kind).toBe('ok');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.pathname).toBe('/sites-runtime/current');
    expect(calls[0]!.url.searchParams.get('host')).toBe('stepnoy.example.kz');
    expect(calls[0]!.url.searchParams.has('knownSpecHash')).toBe(false);
    expect(calls[0]!.key).toBe('k-1');
  });
});

describe('кэш', () => {
  it('60 секунд без повторного запроса, потом перепроверка с knownSpecHash и без документа в ответе', async () => {
    const { c, calls, tick } = client([{ status: 200, body: current() }, { status: 200, body: lean() }]);
    await c.get('h.kz');
    tick(CONTRACT_TTL_MS - 1);
    expect((await c.get('h.kz')).kind).toBe('ok');
    expect(calls).toHaveLength(1);
    tick(2);
    const r = await c.get('h.kz');
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url.searchParams.get('knownSpecHash')).toBe('a'.repeat(64));
    expect(r.kind === 'ok' && r.spec.site.displayName.ru).toBe('Гостиница «Степной ветер»');
  });

  it('новая публикация: новый хэш и новый документ', async () => {
    const next = current({ specHash: 'b'.repeat(64), versionId: 'v-2' });
    next.spec!.site.displayName = { ru: 'Новая версия' };
    const { c, tick } = client([{ status: 200, body: current() }, { status: 200, body: next }]);
    await c.get('h.kz');
    tick(CONTRACT_TTL_MS + 1);
    const r = await c.get('h.kz');
    expect(r.kind === 'ok' && r.current.versionId).toBe('v-2');
    expect(r.kind === 'ok' && r.spec.site.displayName.ru).toBe('Новая версия');
  });

  it('документ не в памяти, а API ответил без него: второй запрос целиком', async () => {
    const { c, calls } = client([{ status: 200, body: lean() }, { status: 200, body: current() }]);
    const r = await c.get('h.kz');
    expect(r.kind).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url.searchParams.has('knownSpecHash')).toBe(false);
  });
});

describe('отказы', () => {
  it('404 сразу забывает хост: снятый сайт не показывается и из кэша', async () => {
    const { c, tick } = client([{ status: 200, body: current() }, { status: 404 }, 'network']);
    await c.get('h.kz');
    tick(CONTRACT_TTL_MS + 1);
    expect((await c.get('h.kz')).kind).toBe('not_found');
    // следующий сбой API не воскрешает снятый сайт старой копией
    expect((await c.get('h.kz')).kind).toBe('unavailable');
  });

  it('spec_invalid: выдача закрыта, без старой копии', async () => {
    const { c, tick, logs } = client([{ status: 200, body: current() }, { status: 503, body: { code: 'spec_invalid' } }]);
    await c.get('h.kz');
    tick(CONTRACT_TTL_MS + 1);
    expect((await c.get('h.kz')).kind).toBe('invalid');
    expect(logs.some((l) => l['event'] === 'sites.spec_invalid')).toBe(true);
  });

  it('незнакомая версия схемы: отказ', async () => {
    const body = current({ schemaVersion: 'site-spec/1' });
    const { c } = client([{ status: 200, body }]);
    expect((await c.get('h.kz')).kind).toBe('invalid');
  });

  it.each([
    ['сеть', 'network' as Reply],
    ['500', { status: 500 } as Reply],
    ['503 без кода', { status: 503 } as Reply],
    ['ключ отклонён', { status: 401 } as Reply],
  ])('API недоступен (%s): подтверждённая копия до 10 минут, с записью в лог', async (_label, failure) => {
    const { c, tick, logs } = client([{ status: 200, body: current() }, failure, failure]);
    await c.get('h.kz');
    tick(CONTRACT_TTL_MS + 1);
    const r = await c.get('h.kz');
    expect(r.kind === 'ok' && r.stale).toBe(true);
    expect(logs.some((l) => l['event'] === 'sites.stale_served' && l['siteId'] === SITE_ID)).toBe(true);
    tick(STALE_LIMIT_MS);
    expect((await c.get('h.kz')).kind).toBe('unavailable');
  });

  it('API недоступен и копии нет: unavailable', async () => {
    const { c } = client(['network']);
    expect((await c.get('h.kz')).kind).toBe('unavailable');
  });

  it('адрес API не задан: unavailable, а не падение', async () => {
    const c = new ContractClient({ SITES_API_URL: '', SITES_RUNTIME_KEY: 'k' }, (async () => new Response('')) as typeof fetch, () => 0, () => undefined);
    expect((await c.get('h.kz')).kind).toBe('unavailable');
  });

  it('ответ не того вида: unavailable', async () => {
    const { c } = client([{ status: 200, body: { siteId: SITE_ID, state: 'DRAFT' } }]);
    expect((await c.get('h.kz')).kind).toBe('unavailable');
  });
});
