import { describe, it, expect } from 'vitest';
import { diagnosticsEnabled, diagnosticId, routeClass, callerFrames, incomingEvent, transportEvent, settingsRequest } from '../../apps/web/src/lib/settings-request-diagnostics';

const enabled = { CI: 'true', APP_UI_TEST: '1', WETOP_DIAG_HOTEL_SETTINGS: '1', NODE_ENV: 'development' };
const id = '12345678-1234-4234-8234-123456789abc';
describe('CI-only settings request diagnostics', () => {
  it('requires every gate and forbids production', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(diagnosticsEnabled({ ...enabled, CI: mask & 1 ? 'true' : '', APP_UI_TEST: mask & 2 ? '1' : '', WETOP_DIAG_HOTEL_SETTINGS: mask & 4 ? '1' : '' })).toBe(mask === 7);
    }
    expect(diagnosticsEnabled({ ...enabled, NODE_ENV: 'production' })).toBe(false);
    expect(diagnosticsEnabled({ ...enabled, CI: '1' })).toBe(false);
  });
  it('production returns before consulting diagnostic flags', () => {
    const reads: string[] = [];
    const env = new Proxy({ NODE_ENV: 'production' }, {
      get(target, key: string) {
        reads.push(key);
        if (key !== 'NODE_ENV') throw new Error(`diagnostic read: ${key}`);
        return target.NODE_ENV;
      },
    });
    expect(diagnosticsEnabled(env)).toBe(false);
    expect(reads).toEqual(['NODE_ENV']);
    expect(diagnosticsEnabled(enabled)).toBe(true);
    for (const key of ['CI', 'APP_UI_TEST', 'WETOP_DIAG_HOTEL_SETTINGS']) {
      for (const value of [undefined, '', 'false', '0', 'wrong'])
        expect(diagnosticsEnabled({ ...enabled, [key]: value })).toBe(false);
    }
  });
  it('accepts only opaque UUIDs and exact settings GET', () => {
    expect(diagnosticId(id)).toBe(id);
    for (const raw of [null, 'guest@example.invalid', id + '?token=secret', 'raw-client-id']) expect(diagnosticId(raw)).toBe('unbound');
    expect(settingsRequest('/hotel/settings')).toBe(true);
    expect(settingsRequest('/hotel/settings', 'GET')).toBe(true);
    for (const path of ['/hotel/settings?guest=private', '/hotel/settings/123', 'https://private/hotel/settings']) expect(settingsRequest(path)).toBe(false);
    expect(settingsRequest('/hotel/settings', 'PATCH')).toBe(false);
  });
  it('emits only fixed route classes, never paths or query values', () => {
    expect(routeClass('/today?guest=private')).toBe('today');
    expect(routeClass('/chessboard')).toBe('chessboard');
    expect(routeClass('/_next/static/private.js')).toBe('static');
    expect(routeClass('/guests/private')).toBe('other');
    const event = incomingEvent('guest@example.invalid', '/guests/private?token=secret', true, false, 0);
    expect(event).toEqual({ event: 'settings-diag-incoming', id: 'unbound', utc: '1970-01-01T00:00:00.000Z', ms: 0, route: 'other', rsc: true, prefetch: false });
  });
  it('rebuilds source-only callers from an allowlist without retaining raw stack', () => {
    const stack = 'Error: guest@example.invalid token=secret\n at arbitrary (/private/guest.ts:1:2)\n at run (/repo/apps/web/src/lib/hotel-api.ts:105:20)\n at run (/repo/apps/web/src/app/today/hospitality-today.tsx:20:1)';
    expect(callerFrames(stack)).toEqual(['lib/hotel-api.ts', 'app/today/hospitality-today.tsx']);
    const event = transportEvent('guest@example.invalid', 'throw', callerFrames(stack), undefined, 0);
    expect(event).toEqual({ event: 'settings-diag-transport', id: 'unbound', utc: '1970-01-01T00:00:00.000Z', ms: 0, phase: 'throw', callers: ['lib/hotel-api.ts', 'app/today/hospitality-today.tsx'] });
    expect(JSON.stringify(event).includes('secret')).toBe(false);
    expect(transportEvent(id, 'end', ['guest@example.invalid'], 200, 0)).toEqual({ event: 'settings-diag-transport', id, utc: '1970-01-01T00:00:00.000Z', ms: 0, phase: 'end', callers: [], status: 200 });
  });
});
