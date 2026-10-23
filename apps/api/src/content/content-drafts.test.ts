import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assistant } from '@pms/integrations';
import { ContentModule } from './content.module';
import {
  CONTENT_BOT,
  CONTENT_CONTEXT,
  CONTENT_STORE,
  type ContentBotRequest,
  type ContentDraftRow,
  type ContentStore,
} from './content-drafts';
import { PrismaService } from '../database/prisma.provider';

/**
 * «Контент»: черновики постов (docs/marketing/content-drafts-proposal.md). Филиал и тексты вымышленные (ADR-010).
 * Предложение ИИ ничего не сохраняет; сохраняет человек; CAS по revision; creationId идемпотентен; архив вместо удаления.
 */
describe('контент: черновики постов', () => {
  let app: INestApplication;
  let last: ContentBotRequest | null = null;
  let reply: unknown = null;
  let fail: (() => never) | null = null;
  let writable = true;
  let rows: ContentDraftRow[] = [];
  const LOC = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';

  const bot = {
    async propose(req: ContentBotRequest) {
      last = req;
      if (fail) fail();
      return reply;
    },
  };
  const context = {
    async current() {
      return {
        organizationId: 'org',
        locationId: LOC,
        userId: '33333333-3333-4333-8333-333333333333',
        timezone: 'Asia/Almaty',
        vertical: 'BEAUTY',
        name: 'Салон Тест',
        city: null,
        facts: ['Название: Салон Тест', 'Стрижка женская: 8000 KZT, 60 мин'],
        contacts: { siteUrl: 'https://salon.example', phone: '+7 700 000 00 01', whatsapp: null, address: 'ул. Абая, 1' },
      };
    },
    async assertWritable() {
      if (!writable) throw new (await import('@nestjs/common')).ForbiddenException('Организация доступна только для чтения');
    },
  };
  const store: ContentStore = {
    async list(locationId, from, to) {
      return rows
        .filter((r) => r.locationId === locationId && r.status !== 'ARCHIVED')
        .filter((r) => r.plannedOn === null || (r.plannedOn >= from && r.plannedOn <= to))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async find(locationId, id) {
      return rows.find((r) => r.locationId === locationId && r.id === id) ?? null;
    },
    async create(row) {
      const dup = rows.find((r) => r.locationId === row.locationId && r.creationId === row.creationId);
      if (dup) return { row: dup, created: false };
      const full: ContentDraftRow = {
        ...row,
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(rows.length + 1).padStart(12, '0')}`,
        status: 'DRAFT',
        publishedAt: null,
        revision: 1,
        createdAt: new Date(Date.UTC(2026, 9, 23, 5, rows.length)).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rows.push(full);
      return { row: full, created: true };
    },
    async update(locationId, id, expectedRevision, patch) {
      const r = rows.find((x) => x.locationId === locationId && x.id === id);
      if (!r || r.revision !== expectedRevision || r.status === 'ARCHIVED') return null;
      Object.assign(r, patch, { revision: r.revision + 1, updatedAt: new Date().toISOString() });
      return r;
    },
  };

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [ContentModule] })
      .overrideProvider(CONTENT_BOT)
      .useValue(bot)
      .overrideProvider(CONTENT_CONTEXT)
      .useValue(context)
      .overrideProvider(CONTENT_STORE)
      .useValue(store)
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
    writable = true;
    rows = [];
    reply = {
      status: 'ok',
      model: 'test-model',
      spec: {
        variants: [
          {
            hook: 'Осень, время ухода',
            title: null,
            body: 'Осень, время ухода. Стрижка за 8000 KZT, скидка 30%. Звоните +7 701 999 88 77',
            hashtags: ['#уход', 'салон'],
            cta: 'BOOK_ONLINE',
          },
          { hook: 'Волосам нужен отдых', title: null, body: 'Волосам нужен отдых.', hashtags: [], cta: 'WHATSAPP' },
        ],
      },
    };
  });

  const http = () => request(app.getHttpServer());
  const proposal = (b: object) => http().post('/marketing/content/drafts/proposal').send(b);
  const draftBody = (over: Record<string, unknown> = {}) => ({
    creationId: '44444444-4444-4444-8444-444444444444',
    channel: 'INSTAGRAM',
    topic: 'Осенний уход',
    body: 'Текст поста',
    hashtags: ['уход'],
    cta: 'BOOK_ONLINE',
    origin: 'AI',
    plannedOn: '2026-10-27',
    ...over,
  });

  it('предложение: контракт content-draft/0 с фактами и доступными кнопками, ответ по правилам домена', async () => {
    const res = await proposal({ topic: '  Осенний уход  ', channel: 'INSTAGRAM', tone: 'FRIENDLY' });
    expect(res.status).toBe(200);
    expect(last).toMatchObject({
      schemaVersion: 'content-draft/0',
      topic: 'Осенний уход',
      channel: 'INSTAGRAM',
      tone: 'FRIENDLY',
      business: { vertical: 'BEAUTY', name: 'Салон Тест', country: 'KZ', language: 'ru' },
      facts: ['Название: Салон Тест', 'Стрижка женская: 8000 KZT, 60 мин'],
      ctas: ['BOOK_ONLINE', 'CALL', 'VISIT', 'NONE'],
    });
    expect(last!.budgetRemainingTokens).toBeGreaterThan(0);
    const [a, b] = res.body.variants;
    // телефон из ответа модели вырезан; выдуманные 30% помечены; цена из карточки нет
    expect(a.body).not.toContain('999');
    expect(a.warnings).toEqual(['30%']);
    expect(a.hashtags).toEqual(['уход', 'салон']);
    expect(a.preview).toContain('Записаться онлайн: https://salon.example');
    // кнопки WhatsApp у филиала нет: вариант получает «без кнопки», а не выдуманный номер
    expect(b.cta).toBe('NONE');
    expect(rows).toHaveLength(0);
  });

  it('предложение: проверка входа и честные ошибки ИИ', async () => {
    expect((await proposal({ topic: '', channel: 'INSTAGRAM', tone: 'FRIENDLY' })).status).toBe(400);
    expect((await proposal({ topic: 'x', channel: 'TIKTOK', tone: 'FRIENDLY' })).status).toBe(400);
    expect((await proposal({ topic: 'x', channel: 'INSTAGRAM', tone: 'ANGRY' })).status).toBe(400);
    reply = { status: 'error', errorCode: 'SCHEMA_INVALID' };
    expect((await proposal({ topic: 'x', channel: 'INSTAGRAM', tone: 'FRIENDLY' })).status).toBe(422);
    reply = { status: 'error', errorCode: 'BUDGET_EXCEEDED' };
    expect((await proposal({ topic: 'x', channel: 'INSTAGRAM', tone: 'FRIENDLY' })).status).toBe(503);
    fail = () => {
      throw new assistant.BotUnavailableError('down');
    };
    expect((await proposal({ topic: 'x', channel: 'INSTAGRAM', tone: 'FRIENDLY' })).status).toBe(503);
  });

  it('сохранение: creationId идемпотентен, ответ с готовым постом', async () => {
    const first = await http().post('/marketing/content/drafts').send(draftBody());
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: 'DRAFT', revision: 1, plannedOn: '2026-10-27', origin: 'AI' });
    expect(first.body.preview).toBe('Текст поста\n\nЗаписаться онлайн: https://salon.example\n\n#уход');
    const again = await http().post('/marketing/content/drafts').send(draftBody({ body: 'Другой текст' }));
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(rows).toHaveLength(1);
    expect((await http().post('/marketing/content/drafts').send(draftBody({ creationId: 'nope' }))).status).toBe(400);
    expect((await http().post('/marketing/content/drafts').send(draftBody({ channel: 'TIKTOK' }))).status).toBe(400);
  });

  it('неделя: черновики филиала по дням и без дня; неверная неделя 400', async () => {
    await http().post('/marketing/content/drafts').send(draftBody());
    await http()
      .post('/marketing/content/drafts')
      .send(draftBody({ creationId: '55555555-5555-4555-8555-555555555555', plannedOn: null, origin: 'MANUAL' }));
    await http()
      .post('/marketing/content/drafts')
      .send(draftBody({ creationId: '66666666-6666-4666-8666-666666666666', plannedOn: '2026-11-10' }));
    rows.push({ ...rows[0]!, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', locationId: OTHER, creationId: 'x' });
    const res = await http().get('/marketing/content/drafts?week=2026-10-26');
    expect(res.status).toBe(200);
    expect(res.body.week).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(res.body.items.map((i: { plannedOn: string | null }) => i.plannedOn).sort()).toEqual(['2026-10-27', null].sort());
    expect(res.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await http().get('/marketing/content/drafts?week=2026-10-27')).status).toBe(400);
  });

  it('правка с expectedRevision; устаревшая версия 409; чужой 404', async () => {
    const id = (await http().post('/marketing/content/drafts').send(draftBody())).body.id;
    const ok = await http()
      .patch(`/marketing/content/drafts/${id}`)
      .send({ ...draftBody(), body: 'Правка', expectedRevision: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ body: 'Правка', revision: 2, origin: 'AI' });
    const stale = await http()
      .patch(`/marketing/content/drafts/${id}`)
      .send({ ...draftBody(), body: 'Старая вкладка', expectedRevision: 1 });
    expect(stale.status).toBe(409);
    expect(rows[0]!.body).toBe('Правка');
    const foreign = await http()
      .patch('/marketing/content/drafts/99999999-9999-4999-8999-999999999999')
      .send({ ...draftBody(), expectedRevision: 1 });
    expect(foreign.status).toBe(404);
  });

  it('опубликован и архив; архив не правится; только чтение организации запрещает запись', async () => {
    const id = (await http().post('/marketing/content/drafts').send(draftBody())).body.id;
    const pub = await http().post(`/marketing/content/drafts/${id}/published`).send({ expectedRevision: 1 });
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe('PUBLISHED');
    expect(pub.body.publishedAt).toBeTruthy();
    const arch = await http().post(`/marketing/content/drafts/${id}/archive`).send({ expectedRevision: 2 });
    expect(arch.status).toBe(200);
    expect(arch.body.status).toBe('ARCHIVED');
    expect((await http().get('/marketing/content/drafts?week=2026-10-26')).body.items).toEqual([]);
    const again = await http()
      .patch(`/marketing/content/drafts/${id}`)
      .send({ ...draftBody(), expectedRevision: 3 });
    expect(again.status).toBe(409);
    writable = false;
    expect((await http().post('/marketing/content/drafts').send(draftBody({ creationId: '77777777-7777-4777-8777-777777777777' }))).status).toBe(403);
    expect((await proposal({ topic: 'x', channel: 'INSTAGRAM', tone: 'FRIENDLY' })).status).toBe(403);
  });
});
