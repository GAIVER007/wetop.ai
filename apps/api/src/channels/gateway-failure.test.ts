/**
 * Сверка 20.09.2026: наружу уходил текст ошибки Channex как есть, а он несёт до 300 знаков их
 * JSON — внутренние идентификаторы объекта, тарифов и брони. Здесь проверяется, что наружу уходит
 * только то, по чему отказ узнаётся: путь, код HTTP, код ошибки.
 */
import { describe, expect, it, vi } from 'vitest';
import { channex } from '@pms/integrations';
import { gatewayFailure } from './gateway-failure';

const apiError = (message: string, status: number, path: string, code?: string) =>
  new channex.ChannexApiError(message, status, path, code);

describe('отказ шлюза наружу', () => {
  it('подробности ответа наружу не уходят', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const e = apiError(
      'Channex PUT /rate_plans: HTTP 422 invalid {"property_id":"вн-ид-объекта","rate_plan_id":"вн-ид-тарифа"}',
      422,
      '/rate_plans?filter=1',
      'invalid',
    );
    const out = gatewayFailure(e);
    expect(out.message).not.toContain('вн-ид-объекта');
    expect(out.message).not.toContain('вн-ид-тарифа');
    // но найти отказ в журнале по этому тексту можно: путь, код HTTP, код ошибки
    expect(out.message).toContain('/rate_plans');
    expect(out.message).toContain('HTTP 422');
    expect(out.message).toContain('invalid');
    expect(out.message).not.toContain('?filter=1');
  });

  it('полный текст остаётся в журнале сервера — владельцу он нужен', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    gatewayFailure(apiError('Channex GET /bookings: HTTP 500 всё подробно', 500, '/bookings'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('всё подробно'));
  });

  it('нет связи названа словами, а не «HTTP 0»', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(gatewayFailure(apiError('таймаут', 0, '/bookings')).message).toContain('нет связи');
  });

  it('ненастроенный ключ — это про нас, и текст остаётся целиком', () => {
    const out = gatewayFailure(apiError('CHANNEX_API_KEY не задан', 503, '/bookings'));
    expect(out.message).toContain('CHANNEX_API_KEY');
  });
});
