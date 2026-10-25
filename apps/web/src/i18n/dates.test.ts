import { describe, expect, it } from 'vitest';
import { dateFormat } from './dates';

const day = new Date('2026-10-24T00:00:00Z'); // суббота
const UTC = { timeZone: 'UTC' } as const;

/**
 * KK2: казахские месяцы и дни недели не зависят от данных ICU браузера. Chromium без полного ICU отдаёт для kk-KZ
 * «2026 M10 24», а сервер «24 қазан»: экран расходился при гидратации (найдено спеком tests/beauty-ui/salon-kk.spec.ts).
 */
describe('даты на языке человека', () => {
  it('русский вывод это обычный Intl ru-RU, байт в байт', () => {
    for (const options of [
      { day: 'numeric', month: 'long' },
      { day: 'numeric', month: 'short' },
      { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' },
      { month: 'long', year: 'numeric' },
      { weekday: 'short' },
      { dateStyle: 'long' },
    ] as const)
      expect(dateFormat('ru-RU', { ...UTC, ...options }).format(day)).toBe(
        new Intl.DateTimeFormat('ru-RU', { ...UTC, ...options }).format(day),
      );
  });

  it('казахский: свои названия месяцев и дней недели', () => {
    const kk = (options: Intl.DateTimeFormatOptions) => dateFormat('kk-KZ', { ...UTC, ...options }).format(day);
    expect(kk({ day: 'numeric', month: 'long' })).toBe('24 қазан');
    expect(kk({ day: 'numeric', month: 'short' })).toBe('24 қаз.');
    expect(kk({ month: 'short' })).toBe('қаз.');
    expect(kk({ day: 'numeric' })).toBe('24');
    expect(kk({ weekday: 'short' })).toBe('сб');
    expect(kk({ month: 'long', year: 'numeric' })).toBe('2026 ж. қазан');
    expect(kk({ day: 'numeric', month: 'long', year: 'numeric' })).toBe('2026 ж. 24 қазан');
    expect(kk({ day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' })).toBe('2026 ж. 24 қазан, сенбі');
    expect(kk({ dateStyle: 'long' })).toBe('2026 ж. 24 қазан');
    expect(kk({ day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('24.10.2026');
  });

  it('казахский учитывает пояс и время', () => {
    const at = new Date('2026-10-24T20:30:00Z');
    expect(dateFormat('kk-KZ', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long' }).format(at)).toBe('25 қазан');
    expect(dateFormat('kk-KZ', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' }).format(at)).toBe('01:30');
  });

  it('казахский период: один месяц сжимается, разные месяцы и годы пишутся полностью', () => {
    const f = dateFormat('kk-KZ', { ...UTC, day: 'numeric', month: 'short' });
    expect(f.formatRange(new Date('2026-10-15T00:00:00Z'), new Date('2026-10-21T00:00:00Z'))).toBe('15–21 қаз.');
    expect(f.formatRange(new Date('2026-10-28T00:00:00Z'), new Date('2026-11-02T00:00:00Z'))).toBe('28 қаз. – 2 қар.');
  });

  it('английский: Intl en-GB (данные en есть в каждом браузере), день перед месяцем, 24 часа', () => {
    expect(dateFormat('en', { ...UTC, day: 'numeric', month: 'long' }).format(day)).toBe('24 October');
    expect(dateFormat('en-GB', { ...UTC, day: 'numeric', month: 'short' }).format(day)).toBe('24 Oct');
    expect(dateFormat('en', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-10-24T20:30:00Z'))).toBe('01:30');
  });

  it('английский отрезок: обычные пробелы (тонкий у ICU Node и браузера разный, гидратация расходилась)', () => {
    const range = dateFormat('en', { ...UTC, day: 'numeric', month: 'long', year: 'numeric' }).formatRange(
      new Date('2026-10-19T00:00:00Z'),
      new Date('2026-10-25T00:00:00Z'),
    );
    expect(range).toMatch(/^19 – 25 October 2026$/);
  });

  it('язык стойки можно передать и словом ru/kk', () => {
    expect(dateFormat('kk', { ...UTC, month: 'long' }).format(day)).toBe('қазан');
    expect(dateFormat('ru', { ...UTC, month: 'long' }).format(day)).toBe(
      new Intl.DateTimeFormat('ru-RU', { ...UTC, month: 'long' }).format(day),
    );
  });
});
