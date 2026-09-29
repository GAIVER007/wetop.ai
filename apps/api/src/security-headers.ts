import type { NextFunction, Request, Response } from 'express';

/**
 * Защитные заголовки API (аудит 29.09.2026, SEC-4). API отдаёт JSON и два скрипта для чужих сайтов — `widget.js`
 * бронирования и `tracker.js` счётчика: сайты подключают их со своего домена, поэтому `Cross-Origin-Resource-Policy`
 * и запрет встраивания здесь нельзя. Только `nosniff`: браузер не должен угадывать тип ответа.
 */
export function apiSecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}
