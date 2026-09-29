import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { FakeAudit, FakeSeller } from '../ai-seller/fakes';
import { EXTENSIONS_REPOSITORY } from './extensions.repository';
import { PLATFORM_ADMIN_ONLY } from './platform.controller';
import { SUPPORT_AUDIT } from './support.audit';
import { SUPPORT_CONNECTION, type SupportConfig, type SupportConnection, type SupportPort } from './support.connection';
import { SupportController } from './support.controller';
import { SupportKnowledgeService } from './support-kb.service';
import { SupportService } from './support.service';

/**
 * S3: управляемая база знаний WETOP Support через платформу. Только главный администратор; `by` и `approved_by`
 * ставит сервер из сессии, а не тело запроса; значения справочников проверяются до вызова помощника.
 */
const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const KB = '7a1f2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const CONV = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
const SERVICE_KEY = 'platform-test-service-key-0123456789';

class Connection implements SupportConnection {
  configured = true;
  bot = new FakeSeller();
  config(): SupportConfig {
    return this.configured ? { baseUrl: 'http://assistant:8000/p', serviceKey: 'k' } : { baseUrl: null, serviceKey: null };
  }
  client(): SupportPort | null {
    return this.configured ? (this.bot as unknown as SupportPort) : null;
  }
}
const connection = new Connection();
let audit = new FakeAudit();
let app: INestApplication;

