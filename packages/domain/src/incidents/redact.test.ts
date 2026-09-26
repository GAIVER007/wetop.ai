import { describe, expect, it } from 'vitest';
import { redactDetails, redactText } from './redact';

/**
 * Неисправность уходит в таблицу и в Telegram, поэтому в ней не должно быть ни персональных данных гостя,
 * ни секретов (DATA_MODEL §12, SECURITY.md). Значения собираются при запуске, чтобы в исходниках не лежали
 * строки, похожие на настоящий ключ.
 */
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ0ZXN0In0', 'ZmFrZS1zaWduYXR1cmU'].join('.');
const PASS = ['not', 'a', 'real', 'pass'].join('-');
const TOKEN = ['fake', 'token', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('');

describe('redactText', () => {
  it('SECURITY.md §7: почта и телефоны в тексте ошибки маскируются, номера броней остаются', () => {
    const t = redactText(
      'Invalid value for notes: call +7 700 000 00 00, write test.guest@example.com (бронь BDC-9996013801)',
    );
    expect(t).not.toContain('700 000 00 00');
    expect(t).not.toContain('test.guest@example.com');
    expect(t).toContain('<телефон>');
    expect(t).toContain('<почта>');
    expect(t).toContain('BDC-9996013801');
  });

  it('длина по умолчанию — 500 знаков, для last_error задаётся своя', () => {
    // обычный текст: длинная строка без пробелов для redactText — это ключ, и она маскируется целиком
    const long = 'слово '.repeat(150);
    expect(redactText(long)).toHaveLength(501);
    expect(redactText(long, 1000)).toBe(long);
  });

  it('маскирует JWT, пароль в строке подключения, Bearer и длинные ключи', () => {
    const t = redactText(
      `db postgresql://app:${PASS}@db.example.com:5432/pms; auth Bearer ${TOKEN}; jwt ${JWT}; key ${TOKEN}`,
    );
    expect(t).not.toContain(PASS);
    expect(t).not.toContain(TOKEN);
    expect(t).not.toContain(JWT);
    expect(t).toContain('db.example.com');
  });

  it('UUID и номера броней оставляет — по ним разбирают неисправность', () => {
    const t = redactText(
      'ревизия 69a1b03d-7518-45fc-b890-0a6bbc7760b2, бронь 20260912-513903-1263604791',
    );
    expect(t).toContain('69a1b03d-7518-45fc-b890-0a6bbc7760b2');
    expect(t).toContain('20260912-513903-1263604791');
  });

  it('обрезает слишком длинный текст', () => {
    expect(redactText('x '.repeat(2000)).length).toBeLessThanOrEqual(501);
  });
});

describe('redactDetails', () => {
  it('поля с ФИО, телефоном, почтой, документом и картой скрываются целиком', () => {
    const d = redactDetails({
      revisionId: 'rev-1',
      guest: { name: 'Тестов Тест', phone: '+7 700 000 00 00' },
      customer_email: 'test@example.com',
      passport: 'N0000000',
      guarantee: { card_number: '4111111111111111' },
      error: `HTTP 503 ${TOKEN}`,
    }) as Record<string, unknown>;
    expect(JSON.stringify(d)).not.toMatch(/Тестов|700 000|example\.com|N0000000|4111/);
    expect(d.revisionId).toBe('rev-1');
    expect(String(d.error)).toContain('HTTP 503');
    expect(String(d.error)).not.toContain(TOKEN);
  });

  it('глубокие и длинные структуры обрезаются', () => {
    const deep = {
      a: { b: { c: { d: { e: { f: 1 } } } } },
      list: Array.from({ length: 100 }, (_, i) => i),
    };
    const d = redactDetails(deep) as { list: unknown[] };
    expect(d.list.length).toBeLessThanOrEqual(21);
    expect(JSON.stringify(d)).not.toContain('"f":1');
  });
});

// Аудит 26.09, С-38: выражения маски работали квадратично (почта и пароль в строке подключения без якоря), а маска шла
// по всему тексту до обрезки. Текст ошибки с эхом ввода в 100 КБ — секунды остановленного API на запрос.
describe('маска и длинный текст', () => {
  it('100 КБ одного слова маскируются быстро', () => {
    for (const text of ['a'.repeat(100_000), `${'a'.repeat(100_000)}://`, `x${'1'.repeat(100_000)}`]) {
      const started = performance.now();
      const out = redactText(text);
      const ms = performance.now() - started;
      expect(out.length).toBeLessThanOrEqual(501);
      expect(ms, `маска заняла ${Math.round(ms)} мс`).toBeLessThan(200);
    }
  });

  it('обрезка до маски не оставляет почту на границе незамаскированной', () => {
    const tail = ' me@example.com';
    const text = `${'слово '.repeat(400)}${tail}`;
    expect(redactText(text, 5_000)).not.toContain('me@example');
  });
});

describe('обрезка до маски и длинное слово', () => {
  it('текст из одного длинного слова не пропадает целиком: остаются его первые знаки', () => {
    const out = redactText(`Ошибка разбора: ${'Z'.repeat(10_000)}`);
    expect(out).toMatch(/^Ошибка разбора: ZZZZ/);
  });

  // Проверка исправлений 26.09: длинное слово на границе обрезки оставалось целиком — почта в его конце, лишённая
  // окончания («…@mail» без «.kz»), под маску уже не подходила; длинные ключи впереди сжимались и открывали её в ответе
  it('длинное слово на границе обрезки не выносит в ответ обрубок почты', () => {
    const keys = Array.from({ length: 8 }, (_, i) => `${String.fromCharCode(65 + i)}${'k'.repeat(199)}`).join(' ');
    // слово подобрано так, что обрезка на 2000 знаках приходится ровно после «@mail»
    const word = `https://example.invalid/booking?${'p'.repeat(337)}&guest=ivan.petrov@mail.kz`;
    const text = `${keys} ${word}`;
    const cut = 2_000 - keys.length - 1;
    expect(word.slice(0, cut).endsWith('ivan.petrov@mail')).toBe(true);
    expect(redactText(text)).not.toContain('ivan.petrov');
  });
});

