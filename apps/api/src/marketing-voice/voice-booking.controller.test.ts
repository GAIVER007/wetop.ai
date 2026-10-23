import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { VoiceBookingController } from './voice-booking.controller';
import { VoiceBeautyService } from './voice-beauty.service';
import { VoiceBookingRouter } from './voice-booking.router';
import { VoiceFoodService } from './voice-food.service';
import { VoiceBookingService } from './voice-booking.service';

/** Ключи голосовой брони разделены: чтение свободного и запись брони разными ключами; общий служебный не входит */
const INGEST = 'voice-ingest-key-for-unit-test';
const BOOK = 'voice-book-key-for-unit-test-xx';
const SERVICE = 'service-key-for-unit-test';
const SELLER_BOOK = 'seller-book-key-for-unit-tests';

describe('голосовая бронь: ключи', () => {
  let app: INestApplication;
  const service = { availability: vi.fn(async () => ({ categories: [] })) };
  const router = {
    quote: vi.fn(async () => ({ intent: 'i' })),
    confirm: vi.fn(async () => ({ confirmationNumber: 'WT-1' })),
  };
  const beauty = {
    catalog: vi.fn(async () => ({ services: [] })),
    slots: vi.fn(async () => ({ slots: [] })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VoiceBookingController],
      providers: [
        { provide: VoiceBookingService, useValue: service },
        { provide: VoiceBookingRouter, useValue: router },
        { provide: VoiceBeautyService, useValue: beauty },
        { provide: VoiceFoodService, useValue: { check: vi.fn(async () => ({ ok: true })) } },
        { provide: AuthService, useValue: { whoami: async () => null } },
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('VOICE_INGEST_KEY', INGEST);
    vi.stubEnv('VOICE_BOOK_KEY', BOOK);
    vi.stubEnv('SERVICE_API_KEY', SERVICE);
    vi.stubEnv('SELLER_BOOK_KEY', SELLER_BOOK);
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('свободное читает ключ приёма событий', async () => {
    await request(app.getHttpServer()).get('/voice/availability').set('x-wetop-service-key', INGEST).expect(200);
    expect(service.availability).toHaveBeenCalledOnce();
  });
  it.each([['записи голоса', BOOK], ['общий служебный', SERVICE], ['записи продавца', SELLER_BOOK]])(
    'свободное не читает ключ %s',
    async (_name, key) => {
      await request(app.getHttpServer()).get('/voice/availability').set('x-wetop-service-key', key).expect(403);
      expect(service.availability).not.toHaveBeenCalled();
    },
  );
  it('котировку и подтверждение пишет только ключ записи голоса', async () => {
    for (const path of ['/voice/booking-quotes', '/voice/booking-quotes/confirm']) {
      await request(app.getHttpServer()).post(path).set('x-wetop-service-key', BOOK).send({}).expect(path.endsWith('confirm') ? 200 : 201);
    }
    expect(router.quote).toHaveBeenCalledOnce();
    expect(router.confirm).toHaveBeenCalledOnce();
  });
  it.each([['приёма событий', INGEST], ['общий служебный', SERVICE], ['записи продавца', SELLER_BOOK]])(
    'записать бронь ключом %s нельзя',
    async (_name, key) => {
      for (const path of ['/voice/booking-quotes', '/voice/booking-quotes/confirm'])
        await request(app.getHttpServer()).post(path).set('x-wetop-service-key', key).send({}).expect(403);
      expect(router.quote).not.toHaveBeenCalled();
      expect(router.confirm).not.toHaveBeenCalled();
    },
  );
  it.each(['/voice/beauty-catalog', '/voice/beauty-slots', '/voice/food-availability'])('справочник и окна салона %s читает ключ приёма событий, ключ записи нет', async (path) => {
    await request(app.getHttpServer()).get(path).set('x-wetop-service-key', INGEST).expect(200);
    await request(app.getHttpServer()).get(path).set('x-wetop-service-key', BOOK).expect(403);
    await request(app.getHttpServer()).get(path).set('x-wetop-service-key', SERVICE).expect(403);
  });
  it('ключ записи голоса не открывает события, профиль и чтение свободного', async () => {
    await request(app.getHttpServer()).get('/voice/availability').set('x-wetop-service-key', BOOK).expect(403);
  });
  it('без ключа и с неверным ключом: 401', async () => {
    await request(app.getHttpServer()).post('/voice/booking-quotes').send({}).expect(401);
    await request(app.getHttpServer()).post('/voice/booking-quotes').set('x-wetop-service-key', 'wrong').send({}).expect(401);
  });
});