beforeAll(async () => {
  const users: Record<string, { id: string; role: 'OWNER'; platformAdmin: boolean }> = {
    'session-admin': { id: ADMIN, role: 'OWNER', platformAdmin: true },
    'session-owner': { id: OWNER, role: 'OWNER', platformAdmin: false },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? { user: { ...who, organizationId: ORG, email: `${who.id.slice(0, 4)}@example.invalid`, name: null }, organization: null, expiresAt: '2026-09-30T00:00:00.000Z' }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [SupportController],
    providers: [
      SupportService,
      SupportKnowledgeService,
      { provide: SUPPORT_CONNECTION, useValue: connection },
      { provide: EXTENSIONS_REPOSITORY, useValue: { organization: async () => null } },
      { provide: SUPPORT_AUDIT, useFactory: () => audit },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  audit = moduleRef.get(SUPPORT_AUDIT);
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
  connection.configured = true;
  connection.bot = new FakeSeller();
  audit.events = [];
});

const api = () => request(app.getHttpServer());
const admin = { 'x-wetop-session': 'session-admin' };
const owner = { 'x-wetop-session': 'session-owner' };
const BODY = { title: 'Стирка', category: 'HOW_TO', visibility: 'PUBLIC_SUPPORT', content: 'Одна загрузка — пятьсот тенге.' };

describe('база знаний — только главный администратор', () => {
  it('владелец организации получает 403 на всё, помощника не спрашиваем', async () => {
    const refused = [
      () => api().get('/platform/support/kb').set(owner),
      () => api().post('/platform/support/kb').set(owner).send(BODY),
      () => api().get(`/platform/support/kb/${KB}`).set(owner),
      () => api().put(`/platform/support/kb/${KB}`).set(owner).send({ title: 'x' }),
      () => api().post(`/platform/support/kb/${KB}/publish`).set(owner).send({}),
      () => api().post(`/platform/support/kb/${KB}/status`).set(owner).send({ status: 'ARCHIVED' }),
      () => api().get(`/platform/support/conversations/${CONV}/knowledge`).set(owner),
      () => api().post(`/platform/support/conversations/${CONV}/knowledge-draft`).set(owner).send({}),
    ];
    for (const send of refused) {
      const res = await send().expect(403);
      expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    }
    expect(connection.bot.calls).toEqual([]);
    expect(audit.events).toEqual([]);
  });
});

describe('публикует и правит главный администратор; автора ставит сервер', () => {
  it('создание: by — из сессии, а не из тела', async () => {
    await api().post('/platform/support/kb').set(admin).send({ ...BODY, by: 'attacker', approved_by: 'attacker' }).expect(200);
    expect(connection.bot.calls[0]).toMatchObject({ op: 'kbCreate', args: [{ ...BODY, by: ADMIN }] });
    expect(JSON.stringify(connection.bot.calls[0])).not.toContain('attacker');
    expect(audit.events.map((e) => e.action)).toEqual(['support.kb.create']);
  });

  it('публикация: approved_by — id администратора из сессии, тело игнорируется', async () => {
    await api().post(`/platform/support/kb/${KB}/publish`).set(admin).send({ approved_by: 'attacker' }).expect(200);
    expect(connection.bot.calls[0]).toMatchObject({ op: 'kbPublish', args: [KB, ADMIN] });
    expect(audit.events.map((e) => e.action)).toEqual(['support.kb.publish']);
  });

  it('правка и смена статуса несут автора; статус ACTIVE не принимается — только публикация', async () => {
    await api().put(`/platform/support/kb/${KB}`).set(admin).send({ content: 'Новый текст', by: 'attacker' }).expect(200);
    expect(connection.bot.calls[0]).toMatchObject({ op: 'kbUpdate', args: [KB, { content: 'Новый текст', by: ADMIN }] });
    await api().post(`/platform/support/kb/${KB}/status`).set(admin).send({ status: 'OUTDATED' }).expect(200);
    expect(connection.bot.calls[1]).toMatchObject({ op: 'kbStatus', args: [KB, 'OUTDATED', ADMIN] });
    await api().post(`/platform/support/kb/${KB}/status`).set(admin).send({ status: 'ACTIVE' }).expect(400);
    expect(connection.bot.calls).toHaveLength(2);
  });

  it('значения справочников и идентификаторы проверяются до вызова помощника', async () => {
    await api().post('/platform/support/kb').set(admin).send({ ...BODY, category: 'NOPE' }).expect(400);
    await api().post('/platform/support/kb').set(admin).send({ ...BODY, visibility: 'ALL' }).expect(400);
    await api().post('/platform/support/kb').set(admin).send({ ...BODY, title: '' }).expect(400);
    await api().get('/platform/support/kb/не-uuid').set(admin).expect(400);
    await api().get('/platform/support/kb?status=BAD').set(admin).expect(400);
    expect(connection.bot.calls).toEqual([]);
  });

  it('список: отбор передаётся помощнику как есть, лишнее отбрасывается', async () => {
    await api().get('/platform/support/kb?status=ACTIVE&category=HOW_TO&visibility=PUBLIC_SUPPORT&q=стирка&x=1').set(admin).expect(200);
    expect(connection.bot.calls[0]).toMatchObject({
      op: 'kbList',
      args: [{ status: 'ACTIVE', category: 'HOW_TO', visibility: 'PUBLIC_SUPPORT', q: 'стирка' }],
    });
  });

  it('источники диалога и черновик из закрытого обращения', async () => {
    await api().get(`/platform/support/conversations/${CONV}/knowledge`).set(admin).expect(200);
    await api().post(`/platform/support/conversations/${CONV}/knowledge-draft`).set(admin).send({ by: 'attacker' }).expect(200);
    expect(connection.bot.calls).toMatchObject([
      { op: 'conversationKnowledge', args: [CONV] },
      { op: 'knowledgeDraft', args: [CONV, ADMIN] },
    ]);
    expect(audit.events.map((e) => e.action)).toEqual(['support.kb.draft']);
  });

  it('помощник отказал — его причина, помощник не подключён — 503', async () => {
    connection.configured = false;
    await api().get('/platform/support/kb').set(admin).expect(503);
  });
});

describe('ответы помощника пересказываются в camelCase без лишних полей', () => {
  it('запись, список и источники диалога', async () => {
    connection.bot.replies['kbRead'] = {
      id: KB, title: 'Стирка', category: 'HOW_TO', visibility: 'PUBLIC_SUPPORT', status: 'ACTIVE', version: 2,
      source: 'manual', approved_by: ADMIN, approved_at: '2026-09-29T10:00:00Z', created_at: 'a', updated_at: 'b',
      content: 'Текст', internal_secret: 'не-пропускать',
      versions: [{ version: 1, title: 'Стирка', category: 'HOW_TO', visibility: 'PUBLIC_SUPPORT', content: 'Старый', saved_by: ADMIN, saved_at: 'c', extra: 1 }],
    };
    const read = await api().get(`/platform/support/kb/${KB}`).set(admin).expect(200);
    expect(read.body).toMatchObject({ id: KB, approvedBy: ADMIN, version: 2, content: 'Текст' });
    expect(read.body.versions[0]).toMatchObject({ version: 1, savedBy: ADMIN });
    expect(JSON.stringify(read.body)).not.toContain('не-пропускать');

    connection.bot.replies['kbList'] = { items: [{ id: KB, title: 'Стирка', status: 'ACTIVE', excerpt: 'Одна…' }], counts: { ACTIVE: 1 } };
    const list = await api().get('/platform/support/kb').set(admin).expect(200);
    expect(list.body.counts).toEqual({ DRAFT: 0, ACTIVE: 1, OUTDATED: 0, ARCHIVED: 0 });
    expect(list.body.items[0]).toMatchObject({ id: KB, excerpt: 'Одна…' });

    connection.bot.replies['conversationKnowledge'] = { items: [{ knowledge_id: KB, title: 'Стирка', version: 2, visibility: 'PUBLIC_SUPPORT', score: 0.9, used_at: 'd' }] };
    const sources = await api().get(`/platform/support/conversations/${CONV}/knowledge`).set(admin).expect(200);
    expect(sources.body.items[0]).toEqual({ knowledgeId: KB, title: 'Стирка', version: 2, visibility: 'PUBLIC_SUPPORT', score: 0.9, usedAt: 'd' });
  });
});
