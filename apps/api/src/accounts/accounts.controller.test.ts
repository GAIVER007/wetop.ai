import 'reflect-metadata';
process.env.SESSION_SECRET ??= 'секрет-для-прогона';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_CODES_PER_IP_PER_HOUR,
  REGISTRATION_EMAIL_MESSAGE,
  REGISTRATION_NAME_MESSAGE,
  TRIAL_DAYS,
} from '@pms/domain';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { ACCOUNT, FakeAccountsRepository } from './fake-repository';
import { SESSION_COOKIE } from './cookie';

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

/** Вытаскивает код из письма, которое ушло в заглушку. Снаружи его узнать неоткуда — и правильно. */
function codeFromLetter(): string {
  const text = sender.last?.text ?? '';
  const m = /Код для входа: (\d{6})/.exec(text);
  if (!m) throw new Error(`в письме нет кода: ${text}`);
  return m[1]!;
}

async function login(): Promise<string> {
  await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email }).expect(204);
  const res = await request(app.getHttpServer())
    .post('/auth/verify')
    .send({ email: ACCOUNT.email, code: codeFromLetter() })
    .expect(200);
  return res.body.token as string;
}

describe('запрос кода: ответ ничего не выдаёт', () => {
  it('знакомый адрес — 204, письмо ушло', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email }).expect(204);
    expect(sender.sent).toHaveLength(1);
    expect(sender.last?.to).toBe(ACCOUNT.email);
  });

  it('незнакомый адрес — тот же 204, но письма нет и код в базе не заводится', async () => {
    await request(app.getHttpServer())
      .post('/auth/code')
      .send({ email: 'chuzhoy@example.com' })
      .expect(204);
    expect(sender.sent).toHaveLength(0);
    expect(repo.codes).toHaveLength(0);
  });

  it('адрес в другом регистре и с пробелами — тот же человек', async () => {
    await request(app.getHttpServer())
      .post('/auth/code')
      .send({ email: '  URIJ@Example.COM ' })
      .expect(204);
    expect(sender.sent).toHaveLength(1);
  });

  it('мусор вместо адреса — тот же 204, без письма', async () => {
    for (const email of ['не почта', '', 42, null, undefined]) {
      await request(app.getHttpServer()).post('/auth/code').send({ email }).expect(204);
    }
    expect(sender.sent).toHaveLength(0);
  });

  it('тело без поля email не роняет ручку', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({}).expect(204);
  });
});

describe('запрос кода: пределы', () => {
  it(`после ${MAX_CODES_PER_EMAIL_PER_HOUR} кодов на адрес письма перестают уходить, ответ прежний`, async () => {
    for (let i = 0; i < MAX_CODES_PER_EMAIL_PER_HOUR + 3; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/code')
        .send({ email: ACCOUNT.email })
        .expect(204);
    }
    expect(sender.sent).toHaveLength(MAX_CODES_PER_EMAIL_PER_HOUR);
  });

  it('предел по сети считается по CF-Connecting-IP, а не по адресу соединения', async () => {
    repo.accounts = [
      ACCOUNT,
      ...Array.from({ length: MAX_CODES_PER_IP_PER_HOUR + 2 }, (_, i) => ({
        ...ACCOUNT,
        userId: `u-${i + 2}`,
        email: `gost${i}@example.com`,
      })),
    ];
    for (let i = 0; i < MAX_CODES_PER_IP_PER_HOUR + 2; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/code')
        .set('CF-Connecting-IP', '203.0.113.7')
        .send({ email: `gost${i}@example.com` })
        .expect(204);
    }
    expect(sender.sent).toHaveLength(MAX_CODES_PER_IP_PER_HOUR);
  });
});

