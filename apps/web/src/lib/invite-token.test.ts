import { describe, expect, it } from 'vitest';
import { decodeInviteToken } from './invite-token';

/**
 * Ссылка приглашения `/invite/<ключ>`: ключ в адресе может прийти с битым %-кодированием. Раньше страница падала на
 * `decodeURIComponent` ошибкой URIError (500) до вызова API; теперь такая ссылка — обычная «мёртвая».
 */
describe('ключ приглашения из адреса', () => {
  it('обычный ключ и ключ в %-кодировке', () => {
    expect(decodeInviteToken('abc123')).toBe('abc123');
    expect(decodeInviteToken('a%2Fb')).toBe('a/b');
  });

  it('битое %-кодирование — ключа нет, без исключения', () => {
    expect(decodeInviteToken('%E0%A4%A')).toBeNull();
    expect(decodeInviteToken('%')).toBeNull();
  });

  it('пустой ключ — ключа нет', () => {
    expect(decodeInviteToken('')).toBeNull();
  });
});
