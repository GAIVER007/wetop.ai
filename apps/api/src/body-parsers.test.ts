import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { BAR_SCAN_BODY_LIMIT, DEFAULT_JSON_LIMIT, SITE_VERSION_BODY_LIMIT, isBarReceiptScan, isSiteVersionSave, useApiBodyParsers } from './body-parsers';

/** Разбор тела API (MKT3): 300 КБ только у сохранения версии сайта, остальным прежние 100 КБ */
function app() {
  const a = express();
  useApiBodyParsers(a);
  a.all(/.*/, (req, res) => {
    res.json({ size: JSON.stringify(req.body ?? null).length });
  });
  // обработчик ошибок Express узнаётся по четырём аргументам
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  a.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({});
  });
  return a;
}
const body = (bytes: number) => ({ pad: 'x'.repeat(bytes) });

describe('разбор тела API', () => {
  it('большой предел только у POST /marketing/site/versions', () => {
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions' })).toBe(true);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions/' })).toBe(true);
    expect(isSiteVersionSave({ method: 'PUT', path: '/marketing/site/versions' })).toBe(false);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site' })).toBe(false);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions/x' })).toBe(false);
  });

  it('сохранение версии принимает 200 КБ, а больше 300 КБ отклоняет 413', async () => {
    const ok = await request(app()).post('/marketing/site/versions').send(body(200 * 1024));
    expect(ok.status).toBe(200);
    const big = await request(app()).post('/marketing/site/versions').send(body(SITE_VERSION_BODY_LIMIT));
    expect(big.status).toBe(413);
  });

  it('скан накладной бара принимает фото в base64, а больше 12 МБ отклоняет 413', async () => {
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts/scan' })).toBe(true);
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts/scan/' })).toBe(true);
    expect(isBarReceiptScan({ method: 'GET', path: '/bar/receipts/scan' })).toBe(false);
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts' })).toBe(false);
    const ok = await request(app()).post('/bar/receipts/scan').send(body(8 * 1024 * 1024));
    expect(ok.status).toBe(200);
    const big = await request(app()).post('/bar/receipts/scan').send(body(BAR_SCAN_BODY_LIMIT));
    expect(big.status).toBe(413);
  });

  it('другие маршруты и методы по-прежнему режутся на 100 КБ, и JSON, и urlencoded', async () => {
    for (const [method, path] of [
      ['post', '/marketing/site'],
      ['post', '/reservations'],
      ['patch', '/marketing/site/versions'],
      ['post', '/bar/receipts'],
    ] as const) {
      const r = await request(app())[method](path).send(body(DEFAULT_JSON_LIMIT + 10));
      expect(r.status, `${method} ${path}`).toBe(413);
    }
    const form = await request(app()).post('/auth/login').type('form').send({ pad: 'x'.repeat(DEFAULT_JSON_LIMIT + 10) });
    expect(form.status).toBe(413);
    const small = await request(app()).post('/reservations').send(body(1024));
    expect(small.status).toBe(200);
  });

  it('main.ts выключает встроенные парсеры Nest и ставит свои', () => {
    const main = readFileSync(resolve(__dirname, 'main.ts'), 'utf8');
    expect(main).toMatch(/NestFactory\.create\(AppModule, \{[^}]*bodyParser: false[^}]*\}\)/);
    expect(main.indexOf('useApiBodyParsers(app)')).toBeGreaterThan(main.indexOf('NestFactory.create'));
    expect(main.indexOf('useApiBodyParsers(app)')).toBeLessThan(main.indexOf('app.listen'));
  });
});
