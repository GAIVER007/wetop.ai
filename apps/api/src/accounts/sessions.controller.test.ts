import 'reflect-metadata';
process.env.SESSION_SECRET ??= 'секрет-для-прогона';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_ENDED_MESSAGE, hashSessionToken } from '@pms/domain';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { ACCOUNT, FakeAccountsRepository } from './fake-repository';
import { SESSION_COOKIE } from './cookie';

/**
 * Срез 13, §3 п. 3 плана: список активных сессий («где я вошёл») и «выйти везде»
 * (DATA_MODEL §13.5: `user_agent` — для списка, `revoked_at` — всем строкам человека).
 */
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36';
const PHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';

let app: INestApplication;
let repo: FakeAccountsRepository;
let sender: mail.StubMailSender;

beforeAll(async () => {
  repo = new FakeAccountsRepository();
  sender = new mail.StubMailSender();
  const moduleRef = await Test.createTestingModule({
    controllers: [AccountsController],
    providers: [
      AccountsService,
      { provide: ACCOUNTS_REPOSITORY, useValue: repo },
      { provide: 'MAIL_SENDER', useValue: sender },
      { provide: 'MAIL_CONFIG_PRESENT', useValue: true },
      { provide: PrismaService, useValue: {} },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  repo.codes.length = 0;
  repo.sessions.length = 0;
  repo.logins.length = 0;
  repo.accounts = [ACCOUNT];
  sender.clear();
});

function codeFromLetter(): string {
  const m = /Код для входа: (\d{6})/.exec(sender.last?.text ?? '');
  if (!m) throw new Error('в письме нет кода');
  return m[1]!;
}

async function login(userAgent: string, email = ACCOUNT.email): Promise<string> {
  await request(app.getHttpServer()).post('/auth/code').send({ email }).expect(204);
  const res = await request(app.getHttpServer())
    .post('/auth/verify')
    .set('User-Agent', userAgent)
    .send({ email, code: codeFromLetter() })
    .expect(200);
  return res.body.token as string;
}

describe('список сессий', () => {
  it('без сессии — 401', async () => {
    const res = await request(app.getHttpServer()).get('/auth/sessions');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(SESSION_ENDED_MESSAGE);
  });

  it('вошедший видит свои живые сессии словами, свою — с пометкой; ключей и отпечатков нет', async () => {
    const mac = await login(MAC);
    const phone = await login(PHONE);
    const res = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${mac}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
    const byDevice = Object.fromEntries(
      (res.body as Array<{ device: string; current: boolean }>).map((s) => [s.device, s.current]),
    );
    expect(byDevice).toEqual({ 'Chrome, macOS': true, 'Safari, iPhone': false });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(mac);
    expect(text).not.toContain(phone);
    expect(text).not.toMatch(/tokenHash|token_hash/);
    for (const s of res.body as Array<{ issuedAt: string; expiresAt: string }>) {
      expect(Number.isFinite(Date.parse(s.issuedAt))).toBe(true);
      expect(Number.isFinite(Date.parse(s.expiresAt))).toBe(true);
    }
  });

  it('отозванная и чужая сессии в списке не показываются', async () => {
    const mac = await login(MAC);
    const phone = await login(PHONE);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${phone}`)
      .expect(204);
    repo.accounts.push({ ...ACCOUNT, userId: 'u-other', email: 'drugoy@example.com' });
    await login(MAC, 'drugoy@example.com');
    const res = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${mac}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].current).toBe(true);
  });
});

describe('выйти везде', () => {
  it('гасит все сессии человека, чужие не трогает; кука снята; повтор с мёртвым ключом — 204', async () => {
    const mac = await login(MAC);
    const phone = await login(PHONE);
    repo.accounts.push({ ...ACCOUNT, userId: 'u-other', email: 'drugoy@example.com' });
    const other = await login(MAC, 'drugoy@example.com');

    const res = await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${mac}`)
      .expect(204);
    const cookie = String(res.headers['set-cookie'] ?? '');
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);

    for (const dead of [mac, phone]) {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${dead}`)
        .expect(401);
    }
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${other}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${mac}`)
      .expect(204);
  });

  it('без сессии — 204 и ничего не отозвано', async () => {
    await login(MAC);
    await request(app.getHttpServer()).post('/auth/logout-all').expect(204);
    expect(repo.sessions.filter((s) => s.revokedAt !== null)).toHaveLength(0);
  });
});

describe('оба входа рядом (Q-146)', () => {
  it('сессия по паролю (отпечаток SHA-256, ADR-049) видит список, помечена своей и гасит всё, включая сессию по коду', async () => {
    const mac = await login(MAC);
    const parol = 'parol-session-token';
    await repo.createSession({
      tokenHash: hashSessionToken(parol),
      userId: ACCOUNT.userId,
      organizationId: ACCOUNT.organizationId,
      expiresAt: new Date(Date.now() + 12 * 3600_000),
      userAgent: PHONE,
    });
    const res = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${parol}`)
      .expect(200);
    const byDevice = Object.fromEntries(
      (res.body as Array<{ device: string; current: boolean }>).map((s) => [s.device, s.current]),
    );
    expect(byDevice).toEqual({ 'Chrome, macOS': false, 'Safari, iPhone': true });

    await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${parol}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${mac}`)
      .expect(401);
  });
});
