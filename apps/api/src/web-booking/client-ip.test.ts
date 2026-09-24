import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

/**
 * Адрес посетителя для лимитов бронирования с сайта (SECURITY.md §11). На Mac туннель приходил в API с loopback,
 * на сервере туннель — соседний контейнер сети compose (deploy/compose.yml, порты наружу не публикуются), и его
 * адрес частный: 172.x. Если такой адрес не считать туннелем, у всех посетителей сайта один «адрес» — контейнер
 * cloudflared, и лимит «5 броней в час с адреса» становится общим: шестая настоящая бронь за час получает отказ
 * (проверка по SECURITY.md, 24.09.2026).
 */
describe('clientIp', () => {
  const visitor = '203.0.113.10';

  it('туннель на той же машине (loopback) — адрес посетителя из CF-Connecting-IP', () => {
    expect(clientIp('127.0.0.1', visitor)).toBe(visitor);
    expect(clientIp('::1', visitor)).toBe(visitor);
    expect(clientIp('::ffff:127.0.0.1', visitor)).toBe(visitor);
  });

  it('туннель соседним контейнером сети compose — тоже из CF-Connecting-IP', () => {
    expect(clientIp('172.18.0.4', visitor)).toBe(visitor);
    expect(clientIp('::ffff:172.18.0.4', '198.51.100.7')).toBe('198.51.100.7');
    expect(clientIp('10.0.2.5', visitor)).toBe(visitor);
    expect(clientIp('192.168.65.3', visitor)).toBe(visitor);
    expect(clientIp('fd00:dead:beef::4', '2001:db8::1')).toBe('2001:db8::1');
  });

  it('с публичного адреса заголовок не принимается: мимо туннеля чужой адрес им не выбрать', () => {
    expect(clientIp('198.51.100.20', visitor)).toBe('198.51.100.20');
    // 172.32/16 — уже не частная сеть (частная — 172.16.0.0/12)
    expect(clientIp('172.32.0.1', visitor)).toBe('172.32.0.1');
    expect(clientIp('2001:db8::5', visitor)).toBe('2001:db8::5');
  });

  it('заголовок не адрес или его нет — считается сам запрос', () => {
    expect(clientIp('172.18.0.4', 'not-an-ip')).toBe('172.18.0.4');
    expect(clientIp('172.18.0.4', undefined)).toBe('172.18.0.4');
    expect(clientIp(undefined, visitor)).toBeNull();
  });
});
