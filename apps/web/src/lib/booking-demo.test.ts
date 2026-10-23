import { describe, expect, it } from 'vitest';
import { bookingDemoHtml, bookingDemoHref } from './booking-demo';

const card = (over: Partial<{ bookingEnabled: boolean; name: string; code: string }> = {}) =>
  ({
    site: {
      id: 's1',
      name: over.name ?? 'Отель <Тест>',
      publicKey: 'pms_abcdef123456',
      bookingEnabled: over.bookingEnabled ?? true,
      bookingRatePlan: { id: 'p', code: 'BAR', name: 'Базовый' },
    },
    snippet: {
      bookingCode:
        over.code ??
        '<!-- PMS: виджет бронирования -->\n<div id="pms-booking"></div>\n<script async src="https://api.wetop.ai/w/widget.js" data-site="pms_abcdef123456"></script>',
    },
  }) as never;

describe('демо брони внутри стойки (аудит 21.10.2026: «Открыть демо» давал 404)', () => {
  it('ссылка ведёт на страницу стойки, а не на адрес API', () => {
    expect(bookingDemoHref('s 1')).toBe('/website/booking/demo?site=s%201');
  });

  it('страница грузит виджет с адреса API по ключу сайта и экранирует имя', () => {
    const html = bookingDemoHtml(card())!;
    expect(html).toContain('<script async src="https://api.wetop.ai/w/widget.js" data-site="pms_abcdef123456"></script>');
    expect(html).toContain('<div id="pms-booking"></div>');
    expect(html).toContain('Отель &lt;Тест&gt;');
    expect(html).not.toContain('/a/pms.js'); // счётчик посещений демо не засчитывает
  });

  it('без включённого бронирования или с чужим адресом скрипта страницы нет', () => {
    expect(bookingDemoHtml(card({ bookingEnabled: false }))).toBeNull();
    expect(bookingDemoHtml(card({ code: '<script src="javascript:alert(1)"></script>' }))).toBeNull();
  });

  it('пустая карточка даёт понятную страницу без кода', () => {
    const html = bookingDemoHtml(null);
    expect(html).toContain('Демо брони недоступно');
    expect(html).toContain('/website/booking');
  });
});
