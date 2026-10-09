import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

/**
 * Разбор тела запросов API (MKT3, решение владельца 06.10.2026). Nest запускается с `bodyParser: false`, а парсеры
 * ставятся здесь: встроенный JSON-парсер Express режет тело на 100 КБ ещё до контроллера, и поднять предел только
 * для одного маршрута изнутри модуля или пайпа нельзя.
 *
 * Три уровня защиты документа сайта, и это разные числа:
 * - HTTP: тело `POST /marketing/site/versions` не больше `SITE_VERSION_BODY_LIMIT` (300 КБ). Это транспортный предел:
 *   SiteSpec плюс конверт `{"baseRevision": …, "spec": …}` и пробелы клиента;
 * - продукт: каноническая запись SiteSpec не больше 256 КБ, держит `validateSiteSpec` (ответ 400 `too_large`);
 * - база: CHECK `octet_length(spec::text) <= 393216` (384 КБ), грубая страховка, не второй допустимый размер.
 *
 * Остальной API живёт с прежними умолчаниями Nest: JSON до 100 КБ и urlencoded `extended: true` до 100 КБ.
 *
 * Скан накладной бара (ADR-153): `POST /bar/receipts/scan` несёт фото документа в base64: файл до 8 МБ,
 * в base64 это ~10,7 МБ плюс конверт JSON, транспортный предел 12 МБ. Продуктовый предел файла держит
 * `bar-scan.service.ts` (SCAN_MAX_BASE64), это разные числа, как у версии сайта.
 */
export const DEFAULT_JSON_LIMIT = 100 * 1024;
export const SITE_VERSION_BODY_LIMIT = 300 * 1024;
export const BAR_SCAN_BODY_LIMIT = 12 * 1024 * 1024;
const SITE_VERSIONS_PATH = '/marketing/site/versions';
const BAR_SCAN_PATH = '/bar/receipts/scan';

/** Сохранение версии сайта: только POST и только этот путь (хвостовую косую черту Express тоже ведёт в маршрут) */
export function isSiteVersionSave(req: Pick<Request, 'method' | 'path'>): boolean {
  return req.method === 'POST' && req.path.replace(/\/+$/, '') === SITE_VERSIONS_PATH;
}

/** Скан накладной бара: только POST и только этот путь */
export function isBarReceiptScan(req: Pick<Request, 'method' | 'path'>): boolean {
  return req.method === 'POST' && req.path.replace(/\/+$/, '') === BAR_SCAN_PATH;
}

export function apiBodyParsers(): RequestHandler[] {
  const json = express.json({ limit: DEFAULT_JSON_LIMIT });
  const siteVersionJson = express.json({ limit: SITE_VERSION_BODY_LIMIT });
  const barScanJson = express.json({ limit: BAR_SCAN_BODY_LIMIT });
  return [
    (req: Request, res: Response, next: NextFunction) =>
      (isSiteVersionSave(req) ? siteVersionJson : isBarReceiptScan(req) ? barScanJson : json)(req, res, next),
    express.urlencoded({ extended: true, limit: DEFAULT_JSON_LIMIT }),
  ];
}

/** Ставит парсеры приложению, созданному с `bodyParser: false` (и `main.ts`, и тесты собирают API одинаково) */
export function useApiBodyParsers(app: { use(...handlers: RequestHandler[]): unknown }): void {
  for (const parser of apiBodyParsers()) app.use(parser);
}