describe('регистрация', () => {
  const NEW = { email: 'novyj@example.com', organizationName: 'Хостел «Новый»' };

  it('новый адрес — 204, заведены организация в TRIAL, человек и членство, ушёл код', async () => {
    const before = Date.now();
    await request(app.getHttpServer()).post('/auth/register').send(NEW).expect(204);
    const account = repo.accounts.find((a) => a.email === NEW.email);
    expect(account).toBeDefined();
    expect(account?.organizationName).toBe(NEW.organizationName);
    expect(account?.organizationStatus).toBe('TRIAL');
    const trialMs = (account?.trialEndsAt?.getTime() ?? 0) - before;
    expect(trialMs).toBeGreaterThanOrEqual(TRIAL_DAYS * 24 * 60 * 60 * 1000 - 5000);
    expect(trialMs).toBeLessThanOrEqual(TRIAL_DAYS * 24 * 60 * 60 * 1000 + 5000);
    expect(sender.sent).toHaveLength(1);
    expect(sender.last?.to).toBe(NEW.email);
  });

  it('кодом из письма после регистрации можно сразу войти — в свою новую организацию', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(NEW).expect(204);
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: NEW.email, code: codeFromLetter() })
      .expect(200);
    expect(res.body.session.organizationName).toBe(NEW.organizationName);
    expect(res.body.session.organizationStatus).toBe('TRIAL');
    expect(res.body.session.trialEndsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('занятый адрес — тот же 204 и тот же код в письме, но новой организации нет', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ACCOUNT.email, organizationName: 'Чужая контора' })
      .expect(204);
    expect(repo.accounts).toHaveLength(1);
    expect(repo.accounts[0]?.organizationName).toBe(ACCOUNT.organizationName);
    expect(sender.sent).toHaveLength(1);
    expect(sender.last?.to).toBe(ACCOUNT.email);
  });

  it('почта приводится к нижнему регистру, название — к одному пробелу между словами', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: '  Novyj@Example.COM ', organizationName: '  Хостел   «Новый» ' })
      .expect(204);
    const account = repo.accounts.find((a) => a.email === NEW.email);
    expect(account?.organizationName).toBe('Хостел «Новый»');
  });

  it('строка, не похожая на почту, — 400 с понятным текстом', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'не почта', organizationName: 'Хостел' })
      .expect(400);
    expect(res.body.message).toBe(REGISTRATION_EMAIL_MESSAGE);
    expect(repo.accounts).toHaveLength(1);
  });

  it('пустое название — 400 с понятным текстом, организация не заводится', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: NEW.email, organizationName: '   ' })
      .expect(400);
    expect(res.body.message).toBe(REGISTRATION_NAME_MESSAGE);
    expect(repo.accounts).toHaveLength(1);
    expect(sender.sent).toHaveLength(0);
  });

  it('тело без полей — 400, а не 500', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({}).expect(400);
  });

  it('предел на адрес сети действует и на регистрацию: организации сверх предела не заводятся', async () => {
    for (let i = 0; i < MAX_CODES_PER_IP_PER_HOUR + 3; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('CF-Connecting-IP', '203.0.113.9')
        .send({ email: `reg${i}@example.com`, organizationName: `Контора ${i}` })
        .expect(204);
    }
    // ACCOUNT плюс ровно столько новых, сколько разрешено кодов с одного адреса за час.
    expect(repo.accounts).toHaveLength(1 + MAX_CODES_PER_IP_PER_HOUR);
    expect(sender.sent).toHaveLength(MAX_CODES_PER_IP_PER_HOUR);
  });

  it('заблокированный или бесхозный адрес: организации нет, письма нет, ответ прежний', async () => {
    // Фейк: адрес занят в users, но accountByEmail его не отдаёт — как у BLOCKED в настоящей базе.
    repo.accounts = [ACCOUNT, { ...ACCOUNT, userId: 'u-blocked', email: 'blocked@example.com' }];
    const original = repo.accountByEmail.bind(repo);
    repo.accountByEmail = async (email) => (email === 'blocked@example.com' ? null : original(email));
    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'blocked@example.com', organizationName: 'Ещё раз' })
        .expect(204);
      expect(repo.accounts).toHaveLength(2);
      expect(sender.sent).toHaveLength(0);
    } finally {
      repo.accountByEmail = original;
    }
  });
});

