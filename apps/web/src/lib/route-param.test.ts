import { describe, expect, it } from 'vitest';
import { decodeRouteParam } from './route-param';

/**
 * Ревизия Channex приходит адресом `/channels/events/test%3A2026-09-16T18%3A35%3A20.672058Z%3Aabc`.
 * Next отдаёт сегмент как есть, и без декодирования клиент API кодировал его второй раз: сервер
 * отвечал 404 на существующую запись, а экран говорил «Страница не найдена» (живой обход 17.09.2026).
 */
describe('decodeRouteParam', () => {
  it('возвращает идентификатор ревизии с двоеточиями', () => {
    expect(decodeRouteParam('test%3A2026-09-16T18%3A35%3A20.672058Z%3A74234e98afe7')).toBe(
      'test:2026-09-16T18:35:20.672058Z:74234e98afe7',
    );
  });

  it('не трогает то, что кодировать было нечего', () => {
    expect(decodeRouteParam('20260628-513903-1257032485')).toBe('20260628-513903-1257032485');
  });

  it('битую последовательность отдаёт как есть, а не роняет экран', () => {
    expect(decodeRouteParam('%zz')).toBe('%zz');
    expect(decodeRouteParam('100%')).toBe('100%');
  });
});
