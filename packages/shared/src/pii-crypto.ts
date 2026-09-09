/**
 * Шифрование персональных данных на покое (SECURITY.md, DATA_MODEL §3: номер документа — не открытой строкой).
 * AES-256-GCM, ключ — `PII_ENCRYPTION_KEY` из окружения (hex 64 символа или любая строка → SHA-256).
 * Формат: `v1:<iv b64>:<tag b64>:<data b64>`. Без ключа — ошибка, а не тихое хранение открытым текстом.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export class PiiKeyMissingError extends Error {
  override readonly name = 'PiiKeyMissingError';
  constructor() {
    super('PII_ENCRYPTION_KEY не задан в .env — вписывает владелец (openssl rand -hex 32)');
  }
}

function keyFrom(raw: string | undefined): Buffer {
  const v = raw?.trim();
  if (!v) throw new PiiKeyMissingError();
  return /^[0-9a-fA-F]{64}$/.test(v)
    ? Buffer.from(v, 'hex')
    : createHash('sha256').update(v).digest();
}

export function encryptPii(plain: string, rawKey = process.env.PII_ENCRYPTION_KEY): string {
  const key = keyFrom(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}

export function decryptPii(token: string, rawKey = process.env.PII_ENCRYPTION_KEY): string {
  const key = keyFrom(rawKey);
  const [v, iv, tag, data] = token.split(':');
  if (v !== 'v1' || !iv || !tag || !data)
    throw new Error('Неизвестный формат зашифрованного значения');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

/** Маска для экрана: последние 4 символа, остальное звёздочками. */
export function maskNumber(plain: string, visible = 4): string {
  const s = plain.replace(/\s+/g, '');
  if (s.length <= visible) return '*'.repeat(s.length);
  return '*'.repeat(s.length - visible) + s.slice(-visible);
}
