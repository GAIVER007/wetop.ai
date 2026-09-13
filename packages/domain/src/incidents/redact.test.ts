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
    const t = redactText('ревизия 69a1b03d-7518-45fc-b890-0a6bbc7760b2, бронь 20260912-513903-1263604791');
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
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } }, list: Array.from({ length: 100 }, (_, i) => i) };
    const d = redactDetails(deep) as { list: unknown[] };
    expect(d.list.length).toBeLessThanOrEqual(21);
    expect(JSON.stringify(d)).not.toContain('"f":1');
  });
});
