import { describe, expect, it, vi } from 'vitest';
import { apiSecurityHeaders } from './security-headers';

/**
 * Аудит 29.09.2026, SEC-4: API не ставил защитных заголовков. Отдаёт он JSON и два скрипта для чужих сайтов
 * (`widget.js`, `tracker.js`) — им нельзя ставить `Cross-Origin-Resource-Policy` и запрет встраивания: сайты
 * подключают их со своего домена. Здесь только `nosniff`.
 */
describe('заголовки безопасности API', () => {
  it('nosniff на каждом ответе, дальше по цепочке', () => {
    const res = { setHeader: vi.fn() };
    const next = vi.fn();
    apiSecurityHeaders({} as never, res as never, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalledOnce();
  });

  it('не мешает скриптам для чужих сайтов: CORP и X-Frame-Options не ставятся', () => {
    const res = { setHeader: vi.fn() };
    apiSecurityHeaders({} as never, res as never, vi.fn());
    const names = res.setHeader.mock.calls.map((c) => String(c[0]).toLowerCase());
    expect(names).not.toContain('cross-origin-resource-policy');
    expect(names).not.toContain('x-frame-options');
  });
});
