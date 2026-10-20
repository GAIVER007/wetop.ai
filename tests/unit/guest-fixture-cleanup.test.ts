import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import { request as http, type APIRequestContext, type APIRequest } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type Cleanup = (args: {
  request: APIRequestContext;
  playwright: { request: Pick<APIRequest, 'newContext'> };
}) => Promise<void>;

// Execute the real, trusted guest-spec cleanup hook without importing/running its browser declarations.
function cleanupHook(origin: string): Cleanup {
  const source = readFileSync(new URL('../ui/guests-design.spec.ts', import.meta.url), 'utf8');
  const marker = 'test.afterEach(';
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf('\n});', start);
  if (start < marker.length || end < start) throw new Error('Guest cleanup hook not found');
  return new Function('fixture', 'expect', `return (${source.slice(start, end + 2)});`)(origin, expect) as Cleanup;
}

let server: Server;
let pooled: APIRequestContext;
let origin: string;
let mode: 'idle-socket-reset' | 'http-error' | 'disconnect-all';
let controls: number;
let created: number;
let disposed: number;

beforeEach(async () => {
  mode = 'idle-socket-reset'; controls = 0; created = 0; disposed = 0;
  const warmed = new Set<Socket>();
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (req.url === '/warm') {
        warmed.add(req.socket);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      } else if (req.url === '/__test/control') {
        controls++;
        // Deterministically model the CI idle-socket expiry at reuse, rather than retrying a timing race.
        if (mode === 'disconnect-all' || (mode === 'idle-socket-reset' && warmed.has(req.socket))) {
          req.socket.destroy();
          return;
        }
        res.writeHead(mode === 'http-error' ? 503 : 200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      } else {
        res.writeHead(404); res.end();
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Loopback fixture did not bind');
  origin = `http://127.0.0.1:${address.port}`;
  pooled = await http.newContext({ timeout: 1000 });
  expect((await pooled.get(origin + '/warm')).ok()).toBe(true);
});

afterEach(async () => {
  await pooled?.dispose();
  server?.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function freshFactory(): Pick<APIRequest, 'newContext'> {
  return { newContext: async () => {
    created++;
    const context = await http.newContext({ timeout: 1000 });
    const dispose = context.dispose.bind(context);
    context.dispose = async (...args) => { disposed++; await dispose(...args); };
    return context;
  } };
}

describe('Guest UI fixture cleanup transport', () => {
  it('uses a fresh context instead of the body phase expired pooled socket', async () => {
    await expect(cleanupHook(origin)({ request: pooled, playwright: { request: freshFactory() } })).resolves.toBeUndefined();
    expect(controls).toBe(1);
    expect(created).toBe(1);
    expect(disposed).toBe(1);
  });
  it('does not silently accept a real HTTP failure and still disposes the context', async () => {
    mode = 'http-error';
    await expect(cleanupHook(origin)({ request: pooled, playwright: { request: freshFactory() } })).rejects.toThrow();
    expect(controls).toBe(1);
    expect(created).toBe(1);
    expect(disposed).toBe(1);
  });
  it('does not retry a fresh-context transport failure and releases resources', async () => {
    mode = 'disconnect-all';
    await expect(cleanupHook(origin)({ request: pooled, playwright: { request: freshFactory() } })).rejects.toThrow();
    expect(controls).toBe(1);
    expect(created).toBe(1);
    expect(disposed).toBe(1);
  });
});
