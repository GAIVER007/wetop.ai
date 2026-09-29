import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers';

/**
 * Аудит 29.09.2026, SEC-4: у стойки не было ни одного заголовка безопасности. Принудительно — только то, что не может
 * сломать страницу (запрет встраивания, nosniff, referrer). Полная политика CSP пока в режиме report-only: нарушения
 * видны в консоли браузера, страницы не ломаются. Включать принудительно — после недели без нарушений.
 */
const enforced = (h: Record<string, string>) => h['Content-Security-Policy'] ?? '';
const reportOnly = (h: Record<string, string>) => h['Content-Security-Policy-Report-Only'] ?? '';

describe('заголовки безопасности стойки', () => {
  it('всегда: запрет встраивания во фрейм, nosniff, referrer без пути к чужим сайтам', () => {
    const h = securityHeaders({});
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('принудительная политика — только frame-ancestors, всё остальное в report-only', () => {
    const h = securityHeaders({ assistantUrl: 'https://assistant.wetop.ai' });
    expect(enforced(h)).toBe("frame-ancestors 'none'");
    expect(reportOnly(h)).toContain("default-src 'self'");
    expect(reportOnly(h)).toContain("object-src 'none'");
    expect(reportOnly(h)).toContain("base-uri 'self'");
    expect(reportOnly(h)).toContain("form-action 'self'");
    expect(reportOnly(h)).toContain("frame-ancestors 'none'");
  });

  it('скрипт помощника пускается по его адресу, а не по «любому https»', () => {
    const h = securityHeaders({ assistantUrl: 'https://assistant.wetop.ai/widget/' });
    expect(reportOnly(h)).toContain("script-src 'self' 'unsafe-inline' https://assistant.wetop.ai");
    expect(reportOnly(h)).toContain("connect-src 'self' https://assistant.wetop.ai");
    expect(reportOnly(h)).not.toMatch(/script-src[^;]*\bhttps:(?!\/\/)/);
  });

  it('адрес помощника не http(s) или пустой — в политику не попадает', () => {
    for (const assistantUrl of [
      undefined,
      '',
      'javascript:alert(1)',
      'not a url',
      'data:text/html,x',
    ]) {
      const h = securityHeaders({ assistantUrl });
      expect(reportOnly(h)).toContain("script-src 'self' 'unsafe-inline';");
      expect(reportOnly(h)).not.toContain('javascript:');
      expect(reportOnly(h)).not.toContain('data:text');
    }
  });
});
