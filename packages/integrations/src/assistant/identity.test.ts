import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { IDENTITY_TTL_SECONDS, identityPayload, signIdentity } from './identity';

/**
 * Подпись вошедшего для помощника (ТЗ ред. 1, П1; docs/assistant/README.md §1). Формат задаёт бот
 * (`src/channels/widget_identity.py` на ветке `ai-seller`): он подпись только проверяет, поэтому
 * любое расхождение в байтах превращает вошедшего в анонима — без ошибки и без записи в журнале.
 */

/** Эталон, посчитанный ботом (ТЗ П1): функция платформы обязана дать ровно его */
const REFERENCE_SECRET = 'test-secret-do-not-use';
const REFERENCE_TOKEN =
  'NDJ8aXZhbkBleGFtcGxlLmNvbXw3fG93bmVyfDE3MDAwMDAwMDA.7e42f0839960cc08716f2beaf378cf36d68d81d10810c00353c97ffc26399a2c';

const reference = {
  userId: '42',
  email: 'ivan@example.com',
  organizationId: '7',
  role: 'owner',
  issuedAt: 1_700_000_000,
};

/** Разбор ровно как `read_identity` бота: base64url → строка → HMAC той же строки → пять полей */
function readLikeBot(secret: string, token: string) {
  const [body, signature] = token.split('.');
  const raw = Buffer.from(body!, 'base64url');
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (expected !== signature) return null;
  const parts = raw.toString('utf8').split('|');
  if (parts.length !== 5) return null;
  const [userId, email, organizationId, role, issuedAt] = parts;
  return { userId, email, organizationId, role, issuedAt: Number(issuedAt) };
}

describe('signIdentity — подпись вошедшего для помощника (ТЗ П1)', () => {
  it('на входах эталона ТЗ даёт ровно эталонный токен', () => {
    expect(signIdentity(REFERENCE_SECRET, reference)).toBe(REFERENCE_TOKEN);
  });

  it('строка под подписью — пять полей через «|», секунды последними', () => {
    expect(identityPayload(reference)).toBe('42|ivan@example.com|7|owner|1700000000');
  });

  it('«|» внутри поля становится пробелом, края обрезаются: почта с «|» не сдвинет разбор', () => {
    const token = signIdentity(REFERENCE_SECRET, {
      ...reference,
      email: '  ivan|test@example.com ',
    });
    expect(readLikeBot(REFERENCE_SECRET, token)).toEqual({
      userId: '42',
      email: 'ivan test@example.com',
      organizationId: '7',
      role: 'owner',
      issuedAt: 1_700_000_000,
    });
  });

  it('секунды — целые: дробная часть отбрасывается, а не пишется в строку', () => {
    expect(identityPayload({ ...reference, issuedAt: 1_700_000_000.9 })).toBe(
      '42|ivan@example.com|7|owner|1700000000',
    );
  });

  it('base64url без «=» на конце и без «+» и «/»', () => {
    // Строка подобрана так, что обычный base64 дал бы и «=» на конце, и «+» внутри
    const token = signIdentity(REFERENCE_SECRET, { ...reference, email: 'a?>~@example.com' });
    const body = token.split('.')[0]!;
    expect(body).not.toMatch(/[=+/]/);
    expect(readLikeBot(REFERENCE_SECRET, token)?.email).toBe('a?>~@example.com');
  });

  it('кириллица в почте подписывается в UTF-8 и читается ботом без потерь', () => {
    const token = signIdentity(REFERENCE_SECRET, { ...reference, email: 'айгуль@пример.қаз' });
    expect(readLikeBot(REFERENCE_SECRET, token)?.email).toBe('айгуль@пример.қаз');
  });

  it('пустая роль — пустое поле: ролей в платформе нет (ADR-023), бот читает её как None', () => {
    const token = signIdentity(REFERENCE_SECRET, { ...reference, role: '' });
    expect(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8')).toBe(
      '42|ivan@example.com|7||1700000000',
    );
    expect(readLikeBot(REFERENCE_SECRET, token)?.role).toBe('');
  });

  it('подпись в нижнем регистре hex, 64 знака', () => {
    expect(signIdentity(REFERENCE_SECRET, reference).split('.')[1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('чужой секрет подпись не сходит: бот такого посетителя считает анонимом', () => {
    expect(readLikeBot('другой-секрет', signIdentity(REFERENCE_SECRET, reference))).toBeNull();
  });

  it('пустой секрет — отказ, а не подпись пустым ключом', () => {
    expect(() => signIdentity('', reference)).toThrow(/секрет/i);
    expect(() => signIdentity('   ', reference)).toThrow(/секрет/i);
  });

  it('срок подписи — 12 часов, как WIDGET_IDENTITY_TTL_SECONDS помощника (ТЗ Б2)', () => {
    expect(IDENTITY_TTL_SECONDS).toBe(43_200);
  });
});
