import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assistant } from '@pms/integrations';
import { BarModule } from './bar.module';
import { BAR_REPOSITORY, type BarRepository } from './bar.repository';
import { BAR_SCAN_BOT, type BarScanBotRequest } from './scan.bot';
import { SCAN_MEDIA_TYPES } from './bar-scan.service';
import { PrismaService } from '../database/prisma.provider';

/** ИИ-скан накладной (ADR-152): платформа сопоставляет ответ бота со справочниками и отвечает строками формы */
describe('бар: скан накладной', () => {
  let app: INestApplication;
  let lastRequest: BarScanBotRequest | null = null;
  // ответ бота на следующий вызов; ошибки заявляются функцией
  let reply: unknown = null;
  let fail: (() => never) | null = null;

  const products = [
    { id: '30000000-0000-4000-8000-000000000001', code: 'COLA-05', name: 'Cola 0,5', barcode: '4870001234567', active: true },
    { id: '30000000-0000-4000-8000-000000000002', code: 'BORJOMI', name: 'Боржоми  0,5 л', barcode: null, active: true },
    { id: '30000000-0000-4000-8000-000000000003', code: 'OLD', name: 'Снятый товар', barcode: '4870009999999', active: false },
  ];
  const repo = {
    async products() { return products; },
    async suppliers() { return [
      { id: '20000000-0000-4000-8000-000000000001', name: 'ТОО «Алматы Напитки»', active: true },
      { id: '20000000-0000-4000-8000-000000000002', name: 'Архивный', active: false },
    ]; },
  } as unknown as BarRepository;

  const bot = {
    async scan(request: BarScanBotRequest) {
      lastRequest = request;
      if (fail) fail();
      return reply;
    },
  };

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [BarModule] })
      .overrideProvider(BAR_REPOSITORY).useValue(repo)
      .overrideProvider(BAR_SCAN_BOT).useValue(bot)
      .overrideProvider(PrismaService).useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const body = (overrides: Record<string, unknown> = {}) => ({
    fileName: 'invoice.jpg', mediaType: 'image/jpeg', dataBase64: Buffer.from('fake-image').toString('base64'),
    ...overrides,
  });

  it('сопоставляет строки по штрихкоду и названию, деньги переводит в тиыны', async () => {
    fail = null;
    reply = {
      status: 'ok',
      model: 'test-model',
      spec: {
        supplierName: 'тоо алматы напитки',
        documentNumber: 'SF-77',
        documentDate: '2026-10-08',
        lines: [
          { name: 'Кола пол-литра', barcode: '4870001234567', quantityUnits: 24, unitCost: '350' },
          { name: 'БОРЖОМИ 0,5 Л', barcode: null, quantityUnits: '6', unitCost: '540,50' },
          { name: 'Сок яблочный 1л', barcode: '4870007654321', quantityUnits: 10, unitCost: '780.00' },
        ],
        warnings: ['Количество колы пересчитано из упаковок'],
      },
    };
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send(body()).expect(201);
    expect(res.body.supplierId).toBe('20000000-0000-4000-8000-000000000001');
    expect(res.body.documentNumber).toBe('SF-77');
    expect(res.body.documentDate).toBe('2026-10-08');
    expect(res.body.lines).toEqual([
      { productId: '30000000-0000-4000-8000-000000000001', name: 'Кола пол-литра', barcode: '4870001234567', quantityUnits: '24', unitCostMinor: '35000' },
      { productId: '30000000-0000-4000-8000-000000000002', name: 'БОРЖОМИ 0,5 Л', barcode: null, quantityUnits: '6', unitCostMinor: '54050' },
      { productId: null, name: 'Сок яблочный 1л', barcode: '4870007654321', quantityUnits: '10', unitCostMinor: '78000' },
    ]);
    expect(res.body.warnings).toEqual(['Количество колы пересчитано из упаковок']);
    // боту ушли справочники объекта и сам документ; снятые карточки в сопоставлении не участвуют
    expect(lastRequest?.schemaVersion).toBe('bar-receipt-scan/0');
    expect(lastRequest?.document.mediaType).toBe('image/jpeg');
    expect(lastRequest?.knownProducts.map((product) => product.code)).toEqual(['COLA-05', 'BORJOMI']);
    expect(lastRequest?.knownSuppliers).toEqual(['ТОО «Алматы Напитки»']);
  });

  it('кривые строки бота пропускает с предупреждением, а не падает', async () => {
    fail = null;
    reply = {
      status: 'ok',
      spec: {
        supplierName: 'Неизвестный ИП',
        documentNumber: 42,
        documentDate: '08.10.2026',
        lines: [
          { name: '', quantityUnits: 1, unitCost: '10' },
          { name: 'Цена дробная float', quantityUnits: 2, unitCost: 10.5 },
          { name: 'Живая строка', barcode: '12345678', quantityUnits: 3, unitCost: '120' },
        ],
      },
    };
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send(body()).expect(201);
    expect(res.body.supplierId).toBeNull();
    expect(res.body.supplierName).toBe('Неизвестный ИП');
    expect(res.body.documentNumber).toBeNull();
    expect(res.body.documentDate).toBeNull();
    expect(res.body.lines).toEqual([
      { productId: null, name: 'Живая строка', barcode: '12345678', quantityUnits: '3', unitCostMinor: '12000' },
    ]);
    expect(res.body.warnings.length).toBe(2);
  });

  it('не принимает чужой тип файла, пустое тело и не-base64', async () => {
    expect(SCAN_MEDIA_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect((await request(app.getHttpServer()).post('/bar/receipts/scan').send(body({ mediaType: 'application/pdf' }))).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/bar/receipts/scan').send(body({ dataBase64: '' }))).status).toBe(400);
    expect((await request(app.getHttpServer()).post('/bar/receipts/scan').send(body({ dataBase64: 'не base64!!!' }))).status).toBe(400);
  });

  it('бот недоступен: 503 и совет заполнить руками', async () => {
    fail = () => { throw new assistant.BotUnavailableError('ИИ-продавец не ответил вовремя'); };
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send(body());
    expect(res.status).toBe(503);
    expect(res.body.message).toContain('руками');
  });

  it('бот отклонил запрос: 502 с его причиной', async () => {
    fail = () => { throw new assistant.BotRejectedError(422, 'лишнее поле'); };
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send(body());
    expect(res.status).toBe(502);
  });

  it('модель не разобрала документ: 422 с советом переснять', async () => {
    fail = null;
    reply = { status: 'error', errorCode: 'SCHEMA_INVALID', usage: { input: 10, output: 5, complete: true } };
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send(body());
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('фото');
  });

  it('модель недоступна или бюджет кончился: 503', async () => {
    fail = null;
    reply = { status: 'error', errorCode: 'MODEL_UNAVAILABLE' };
    expect((await request(app.getHttpServer()).post('/bar/receipts/scan').send(body())).status).toBe(503);
  });
});

describe('бар: скан накладной без настроенного бота', () => {
  it('отвечает 503 и советует ручной ввод', async () => {
    const m = await Test.createTestingModule({ imports: [BarModule] })
      .overrideProvider(BAR_REPOSITORY).useValue({} as BarRepository)
      .overrideProvider(BAR_SCAN_BOT).useValue(null)
      .overrideProvider(PrismaService).useValue({})
      .compile();
    const app = m.createNestApplication();
    await app.init();
    const res = await request(app.getHttpServer()).post('/bar/receipts/scan').send({
      fileName: 'invoice.jpg', mediaType: 'image/jpeg', dataBase64: Buffer.from('x').toString('base64'),
    });
    expect(res.status).toBe(503);
    await app.close();
  });
});
