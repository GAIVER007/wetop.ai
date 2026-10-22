import 'reflect-metadata';
import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Access } from '../auth/access.decorator';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { applyEvent, type CallValues, type VoiceEvent } from './voice-events';
import { VoiceIngestController } from './voice-ingest.controller';
import { VoiceIngestService } from './voice-ingest.service';
import {
  VOICE_INGEST_REPOSITORY,
  type AgentProfile,
  type AgentScope,
  type RecordResult,
  type VoiceIngestRepository,
} from './voice-ingest.repository';

/**
 * Приём событий от голосового воркера. Узкий ключ `VOICE_INGEST_KEY` открывает только `POST /voice/events`:
 * общий служебный и чужие узкие ключи сюда не входят. Звонки в тестах вымышленные (ADR-010).
 */
const VOICE_KEY = 'voice-ingest-key-for-unit-test';
const SERVICE_KEY = 'service-key-for-unit-test';
const OTHER_KEY = 'seller-book-key-for-unit-tests';
const AGENT_A = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const AGENT_B = '4a2d3b01-4c5e-4f60-9b7c-8d9e0f1a2b3c';
const AGENT_NOLOC = '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d';

const SCOPES: Record<string, AgentScope> = {
  [AGENT_A]: { organizationId: 'org-a', businessId: 'biz-a', locationId: 'loc-a' },
  [AGENT_B]: { organizationId: 'org-b', businessId: 'biz-b', locationId: 'loc-b' },
};

class FakeRepo implements VoiceIngestRepository {
  calls = new Map<string, CallValues & { id: string; scope: AgentScope }>();
  callbacks = new Map<string, { phone: string; scope: AgentScope; callId: string }>();
  lookups = 0;
  async resolveAgent(agentId: string): Promise<AgentScope | null | 'NO_LOCATION'> {
    this.lookups += 1;
    if (agentId === AGENT_NOLOC) return 'NO_LOCATION';
    return SCOPES[agentId] ?? null;
  }
  async profile(agentId: string): Promise<AgentProfile | null | 'NO_LOCATION'> {
    this.lookups += 1;
    if (agentId === AGENT_NOLOC) return 'NO_LOCATION';
    const scope = SCOPES[agentId];
    if (!scope) return null;
    return { agentId, organizationId: scope.organizationId, objectName: agentId === AGENT_A ? 'Салон Тест' : 'Салон Б', greetingTail: '', voiceName: 'Leda', handoffPhone: null };
  }
  async record(scope: AgentScope, event: VoiceEvent): Promise<RecordResult> {
    const key = `${event.agentId}|${event.externalCallId}`;
    const existing = this.calls.get(key) ?? null;
    const { next, changed } = applyEvent(existing, event);
    const id = existing?.id ?? `call-${this.calls.size + 1}`;
    this.calls.set(key, { ...next, id, scope });
    let callbackCreated = false;
    if (event.callback) {
      const ck = `${id}|${event.callback.phone}`;
      if (!this.callbacks.has(ck)) {
        this.callbacks.set(ck, { phone: event.callback.phone, scope, callId: id });
        callbackCreated = true;
      }
    }
    return { callId: id, state: next.state, created: !existing, changed, callbackCreated };
  }
}

/** Соседние маршруты, как в API: ключ голоса сюда не входит */
@Access('service')
@Controller('voice')
class FakeVoiceNeighbours {
  @Get('events') read() {
    return [];
  }
  @Post('anything') write() {
    return { written: true };
  }
}
@Access('marketing')
@Controller('marketing/voice')
class FakeJournal {
  @Get('calls') calls() {
    return [];
  }
}

const repo = new FakeRepo();
let app: INestApplication;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [VoiceIngestController, FakeVoiceNeighbours, FakeJournal],
    providers: [
      { provide: AuthService, useValue: { whoami: async () => null } },
      { provide: VOICE_INGEST_REPOSITORY, useValue: repo },
      VoiceIngestService,
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  repo.calls.clear();
  repo.callbacks.clear();
  repo.lookups = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function post(key: string | null, body: unknown, env: Record<string, string> = {}) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('VOICE_INGEST_KEY', VOICE_KEY);
  vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
  vi.stubEnv('SELLER_BOOK_KEY', OTHER_KEY);
  vi.stubEnv('NODE_ENV', 'test');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const req = request(app.getHttpServer()).post('/voice/events');
  return (key ? req.set('x-wetop-service-key', key) : req).send(body as object);
}
const now = () => new Date(Date.now() - 60_000).toISOString();
const event = (over: Record<string, unknown> = {}) => ({
  agentId: AGENT_A,
  externalCallId: 'room-1',
  state: 'RECEIVED',
  occurredAt: now(),
  ...over,
});

