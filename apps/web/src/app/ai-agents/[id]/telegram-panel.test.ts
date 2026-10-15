import { describe, expect, it, vi } from 'vitest';
vi.mock('./actions', () => ({ telegramAction: vi.fn() }));
import { MAX_TESTERS, parseTesterIds } from './telegram-panel';

describe('ID тестировщиков Telegram', () => {
  it('принимает числа через запятую, пробел и точку с запятой, без повторов', () => {
    expect(parseTesterIds('123456789, 987654321;123456789  555666')).toEqual({
      ids: ['123456789', '987654321', '555666'],
      error: null,
    });
  });
  it('@имя и буквы отклоняет словами', () => {
    const r = parseTesterIds('123456789, @ivan');
    expect(r.ids).toEqual([]);
    expect(r.error).toContain('@ivan');
  });
  it(`больше ${MAX_TESTERS} не берёт`, () => {
    const many = Array.from({ length: MAX_TESTERS + 1 }, (_, i) => String(100000 + i)).join(',');
    expect(parseTesterIds(many).error).toContain(String(MAX_TESTERS));
  });
});
