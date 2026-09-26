import { BlockList, isIP } from 'node:net';

/**
 * Откуда приходит туннель Cloudflare. На Mac API слушал 127.0.0.1 и туннель стучался с loopback; на сервере туннель —
 * соседний контейнер сети compose (deploy/compose.yml), и его адрес частный (172.x). Порты API наружу не публикуются,
 * поэтому с частного адреса до API достают только свои службы: туннель и стойка.
 */
const TUNNEL = new BlockList();
TUNNEL.addSubnet('127.0.0.0', 8, 'ipv4');
TUNNEL.addSubnet('10.0.0.0', 8, 'ipv4');
TUNNEL.addSubnet('172.16.0.0', 12, 'ipv4');
TUNNEL.addSubnet('192.168.0.0', 16, 'ipv4');
TUNNEL.addAddress('::1', 'ipv6');
TUNNEL.addSubnet('fc00::', 7, 'ipv6');

function fromTunnel(socket: string): boolean {
  // IPv4 на сокете, слушающем IPv6, выглядит как ::ffff:172.18.0.4
  const address = socket.toLowerCase().startsWith('::ffff:') ? socket.slice(7) : socket;
  const family = isIP(address);
  if (family === 4) return TUNNEL.check(address, 'ipv4');
  if (family === 6) return TUNNEL.check(address, 'ipv6');
  return false;
}

/**
 * Адрес посетителя для лимитов бронирования с сайта (Д3, plans/wetop-domain-2026-09-14.md).
 * Снаружи запрос приходит только через туннель Cloudflare, и сокет у всех посетителей один — сам туннель.
 * Тогда берём CF-Connecting-IP: его ставит край Cloudflare, подменить его из браузера нельзя. Заголовок учитывается
 * только от туннеля (loopback или частная сеть compose) — запрос с публичного адреса своим заголовком чужой адрес
 * не выберет. Не адрес — не учитывается.
 */
export function clientIp(
  socketIp: string | undefined,
  cfConnectingIp: string | undefined,
): string | null {
  const socket = socketIp?.trim() || null;
  const header = cfConnectingIp?.trim();
  if (socket && fromTunnel(socket) && header && isIP(header)) return header;
  return socket;
}

/**
 * Адрес посетителя для лимитов входа (С-5, ТЗ аудита 25.09.2026). Отличие от `clientIp`: запрос со своей
 * инфраструктуры (туннель, стойка на loopback) БЕЗ заголовка — это не посетитель, а свои службы и локальные
 * наборы; считать их одним ведром «127.0.0.1» значит запереть всю стойку одним нападающим. Снаружи до API
 * дотянуться можно только через туннель, а его край всегда ставит CF-Connecting-IP.
 */
export function visitorIp(
  socketIp: string | undefined,
  cfConnectingIp: string | undefined,
): string | null {
  const socket = socketIp?.trim() || null;
  if (socket && fromTunnel(socket)) {
    const header = cfConnectingIp?.trim();
    return header && isIP(header) ? header : null;
  }
  return socket;
}
