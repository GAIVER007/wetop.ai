import { isIP } from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Адрес посетителя для лимитов бронирования с сайта (Д3, plans/wetop-domain-2026-09-14.md).
 * API слушает только 127.0.0.1: снаружи запрос приходит через туннель Cloudflare, и сокет у всех один — loopback.
 * Тогда берём CF-Connecting-IP: его ставит край Cloudflare, подменить его из браузера нельзя. Заголовок учитывается
 * только от loopback — запрос мимо туннеля своим заголовком чужой адрес не выберет. Не адрес — не учитывается.
 */
export function clientIp(
  socketIp: string | undefined,
  cfConnectingIp: string | undefined,
): string | null {
  const socket = socketIp?.trim() || null;
  const header = cfConnectingIp?.trim();
  if (socket && LOOPBACK.has(socket) && header && isIP(header)) return header;
  return socket;
}
