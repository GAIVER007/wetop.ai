import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Аудит 29.09.2026, SEC-4: у сайта wetop.ai (Cloudflare Pages) не было файла заголовков. Принудительно — запрет
 * встраивания, nosniff, referrer; полная CSP пока report-only. Файл читает Cloudflare Pages при выкладке `apps/site/out`.
 */
const file = readFileSync(resolve(import.meta.dirname, '../../apps/site/public/_headers'), 'utf8');
const lines = file.split('\n').map((l) => l.trimEnd());
const header = (name: string) =>
  lines.find((l) => l.trim().toLowerCase().startsWith(`${name.toLowerCase()}:`))?.trim() ?? '';

describe('apps/site/public/_headers', () => {
  it('правила на все пути', () => {
    expect(lines.find((l) => l.trim() !== '' && !l.startsWith('#'))).toBe('/*');
  });

  it('принудительно: запрет встраивания, nosniff, referrer', () => {
    expect(header('X-Frame-Options')).toBe('X-Frame-Options: DENY');
    expect(header('X-Content-Type-Options')).toBe('X-Content-Type-Options: nosniff');
    expect(header('Referrer-Policy')).toBe('Referrer-Policy: strict-origin-when-cross-origin');
    expect(header('Content-Security-Policy')).toBe(
      "Content-Security-Policy: frame-ancestors 'none'",
    );
  });

  it('полная политика — только report-only и только со своими адресами', () => {
    const policy = header('Content-Security-Policy-Report-Only');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('https://assistant.wetop.ai');
    expect(policy).toContain('https://app.wetop.ai');
    // «любой https» в скриптах свёл бы политику на нет
    expect(policy).not.toMatch(/script-src[^;]*\shttps:(\s|;|$)/);
    expect(policy).not.toContain('*');
  });
});
