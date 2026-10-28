import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { PLATFORM_ADMIN_ONLY } from './admin';
import { CabinetController } from './cabinet.controller';
import { CABINET_REPOSITORY } from './cabinet.repository';
import type { CabinetSource } from './cabinet';

/** Кабинет компании WETOP: только главный администратор; своя организация в клиенты не попадает */
const OWN = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const CLIENT = '6e3a2b0f-9d8c-4f4b-b2a1-7c0d3e5f9a11';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';

const asked: Array<{ ownOrganizationId: string | null }> = [];
const repo = {
  async source(input: { since30d: Date; ownOrganizationId: string | null }): Promise<CabinetSource> {
    asked.push({ ownOrganizationId: input.ownOrganizationId });
    const base = { trialEndsAt: null, createdAt: new Date('2026-09-01T00:00:00Z'), locations: 1, verticals: ['HOSPITALITY' as const] };
    return {
      organizations: [
        { ...base, id: OWN, name: 'WETOP', status: 'TRIAL', members: [] },
        {
          ...base,
          id: CLIENT,
          name: 'Клиент',
          status: 'ACTIVE',
          members: [{ email: 'boss@example.invalid', owner: true, lastLoginAt: new Date() }],
        },
      ],
      records30d: [{ organizationId: CLIENT, count: 4 }],
      ownOrganizationId: input.ownOrganizationId,
    };
  },
};

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
        ? {
            user: { ...who, organizationId: OWN, email: `${who.id.slice(0, 4)}@example.invalid`, name: null },
            organization: null,
            expiresAt: '2026-12-26T00:00:00.000Z',
          }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [CabinetController],
    providers: [
      { provide: CABINET_REPOSITORY, useValue: repo },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  asked.length = 0;
});

const api = () => request(app.getHttpServer());
const as = (session: string) => ({ 'x-wetop-session': session });

describe('GET /platform/cabinet', () => {
  it('владелец организации без отметки: 403; без входа: 401', async () => {
    const res = await api().get('/platform/cabinet').set(as('session-owner')).expect(403);
    expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    await api().get('/platform/cabinet').expect(401);
  });

  it('главному администратору: клиенты без своей организации, путь клиента, записи за 30 дней', async () => {
    const res = await api().get('/platform/cabinet').set(as('session-admin')).expect(200);
    expect(asked).toEqual([{ ownOrganizationId: OWN }]);
    expect(res.body.clients.map((c: { name: string }) => c.name)).toEqual(['Клиент']);
    expect(res.body.clients[0]).toMatchObject({ records30d: 4, owner: 'boss@example.invalid' });
    expect(res.body.funnel).toMatchObject({ paying: 1, trial: 0 });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
