import { describe, expect, it } from 'vitest';
import { serviceHeaders, serviceFetch } from './service-api';

describe('serviceHeaders', () => {
  it('со ключом в окружении подставляет служебный заголовок', () => {
    expect(serviceHeaders({ SERVICE_API_KEY: 'ключ-сторожа' })).toEqual({
      'x-wetop-service-key': 'ключ-сторожа',
    });
  });

  it('без ключа заголовка нет: пока замок API выключен, так и работают все скрипты', () => {
    expect(serviceHeaders({})).toEqual({});
    expect(serviceHeaders({ SERVICE_API_KEY: '   ' })).toEqual({});
  });
});

describe('serviceFetch', () => {
  it('добавляет служебный заголовок к своим и не теряет чужие', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response('{}', { status: 200 });
    };

    await serviceFetch(
      'http://127.0.0.1:3001/channels/channex/sync',
      { method: 'POST', headers: { 'content-type': 'application/json' } },
      { env: { SERVICE_API_KEY: 'ключ-сторожа' }, fetch: fake },
    );

    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-wetop-service-key']).toBe('ключ-сторожа');
    expect(calls[0]!.init.method).toBe('POST');
  });

  it('без ключа запрос уходит как раньше', async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const fake: typeof fetch = async (_i, init) => {
      calls.push({ init: init ?? {} });
      return new Response('{}', { status: 200 });
    };
    await serviceFetch('http://127.0.0.1:3001/audit', {}, { env: {}, fetch: fake });
    expect(calls[0]!.init.headers).toEqual({});
  });

  it('401 от API объясняет, что делать, а не просто падает', async () => {
    const fake: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Войдите в систему' }), { status: 401 });
    await expect(
      serviceFetch('http://127.0.0.1:3001/audit', {}, { env: {}, fetch: fake }),
    ).rejects.toThrow(/SERVICE_API_KEY/);
  });

  it('403 на служебный ключ — тот же разбор: ключ не тот', async () => {
    const fake: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Служебный ключ не подходит' }), { status: 401 });
    await expect(
      serviceFetch(
        'http://127.0.0.1:3001/audit',
        {},
        { env: { SERVICE_API_KEY: 'не-тот' }, fetch: fake },
      ),
    ).rejects.toThrow(/не подходит|SERVICE_API_KEY/);
  });

  it('обычный ответ отдаётся как есть — вызывающий сам решает, что с ним делать', async () => {
    const fake: typeof fetch = async () => new Response('{"ok":true}', { status: 200 });
    const res = await serviceFetch('http://127.0.0.1:3001/audit', {}, { env: {}, fetch: fake });
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('ошибку 500 не перехватывает: у скриптов свой разбор ответов', async () => {
    const fake: typeof fetch = async () => new Response('boom', { status: 500 });
    const res = await serviceFetch('http://127.0.0.1:3001/audit', {}, { env: {}, fetch: fake });
    expect(res.status).toBe(500);
  });
});
