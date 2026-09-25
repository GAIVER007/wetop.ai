import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ExtensionsService } from '../platform/extensions.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';

/**
 * `/auth/me` говорит стойке, что открыто организации вошедшего (ADR-083): по нему меню показывает «ИИ-продавца» и
 * «Платформу», а раздел — напоминание о сроке. Без сессии — только `user: null`, ни слова о расширениях.
 */
const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
let app: INestApplication;
const asked: string[] = [];

beforeAll(async () => {
  const auth = {
    whoami: vi.fn(async (token: string) =>
      token === 'good'
        ? {
            user: {
              id: 'u-1',
              email: 'vladelec@example.invalid',
              name: null,
              organizationId: ORG,
              role: 'OWNER',
              platformAdmin: true,
            },
            organization: { name: 'Хостел', status: 'ACTIVE', trialEndsAt: null },
            expiresAt: '2026-09-26T00:00:00.000Z',
          }
        : null,
    ),
  };
  const extensions = {
    aiSeller: vi.fn(async (organizationId: string) => {
      asked.push(organizationId);
      return { access: 'active', status: 'ACTIVE', activeUntil: null, daysLeft: null };
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: ExtensionsService, useValue: extensions },
      { provide: PasswordResetService, useValue: {} },
      { provide: EmailVerificationService, useValue: {} },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('GET /auth/me — что открыто организации вошедшего', () => {
  it('роль, отметка главного администратора и «ИИ-продавец» организации сессии', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').set('x-wetop-session', 'good').expect(200);
    expect(res.body.user).toMatchObject({ role: 'OWNER', platformAdmin: true });
    expect(res.body.access).toEqual({
      aiSeller: { access: 'active', status: 'ACTIVE', activeUntil: null, daysLeft: null },
    });
    expect(asked).toEqual([ORG]);
  });

  it('без сессии — никто и ни слова о расширениях', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').expect(200);
    expect(res.body).toEqual({ user: null });
  });
});