describe('проверка кода', () => {
  it('верный код пускает и выдаёт ключ', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code: codeFromLetter() })
      .expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.session.email).toBe(ACCOUNT.email);
    expect(res.body.session.organizationName).toBe(ACCOUNT.organizationName);
  });

  it('ключ ставится кукой HttpOnly — чужой скрипт на странице его не прочитает', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code: codeFromLetter() })
      .expect(200);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(SESSION_COOKIE),
    );
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('сам код в базе не лежит — только отпечаток', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const code = codeFromLetter();
    expect(repo.codes[0]!.codeHash).not.toContain(code);
    expect(repo.codes[0]!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ключ сессии в базе не лежит — только отпечаток', async () => {
    const token = await login();
    expect(repo.sessions[0]!.tokenHash).not.toBe(token);
    expect(repo.sessions[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('неверный код — 401 и всегда один и тот же текст', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code: '000000' })
      .expect(401);
    expect(res.body.message).toBe('Код не подошёл. Запросите новый.');
  });

  it('по тексту отказа не отличить «нет такого адреса» от «не тот код»', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: 'chuzhoy@example.com', code: '123456' })
      .expect(401);
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const wrong = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code: '000000' })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('после трёх промахов код мёртв, даже если потом ввести верный', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const code = codeFromLetter();
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ email: ACCOUNT.email, code: '000000' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code })
      .expect(401);
  });

  it('использованный код второй раз не пускает', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const code = codeFromLetter();
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code })
      .expect(401);
  });

  it('протухший код не пускает и не тратит попытку', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    const code = codeFromLetter();
    repo.codes[0]!.expiresAt = new Date(Date.now() - 1000);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email: ACCOUNT.email, code })
      .expect(401);
    expect(repo.codes[0]!.attempts).toBe(0);
  });

  it('код не той формы отвергается, не заглядывая в базу', async () => {
    await request(app.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email });
    for (const code of ['12345', '1234567', 'абвгде', '', null]) {
      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ email: ACCOUNT.email, code })
        .expect(401);
    }
    expect(repo.codes[0]!.attempts).toBe(0);
  });

  it('вход отмечается у пользователя', async () => {
    await login();
    expect(repo.logins).toHaveLength(1);
    expect(repo.logins[0]!.userId).toBe(ACCOUNT.userId);
  });
});

describe('кто вошёл и выход', () => {
  it('по ключу в заголовке видно, кто вошёл', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(ACCOUNT.email);
    expect(res.body.organizationStatus).toBe('TRIAL');
    expect(res.body.trialEndsAt).toBe(ACCOUNT.trialEndsAt!.toISOString());
  });

  it('кука работает так же, как заголовок', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${SESSION_COOKIE}=${token}`)
      .expect(200);
    expect(res.body.email).toBe(ACCOUNT.email);
  });

  it('без ключа — 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('чужой или выдуманный ключ — 401', async () => {
    // Ключ только из латиницы, цифр, «-» и «_» (newSessionToken, base64url): кириллица в
    // заголовке HTTP недопустима, и запрос с ней не дойдёт даже до нашего кода.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ne-nash-klyuch-0000000000000000000000')
      .expect(401);
  });

  it('заголовок не той схемы не считается ключом', async () => {
    const token = await login();
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Basic ${token}`)
      .expect(401);
  });

  it('после выхода прежний ключ мёртв', async () => {
    const token = await login();
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('выход гасит куку', async () => {
    const token = await login();
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(SESSION_COOKIE),
    );
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
  });

  it('повторный выход — не ошибка', async () => {
    const token = await login();
    await request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('выход без ключа — тоже не ошибка', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(204);
  });

  it('протухшая сессия не пускает', async () => {
    const token = await login();
    repo.sessions[0]!.expiresAt = new Date(Date.now() - 1000);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});

describe('почта не настроена', () => {
  it('код всё равно заводится, API не падает — в журнале видно, что письмо не ушло', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        AccountsService,
        { provide: ACCOUNTS_REPOSITORY, useValue: repo },
        { provide: 'MAIL_SENDER', useValue: new mail.StubMailSender() },
        { provide: 'MAIL_CONFIG_PRESENT', useValue: false },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    const noMail = moduleRef.createNestApplication();
    await noMail.init();
    await request(noMail.getHttpServer()).post('/auth/code').send({ email: ACCOUNT.email }).expect(204);
    expect(repo.codes).toHaveLength(1);
    await noMail.close();
  });
});
