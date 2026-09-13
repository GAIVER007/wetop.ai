import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRealApi, realConfig } from './real-config';

afterEach(() => vi.unstubAllGlobals());

describe('Real project startup', () => {
  it('requires the configured database before starting a local backend', () => {
    expect(() => realConfig({})).toThrow('DATABASE_URL');
    expect(realConfig({ DATABASE_URL: 'postgresql://test@localhost/test' })).toMatchObject({
      apiUrl: 'http://127.0.0.1:3001',
      startApi: true,
      apiPort: 3001,
    });
  });
  it('can reuse an explicitly configured backend without local database credentials', () => {
    expect(realConfig({ APP_API_URL: 'https://pms.example.invalid/api/' })).toMatchObject({
      apiUrl: 'https://pms.example.invalid/api',
      startApi: false,
    });
  });
  it.each([
    'http://127.0.0.1:4311',
    'http://127.0.0.1:4312',
    'https://user:secret@example.invalid',
    'file:///etc/passwd',
    'https://example.invalid?key=secret',
    'http://public.example.invalid',
    'invalid',
  ])('rejects an unsafe or demo backend address: %s', (url) => {
    expect(() => realConfig({ APP_API_URL: url })).toThrow();
  });
  it.each(['0', 'nope', '70000', '3000', '4311', '4312'])(
    'rejects an invalid or conflicting local API port: %s',
    (port) => {
      expect(() => realConfig({ DATABASE_URL: 'configured', API_PORT: port })).toThrow();
    },
  );
  it('reads a custom local API port', () => {
    expect(realConfig({ DATABASE_URL: 'configured', API_PORT: '3020' }).apiUrl).toBe(
      'http://127.0.0.1:3020',
    );
  });
});

describe('Read-only readiness check', () => {
  const ready = { source: 'database', state: 'READY', database: { connected: true } };
  it('requires proof of the project database and uses only a bounded GET', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(ready)));
    vi.stubGlobal('fetch', fetch);
    await expect(checkRealApi('http://127.0.0.1:3001')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/system/connection',
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each([
    { ...ready, source: 'demo' },
    { ...ready, source: 'synthetic' },
    { ...ready, state: 'PROPERTY_MISSING' },
    { ...ready, database: { connected: false } },
    {},
  ])('refuses an unproven data source', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(checkRealApi('http://127.0.0.1:3001')).rejects.toThrow();
  });
  it('rejects fixture response headers even if its JSON claims to be ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(ready), { headers: { 'x-wetop-data-source': 'synthetic' } }),
        ),
    );
    await expect(checkRealApi('http://127.0.0.1:3001')).rejects.toThrow();
  });
  it('does not print remote error bodies or transport credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fake-secret in transport')));
    await expect(checkRealApi('http://127.0.0.1:3001')).rejects.toThrow('Backend недоступен');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('fake-secret', { status: 500 })));
    await expect(checkRealApi('http://127.0.0.1:3001')).rejects.toThrow(
      'Не удалось проверить базу',
    );
  });
});