describe('ключ VOICE_INGEST_KEY', () => {
  it('без ключа 401, неверный 401, общий служебный и чужой узкий 403; база не тронута', async () => {
    await post(null, event()).expect(401);
    await post('wrong-key', event()).expect(401);
    await post(SERVICE_KEY, event()).expect(403);
    await post(OTHER_KEY, event()).expect(403);
    expect(repo.lookups).toBe(0);
  });

  it('ключ голоса не открывает соседние пути', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('VOICE_INGEST_KEY', VOICE_KEY);
    const http = request(app.getHttpServer());
    await http.get('/voice/events').set('x-wetop-service-key', VOICE_KEY).expect(403);
    await http.post('/voice/anything').set('x-wetop-service-key', VOICE_KEY).expect(403);
    await http.get('/marketing/voice/calls').set('x-wetop-service-key', VOICE_KEY).expect(403);
  });

  it('путь проверяет ключ и без замка входа (AUTH_REQUIRED=0)', async () => {
    await post(null, event(), { AUTH_REQUIRED: '0' }).expect(401);
    await post(SERVICE_KEY, event(), { AUTH_REQUIRED: '0' }).expect(403);
    await post(VOICE_KEY, event(), { AUTH_REQUIRED: '0' }).expect(201);
  });
});

describe('приём событий', () => {
  it('создаёт звонок и отвечает без лишнего', async () => {
    const res = await post(VOICE_KEY, event({ callerMasked: '***2233' })).expect(201);
    expect(Object.keys(res.body).sort()).toEqual(['callId', 'duplicate', 'ok', 'state']);
    expect(res.body).toMatchObject({ ok: true, state: 'RECEIVED', duplicate: false });
    expect(repo.calls.size).toBe(1);
  });

  it('повтор события идемпотентен: та же строка, duplicate=true', async () => {
    const e = event();
    await post(VOICE_KEY, e).expect(201);
    const again = await post(VOICE_KEY, e).expect(201);
    expect(again.body.duplicate).toBe(true);
    expect(repo.calls.size).toBe(1);
  });

  it('просьба о звонке пишется один раз на звонок и номер', async () => {
    const cb = { phone: '8 700 111 22 33', name: 'Айдана', note: 'окрашивание' };
    await post(VOICE_KEY, event({ state: 'ANSWERED', callback: cb })).expect(201);
    const again = await post(VOICE_KEY, event({ state: 'ANSWERED', callback: cb })).expect(201);
    expect(again.body.duplicate).toBe(true);
    expect(repo.callbacks.size).toBe(1);
    expect([...repo.callbacks.values()][0]!.phone).toBe('+77001112233');
  });

  it('объект берётся из агента на сервере, а не из тела', async () => {
    await post(VOICE_KEY, event({ agentId: AGENT_B })).expect(201);
    const [call] = [...repo.calls.values()];
    expect(call!.scope).toEqual(SCOPES[AGENT_B]);
    await post(VOICE_KEY, event({ organizationId: 'org-a' })).expect(400);
  });

  it('неизвестный агент 404, агент без филиала 422, плохое тело 400', async () => {
    await post(VOICE_KEY, event({ agentId: '9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f9f' })).expect(404);
    await post(VOICE_KEY, event({ agentId: AGENT_NOLOC })).expect(422);
    await post(VOICE_KEY, event({ state: 'NOPE' })).expect(400);
    await post(VOICE_KEY, {}).expect(400);
    expect(repo.calls.size).toBe(0);
  });

  it('ошибка не раскрывает значения полей', async () => {
    const res = await post(VOICE_KEY, event({ callback: { phone: '+7700SECRETPHONE', name: 'А', note: '' } })).expect(400);
    expect(JSON.stringify(res.body)).not.toContain('SECRETPHONE');
  });
});


describe('профиль голоса по агенту: GET /voice/profile', () => {
  function get(key: string | null, query: string, env: Record<string, string> = {}) {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('VOICE_INGEST_KEY', VOICE_KEY);
    vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
    vi.stubEnv('NODE_ENV', 'test');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const req = request(app.getHttpServer()).get(`/voice/profile${query}`);
    return key ? req.set('x-wetop-service-key', key) : req;
  }

  it('тот же ключ: без ключа 401, общий служебный 403, база не тронута', async () => {
    await get(null, `?agent=${AGENT_A}`).expect(401);
    await get(SERVICE_KEY, `?agent=${AGENT_A}`).expect(403);
    expect(repo.lookups).toBe(0);
  });

  it('отдаёт профиль по агенту: объект, организация, умолчания голоса', async () => {
    const res = await get(VOICE_KEY, `?agent=${AGENT_A}`).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      agentId: AGENT_A,
      organizationId: 'org-a',
      objectName: 'Салон Тест',
      greetingTail: '',
      voiceName: 'Leda',
      handoffPhone: null,
    });
  });

  it('ответ минимален: без идентификаторов бизнеса и филиала', async () => {
    const res = await get(VOICE_KEY, `?agent=${AGENT_A}`).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['agentId', 'greetingTail', 'handoffPhone', 'objectName', 'organizationId', 'voiceName'].sort(),
    );
  });

  it('агент не найден 404, без филиала 422, не UUID или пусто 400', async () => {
    await get(VOICE_KEY, '?agent=9f9f9f9f-9f9f-49f9-89f9-9f9f9f9f9f9f').expect(404);
    await get(VOICE_KEY, `?agent=${AGENT_NOLOC}`).expect(422);
    await get(VOICE_KEY, '?agent=x').expect(400);
    await get(VOICE_KEY, '').expect(400);
  });

  it('путь проверяет ключ и без замка входа (AUTH_REQUIRED=0)', async () => {
    await get(null, `?agent=${AGENT_A}`, { AUTH_REQUIRED: '0' }).expect(401);
    await get(VOICE_KEY, `?agent=${AGENT_A}`, { AUTH_REQUIRED: '0' }).expect(200);
  });
});
