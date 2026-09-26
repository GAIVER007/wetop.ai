import { createHash } from 'node:crypto';

/**
 * Ключ хозяина виджета помощника — только на сервере стойки (в клиентский бандл `node:crypto` не едет).
 *
 * Берётся от ключа сессии, а не от подписи: подпись меняется на каждой отрисовке (новое `issued_at`), а сессия —
 * только при входе, выходе и смене человека. Короткий отпечаток с приставкой: по нему нельзя ни восстановить ключ
 * сессии, ни сопоставить его с `sessions.token_hash` в базе. Нет сессии — пустая строка.
 */
export function widgetOwnerKey(sessionToken: string | null): string {
  if (!sessionToken) return '';
  return createHash('sha256')
    .update(`wetop-assistant-widget|${sessionToken}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}
