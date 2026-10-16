import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assistant } from '@pms/integrations';
import { MarketingAdsModule } from './marketing-ads.module';
import { AD_PROPOSAL_BOT, ADS_LOCATION, type AdProposalBotRequest } from './ad-proposal';
import { PrismaService } from '../database/prisma.provider';

/**
 * Предложение ИИ-таргетолога (ADR-MKT-LAUNCH, `ad-proposal/0`): платформа проверяет креатив, зовёт бота и приводит
 * ответ к правилам домена. Ничего не создаёт. Филиал и тексты вымышленные (ADR-010).
 */
describe('реклама: предложение ИИ', () => {
  let app: INestApplication;
  let last: AdProposalBotRequest | null = null;
  let reply: unknown = null;
  let fail: (() => never) | null = null;

  const bot = {
    async propose(req: AdProposalBotRequest) {
      last = req;
      if (fail) fail();
      return reply;
    },
  };
  const location = {
    async current() {
      return { name: 'Гостиница Тест', vertical: 'HOSPITALITY' };
    },
  };

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [MarketingAdsModule] })
      .overrideProvider(AD_PROPOSAL_BOT)
      .useValue(bot)
      .overrideProvider(ADS_LOCATION)
      .useValue(location)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    last = null;
    fail = null;
    reply = {
      status: 'ok',
      model: 'test-model',
      spec: {
        headline: 'Осень у моря',
        primaryText: 'Номер с видом на горы. Напишите, подберём даты.',
        description: null,
        ageMin: 25,
        ageMax: 54,
        genders: [],
        interests: ['путешествия'],
        welcomeMessage: 'Здравствуйте!',
        autofill: 'Хочу узнать цены',
        notes: [],
      },
    };
  });

  const img = Buffer.from('fake-image').toString('base64');
  const body = (over: Record<string, unknown> = {}) => ({
    destination: 'WHATSAPP',
    offer: '  Осенние выходные, завтрак включён  ',
    creativeKind: 'IMAGE',
    images: [{ mediaType: 'image/jpeg', dataBase64: img }],
    city: 'Алматы',
    country: 'KZ',
    ...over,
  });
  const post = (b: object) => request(app.getHttpServer()).post('/marketing/ads/proposal').send(b);

  it('шлёт боту контракт ad-proposal/0 с данными филиала и отдаёт предложение по правилам домена', async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    expect(last).toMatchObject({
      schemaVersion: 'ad-proposal/0',
      creativeKind: 'IMAGE',
      images: [{ mediaType: 'image/jpeg', dataBase64: img }],
      offer: 'Осенние выходные, завтрак включён',
      destination: 'WHATSAPP',
      business: {
        vertical: 'HOSPITALITY',
        name: 'Гостиница Тест',
        city: 'Алматы',
        country: 'KZ',
        language: 'ru',
      },
      history: [],
    });
    expect(typeof last!.requestId).toBe('string');
    expect(last!.budgetRemainingTokens).toBeGreaterThan(0);
    expect(res.body).toEqual({
      headline: 'Осень у моря',
      primaryText: 'Номер с видом на горы. Напишите, подберём даты.',
      description: null,
      ageMin: 25,
      ageMax: 54,
      genders: [],
      interests: ['путешествия'],
      welcome: { text: 'Здравствуйте!', autofill: 'Хочу узнать цены' },
      notes: [],
    });
  });

  it('видео: 2–4 кадра JPEG; фото: одна картинка; иначе 400 до бота', async () => {
    const frame = { mediaType: 'image/jpeg', dataBase64: img };
    expect(
      (await post(body({ creativeKind: 'VIDEO', images: [frame, frame, frame] }))).status,
    ).toBe(200);
    last = null;
    for (const bad of [
      body({ creativeKind: 'VIDEO', images: [frame] }),
      body({ creativeKind: 'VIDEO', images: [frame, frame, frame, frame, frame] }),
      body({ images: [frame, frame] }),
      body({ images: [{ mediaType: 'application/pdf', dataBase64: img }] }),
      body({ images: [{ mediaType: 'image/jpeg', dataBase64: 'не base64!' }] }),
      body({ offer: 'x'.repeat(501) }),
      body({ city: '' }),
      body({ country: 'kz' }),
      body({ destination: 'TELEGRAM' }),
    ])
      expect((await post(bad)).status).toBe(400);
    expect(last).toBeNull();
  });

  it('Messenger и Instagram Direct пока не запускаются: 400 словами до бота', async () => {
    const res = await post(body({ destination: 'MESSENGER' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Messenger/);
    expect(last).toBeNull();
  });

  it('ИИ недоступен: 503 с подсказкой заполнить руками; ответ не по схеме: 422', async () => {
    fail = () => {
      throw new assistant.BotUnavailableError('down');
    };
    const down = await post(body());
    expect(down.status).toBe(503);
    expect(down.body.message).toMatch(/руками/);
    fail = null;
    reply = { status: 'error', errorCode: 'SCHEMA_INVALID' };
    expect((await post(body())).status).toBe(422);
    reply = { status: 'ok', spec: { headline: '', primaryText: 'x' } };
    expect((await post(body())).status).toBe(422);
  });
});
