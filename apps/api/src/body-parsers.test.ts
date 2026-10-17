import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BAR_SCAN_BODY_LIMIT, DEFAULT_JSON_LIMIT, MARKETING_IMPORT_BODY_LIMIT, SITE_VERSION_BODY_LIMIT, isAdProposal, isBarReceiptScan, isMarketingImport, isSiteVersionSave, useApiBodyParsers } from './body-parsers';

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
  // свой сервер на 127.0.0.1: без него supertest делает listen(0) на :: и запрос может уйти чужому (флейк 16.10.2026)
  let server: Server;
  beforeAll(async () => {
    server = app().listen(0, '127.0.0.1');
    await once(server, 'listening');
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));
  it('большой предел только у POST /marketing/site/versions', () => {
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions' })).toBe(true);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions/' })).toBe(true);
    expect(isSiteVersionSave({ method: 'PUT', path: '/marketing/site/versions' })).toBe(false);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site' })).toBe(false);
    expect(isSiteVersionSave({ method: 'POST', path: '/marketing/site/versions/x' })).toBe(false);
  });

  it('сохранение версии принимает 200 КБ, а больше 300 КБ отклоняет 413', async () => {
    const ok = await request(server).post('/marketing/site/versions').send(body(200 * 1024));
    expect(ok.status).toBe(200);
    const big = await request(server).post('/marketing/site/versions').send(body(SITE_VERSION_BODY_LIMIT));
    expect(big.status).toBe(413);
  });

  it('скан накладной бара принимает фото в base64, а больше 12 МБ отклоняет 413', async () => {
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts/scan' })).toBe(true);
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts/scan/' })).toBe(true);
    expect(isBarReceiptScan({ method: 'GET', path: '/bar/receipts/scan' })).toBe(false);
    // предложение ИИ-таргетолога несёт фото креатива или кадры видео тем же пределом (ADR-MKT-LAUNCH)
    expect(isAdProposal({ method: 'POST', path: '/marketing/ads/proposal' })).toBe(true);
    expect(isAdProposal({ method: 'GET', path: '/marketing/ads/proposal' })).toBe(false);
    expect((await request(server).post('/marketing/ads/proposal').send(body(8 * 1024 * 1024))).status).toBe(200);
    expect(isBarReceiptScan({ method: 'POST', path: '/bar/receipts' })).toBe(false);
    const ok = await request(server).post('/bar/receipts/scan').send(body(8 * 1024 * 1024));
    expect(ok.status).toBe(200);
    const big = await request(server).post('/bar/receipts/scan').send(body(BAR_SCAN_BODY_LIMIT));
    expect(big.status).toBe(413);
  });

  it('импорт расходов маркетинга принимает CSV до 1 МБ, больше отклоняет 413', async () => {
    expect(isMarketingImport({ method: 'POST', path: '/marketing/expenses/import' })).toBe(true);
    expect(isMarketingImport({ method: 'POST', path: '/marketing/expenses' })).toBe(false);
    expect(isMarketingImport({ method: 'GET', path: '/marketing/expenses/import' })).toBe(false);
    const ok = await request(server).post('/marketing/expenses/import').send(body(600 * 1024));
    expect(ok.status).toBe(200);
    const big = await request(server).post('/marketing/expenses/import').send(body(MARKETING_IMPORT_BODY_LIMIT));
    expect(big.status).toBe(413);
  });

  it('другие маршруты и методы по-прежнему режутся на 100 КБ, и JSON, и urlencoded', async () => {
    for (const [method, path] of [
      ['post', '/marketing/site'],
      ['post', '/reservations'],
      ['patch', '/marketing/site/versions'],
      ['post', '/bar/receipts'],
      ['post', '/marketing/expenses'],
    ] as const) {
      const r = await request(server)[method](path).send(body(DEFAULT_JSON_LIMIT + 10));
      expect(r.status, `${method} ${path}`).toBe(413);
    }
    const form = await request(server).post('/auth/login').type('form').send({ pad: 'x'.repeat(DEFAULT_JSON_LIMIT + 10) });
    expect(form.status).toBe(413);
    const small = await request(server).post('/reservations').send(body(1024));
    expect(small.status).toBe(200);
  });

  it('main.ts выключает встроенные парсеры Nest и ставит свои', () => {
    const main = readFileSync(resolve(__dirname, 'main.ts'), 'utf8');
    expect(main).toMatch(/NestFactory\.create\(AppModule, \{[^}]*bodyParser: false[^}]*\}\)/);
    expect(main.indexOf('useApiBodyParsers(app)')).toBeGreaterThan(main.indexOf('NestFactory.create'));
    expect(main.indexOf('useApiBodyParsers(app)')).toBeLessThan(main.indexOf('app.listen'));
  });
});
