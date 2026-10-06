import { describe, expect, it } from 'vitest';
import { apiOriginOf, contentSecurityPolicy, TURNSTILE_ORIGIN } from './headers';

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('CSP рантайма', () => {
  it('ни unsafe-eval, ни unsafe-inline для скриптов; только API WETOP и Turnstile при брони', () => {
    const csp = contentSecurityPolicy({ apiOrigin: 'https://api.example.test', analytics: true, booking: true });
    expect(csp).not.toContain('unsafe-eval');
    expect(directive(csp, 'script-src')).toBe(`script-src https://api.example.test ${TURNSTILE_ORIGIN}`);
    expect(directive(csp, 'frame-src')).toBe(`frame-src ${TURNSTILE_ORIGIN}`);
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'none'");
  });

  it('без брони Turnstile не разрешён', () => {
    const csp = contentSecurityPolicy({ apiOrigin: 'https://api.example.test', analytics: true, booking: false });
    expect(csp).not.toContain(TURNSTILE_ORIGIN);
    expect(directive(csp, 'frame-src')).toBe("frame-src 'none'");
  });

  it('без ключа и адреса API скриптов нет вовсе', () => {
    for (const input of [
      { apiOrigin: null, analytics: true, booking: true },
      { apiOrigin: 'https://api.example.test', analytics: false, booking: false },
    ]) {
      const csp = contentSecurityPolicy(input);
      expect(directive(csp, 'script-src')).toBe("script-src 'none'");
      expect(directive(csp, 'connect-src')).toBe("connect-src 'none'");
    }
  });
});

describe('CSP со скриптом цены «от» (Q-276)', () => {
  it("свой файл цен с того же хоста ('self') и запрос к API, без unsafe-inline", () => {
    const csp = contentSecurityPolicy({ apiOrigin: 'https://api.example.test', analytics: false, booking: false, prices: true });
    expect(directive(csp, 'script-src')).toBe("script-src 'self'");
    expect(directive(csp, 'connect-src')).toBe('connect-src https://api.example.test');
    expect(directive(csp, 'script-src')).not.toContain('unsafe');
  });
  it('без адреса API цен нет и в CSP', () => {
    const csp = contentSecurityPolicy({ apiOrigin: null, analytics: false, booking: false, prices: true });
    expect(directive(csp, 'script-src')).toBe("script-src 'none'");
  });
});

describe('адрес API', () => {
  it.each([
    ['https://api.wetop.ai/', 'https://api.wetop.ai'],
    ['http://127.0.0.1:3001', 'http://127.0.0.1:3001'],
    ['http://localhost:3001/x', 'http://localhost:3001'],
  ])('%s → %s', (raw, origin) => expect(apiOriginOf(raw)).toBe(origin));

  it.each(['http://api.wetop.ai', 'javascript:alert(1)', 'data:text/html,x', '', null, 'not a url'])('%s → null', (raw) => {
    expect(apiOriginOf(raw)).toBeNull();
  });
});
