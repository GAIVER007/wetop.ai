import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { VerticalToolsController } from './vertical-tools.controller';
import { VerticalToolsService } from './vertical-tools.service';
const id = '11111111-1111-4111-8111-111111111111';
const service = { context: vi.fn(async () => ({ agentId: id })), beauty: vi.fn(async () => ({ items: [] })), food: vi.fn(async () => ({ items: [] })) };
let app: INestApplication;
beforeAll(async () => {
  const m = await Test.createTestingModule({ controllers: [VerticalToolsController], providers: [
    { provide: VerticalToolsService, useValue: service }, { provide: AuthService, useValue: { whoami: async () => null } },
    { provide: APP_GUARD, useClass: SessionGuard },
  ] }).compile();
  app = m.createNestApplication({ logger: false }); await app.init();
});
afterAll(() => app.close());
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('SELLER_QUOTE_KEY', 'synthetic-quote-key'); });
it.each(['0', '1'])('narrow authenticated GET contract with AUTH_REQUIRED=%s', async auth => {
  vi.stubEnv('AUTH_REQUIRED', auth);
  for (const path of ['agent-context', 'beauty-services', 'food-service-periods']) {
    const r = await request(app.getHttpServer()).get(`/bot/${path}`).query({ agent: id }).set('x-wetop-service-key', 'synthetic-quote-key').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
  }
});
it.each(['0', '1'])('bad key and overridden scope denied before domain with AUTH_REQUIRED=%s', async auth => {
  vi.stubEnv('AUTH_REQUIRED', auth);
  await request(app.getHttpServer()).get('/bot/agent-context').query({ agent: id }).expect(403);
  await request(app.getHttpServer()).get('/bot/beauty-services').query({ agent: id, business: id }).set('x-wetop-service-key', 'synthetic-quote-key').expect(400);
  expect(service.context).not.toHaveBeenCalled(); expect(service.beauty).not.toHaveBeenCalled();
});
