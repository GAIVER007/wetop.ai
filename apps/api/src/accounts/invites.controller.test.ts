import 'reflect-metadata';
process.env.SESSION_SECRET ??= 'секрет-для-прогона';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVITE_ALREADY_MEMBER_MESSAGE,
  INVITE_EMAIL_MESSAGE,
  INVITE_INVALID_MESSAGE,
  INVITE_STAFF_ONLY_MESSAGE,
  INVITE_TTL_MS,
  SESSION_ENDED_MESSAGE,
  hashSessionToken,
} from '@pms/domain';
import { mail } from '@pms/integrations';
import { hashSecret } from '@pms/shared';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { ACCOUNT, FakeAccountsRepository } from './fake-repository';

/**
 * Срез 13, этап 7: приглашения в организацию (DATA_MODEL §13.6, ADR-046, ролей нет — ADR-023).
 *
 * Пригласить может только вошедший; письмо несёт ссылку на 7 суток, в базе — только отпечаток ключа;
 * принятие создаёт человека и членство и выдаёт ключ «задайте пароль»: вход остаётся одним путём.
 */
const APP_URL = 'https://app.example.com';
const INVITEE = 'novyj@example.com';

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
      { provide: 'APP_URL', useValue: APP_URL },
      { provide: PrismaService, useValue: {} },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.listen(0, '127.0.0.1');
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  repo.sessions.length = 0;
  repo.logins.length = 0;
  repo.invites.length = 0;
  repo.accounts = [ACCOUNT];
  repo.userLocales.clear();
  sender.clear();
});

function linkFromLetter(to: string): string {
  const text = sender.to(to).at(-1)?.text ?? '';
  const m = /(https?:\/\/\S+\/invite\/\S+)/.exec(text);
  if (!m) throw new Error(`в письме на ${to} нет ссылки: ${text}`);
  return m[1]!;
}

/**
 * Сессию заводим прямо в подставном репозитории: входа по коду больше нет (ADR-053), а вход по
 * паролю живёт в AuthService — этому контроллеру он не подчиняется. Отпечаток тот же, SHA-256.
 */
async function login(): Promise<string> {
  const token = 'invites-session-token';
  await repo.createSession({
    tokenHash: hashSessionToken(token),
    userId: ACCOUNT.userId,
    organizationId: ACCOUNT.organizationId,
    expiresAt: new Date(Date.now() + 12 * 3600_000),
    userAgent: null,
  });
  return token;
}

/** Не `async`: наружу нужен сам запрос supertest с его `.expect`, а не обещание вокруг него. */
function invite(token: string, email: unknown) {
  return request(app.getHttpServer())
    .post('/auth/invites')
    .set('Authorization', `Bearer ${token}`)
    .send({ email });
}

describe('приглашение: владелец и управляющий, не администратор (DATA_MODEL §16.5, ADR-107)', () => {
  it('администратор получает 403 и на создание, и на список; письма и приглашения нет', async () => {
    repo.accounts = [{ ...ACCOUNT, role: 'STAFF' }];
    const token = await login();
    const created = await invite(token, INVITEE);
    expect(created.status).toBe(403);
    expect(created.body.message).toBe(INVITE_STAFF_ONLY_MESSAGE);
    const listed = await request(app.getHttpServer())
      .get('/auth/invites')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(403);
    expect(sender.sent).toHaveLength(0);
    expect(repo.invites).toHaveLength(0);
  });

  it('владелец приглашает как прежде', async () => {
    const token = await login();
    expect((await invite(token, INVITEE)).status).toBe(201);
  });
});

describe('приглашение: только для вошедшего', () => {
  it('без сессии — 401 и на создание, и на список', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/invites')
      .send({ email: INVITEE });
    expect(created.status).toBe(401);
    expect(created.body.message).toBe(SESSION_ENDED_MESSAGE);
    const listed = await request(app.getHttpServer()).get('/auth/invites');
    expect(listed.status).toBe(401);
    expect(sender.sent).toHaveLength(0);
    expect(repo.invites).toHaveLength(0);
  });
});

describe('приглашение: создание и список', () => {
  it('вошедший зовёт по почте: 201, письмо со ссылкой на 7 суток, в базе только отпечаток', async () => {
    const token = await login();
    const res = await invite(token, `  ${INVITEE.toUpperCase()} `).expect(201);
    expect(res.body.email).toBe(INVITEE);
    expect(new Date(res.body.expiresAt).getTime() - Date.now()).toBeGreaterThan(
      INVITE_TTL_MS - 60_000,
    );

    const link = linkFromLetter(INVITEE);
    expect(link.startsWith(`${APP_URL}/invite/`)).toBe(true);
    const rawToken = link.slice(`${APP_URL}/invite/`.length);
    expect(rawToken.length).toBeGreaterThanOrEqual(32);
    expect(repo.invites).toHaveLength(1);
    expect(repo.invites[0]!.tokenHash).toBe(hashSecret(rawToken));
    expect(repo.invites[0]!.tokenHash).not.toBe(rawToken);
    expect(repo.invites[0]!.createdBy).toBe(ACCOUNT.userId);
    expect(repo.invites[0]!.organizationId).toBe(ACCOUNT.organizationId);
    expect(sender.to(INVITEE).at(-1)?.text).toContain(ACCOUNT.organizationName);

    const listed = await request(app.getHttpServer())
      .get('/auth/invites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].email).toBe(INVITEE);
    expect(listed.body[0].acceptedAt).toBeNull();
    // ключ и отпечаток наружу не едут
    expect(JSON.stringify(listed.body)).not.toContain(rawToken);
    expect(JSON.stringify(listed.body)).not.toContain(repo.invites[0]!.tokenHash);
  });

  it('не почта — 400 с текстом; уже в организации — 400 с текстом; письма нет', async () => {
    const token = await login();
    const bad = await invite(token, 'не почта').expect(400);
    expect(bad.body.message).toBe(INVITE_EMAIL_MESSAGE);
    const member = await invite(token, ACCOUNT.email).expect(400);
    expect(member.body.message).toBe(INVITE_ALREADY_MEMBER_MESSAGE);
    expect(sender.sent.filter((m) => m.to !== ACCOUNT.email)).toHaveLength(0);
    expect(repo.invites).toHaveLength(0);
  });
});

describe('приглашение: проверка и принятие по ссылке', () => {
  it('одновременное принятие выдаёт доступ и ссылку на пароль только одному запросу', async () => {
    await invite(await login(), INVITEE).expect(201);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;
    const service = app.get(AccountsService);
    const results = await Promise.all([
      service.acceptInvite(rawToken),
      service.acceptInvite(rawToken),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('по ключу видно, кто зовёт и кого; чужой ключ — 404 одним текстом', async () => {
    const token = await login();
    await invite(token, INVITEE).expect(201);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;

    const seen = await request(app.getHttpServer()).get(`/auth/invites/${rawToken}`).expect(200);
    expect(seen.body.organizationName).toBe(ACCOUNT.organizationName);
    expect(seen.body.email).toBe(INVITEE);

    const unknown = await request(app.getHttpServer()).get('/auth/invites/net-takogo').expect(404);
    expect(unknown.body.message).toBe(INVITE_INVALID_MESSAGE);
  });

  it('принятие: членство заведено, выдан ключ «задайте пароль», письма нет; второй раз — 404', async () => {
    const token = await login();
    await invite(token, INVITEE).expect(201);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;

    const accepted = await request(app.getHttpServer())
      .post(`/auth/invites/${rawToken}/accept`)
      .expect(200);
    expect(accepted.body.email).toBe(INVITEE);
    expect(accepted.body.organizationName).toBe(ACCOUNT.organizationName);
    expect(repo.invites[0]!.acceptedAt).not.toBeNull();
    expect(await repo.accountByEmail(INVITEE)).toMatchObject({
      email: INVITEE,
      organizationId: ACCOUNT.organizationId,
    });

    // С 20.09.2026 вход один — по паролю (ADR-053). Кода на почту здесь больше нет: приглашённый
    // получает одноразовый ключ прямо в ответе и задаёт себе пароль сам. Письма в этом пути нет —
    // значит принятие работает и когда почтовая служба не настроена, а она может быть не настроена.
    expect(typeof accepted.body.setPasswordToken).toBe('string');
    expect(accepted.body.setPasswordToken.length).toBeGreaterThan(20);
    // писем приглашённому ровно одно — само приглашение; принятие второго письма не шлёт (ADR-053)
    expect(sender.to(INVITEE), 'принятие письма не шлёт').toHaveLength(1);
    // в базе — только отпечаток ключа, сам ключ не хранится
    expect(repo.passwordSetTokens).toHaveLength(1);
    expect(repo.passwordSetTokens[0]!.email).toBe(INVITEE);
    expect(JSON.stringify(repo.passwordSetTokens)).not.toContain(accepted.body.setPasswordToken);

    const again = await request(app.getHttpServer())
      .post(`/auth/invites/${rawToken}/accept`)
      .expect(404);
    expect(again.body.message).toBe(INVITE_INVALID_MESSAGE);
  });

  it('просроченная ссылка — 404 и на просмотр, и на принятие; членства нет', async () => {
    const token = await login();
    await invite(token, INVITEE).expect(201);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;
    repo.invites[0]!.expiresAt = new Date(Date.now() - 1000);

    await request(app.getHttpServer()).get(`/auth/invites/${rawToken}`).expect(404);
    await request(app.getHttpServer()).post(`/auth/invites/${rawToken}/accept`).expect(404);
    expect(await repo.accountByEmail(INVITEE)).toBeNull();
  });
});

/**
 * Аудит 26.09, С-10 и С-11: приглашение нельзя было отозвать — опечатка в адресе оставляла постороннему ссылку на 7
 * суток; а число приглашений не ограничивалось, и письма с проверенного домена WETOP уходили на любые адреса.
 */
describe('приглашение: отзыв и предел в сутки', () => {
  it('владелец отзывает приглашение: его нет в списке, а ссылка больше не открывается', async () => {
    const token = await login();
    const created = await invite(token, INVITEE);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;
    const revoked = await request(app.getHttpServer())
      .delete(`/auth/invites/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(revoked.status).toBe(200);
    const listed = await request(app.getHttpServer())
      .get('/auth/invites')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.body).toHaveLength(0);
    expect((await request(app.getHttpServer()).get(`/auth/invites/${rawToken}`)).status).toBe(404);
    expect(
      (await request(app.getHttpServer()).post(`/auth/invites/${rawToken}/accept`)).status,
    ).toBe(404);
  });

  it('сотрудник не отзывает, чужое приглашение — 404', async () => {
    const token = await login();
    const created = await invite(token, INVITEE);
    repo.accounts = [{ ...ACCOUNT, role: 'STAFF' }];
    const byStaff = await request(app.getHttpServer())
      .delete(`/auth/invites/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(byStaff.status).toBe(403);
    repo.accounts = [ACCOUNT];
    repo.invites[0]!.organizationId = 'чужая-организация';
    const foreign = await request(app.getHttpServer())
      .delete(`/auth/invites/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(foreign.status).toBe(404);
  });

  it('больше 20 приглашений за сутки — 429 словами, письма нет', async () => {
    const token = await login();
    for (let i = 0; i < 20; i += 1) {
      expect((await invite(token, `gost-${i}@example.com`)).status).toBe(201);
    }
    const over = await invite(token, 'lishnij@example.com');
    expect(over.status).toBe(429);
    expect(over.body.message).toMatch(/приглашений/);
    expect(sender.to('lishnij@example.com')).toHaveLength(0);
  });
});

it('сбой почты не выдаётся за отправленное приглашение и ссылка отозвана', async () => {
  const token = await login();
  const send = vi.spyOn(sender, 'send').mockRejectedValueOnce(new Error('synthetic mail failure'));
  try {
    const result = await invite(token, INVITEE);
    expect(result.status).toBe(503);
    const pending = await request(app.getHttpServer())
      .get('/auth/invites')
      .set('Authorization', `Bearer ${token}`);
    expect(pending.body).toEqual([]);
  } finally {
    send.mockRestore();
  }
});

/** Язык организации (ORG-LOCALE-20261026): салон на английском зовёт по-английски от письма до первого входа */
describe('приглашение: язык организации', () => {
  it('английская организация: письмо, страница по ссылке и язык нового человека английские', async () => {
    repo.organizationLocales.set(ACCOUNT.organizationId, 'en');
    try {
      await (async () => {
        const token = await login();
        await request(app.getHttpServer())
          .post('/auth/invites')
          .set('Authorization', `Bearer ${token}`)
          .send({ email: INVITEE, role: 'STAFF' })
          .expect(201);
      })();
      const letter = sender.to(INVITEE).at(-1)!;
      expect(letter.subject).toBe('Invitation to WETOP');
      expect(letter.text).toContain('Role: administrator.');
      const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;
      const seen = await request(app.getHttpServer()).get(`/auth/invites/${rawToken}`).expect(200);
      expect(seen.body.locale).toBe('en');
      const accepted = await request(app.getHttpServer())
        .post(`/auth/invites/${rawToken}/accept`)
        .expect(200);
      expect(accepted.body.locale).toBe('en');
      expect(repo.userLocales.get(INVITEE)).toBe('en');
    } finally {
      repo.organizationLocales.clear();
    }
  });

  it('русская организация: письмо и страница как раньше, язык нового человека русский', async () => {
    const token = await login();
    await invite(token, INVITEE).expect(201);
    expect(sender.to(INVITEE).at(-1)!.subject).toBe(mail.INVITE_SUBJECT);
    const rawToken = linkFromLetter(INVITEE).split('/invite/')[1]!;
    const seen = await request(app.getHttpServer()).get(`/auth/invites/${rawToken}`).expect(200);
    expect(seen.body.locale).toBe('ru');
    await request(app.getHttpServer()).post(`/auth/invites/${rawToken}/accept`).expect(200);
    expect(repo.userLocales.get(INVITEE)).toBe('ru');
  });
});

/**
 * Владелец 30.10.2026: «отправить на почту и скопировать ссылку приглашения». Ссылку можно скопировать и отправить в
 * WhatsApp только для «Личного кабинета» (EMPLOYEE): видит только своё. Администратор и управляющий получают ссылку
 * только письмом, у них касса и клиенты. В базе по-прежнему только отпечаток: «Новая ссылка» гасит старую.
 */
describe('ссылка приглашения: почта и «Скопировать ссылку»', () => {
  const create = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/invites').set('Authorization', `Bearer ${token}`).send(body);
  const issue = (token: string, id: string) =>
    request(app.getHttpServer()).post(`/auth/invites/${id}/link`).set('Authorization', `Bearer ${token}`).send({});
  const tokenOf = (link: string) => link.split('/invite/')[1]!;

  it('«Личный кабинет» только ссылкой: ссылка в ответе, письма нет, ссылка открывается', async () => {
    const token = await login();
    const res = await create(token, { email: INVITEE, role: 'EMPLOYEE', delivery: 'link' }).expect(201);
    expect(res.body.link).toMatch(new RegExp(`^${APP_URL}/invite/\\S+$`));
    expect(sender.sent).toHaveLength(0);
    await request(app.getHttpServer()).get(`/auth/invites/${tokenOf(res.body.link)}`).expect(200);
  });

  it('«Почта и ссылка»: письмо ушло и та же ссылка в ответе', async () => {
    const token = await login();
    const res = await create(token, { email: INVITEE, role: 'EMPLOYEE', delivery: 'both' }).expect(201);
    expect(linkFromLetter(INVITEE)).toBe(res.body.link);
  });

  it('по умолчанию как раньше: только письмо, ссылки в ответе нет', async () => {
    const token = await login();
    const res = await create(token, { email: INVITEE, role: 'EMPLOYEE' }).expect(201);
    expect(res.body.link).toBeUndefined();
    expect(sender.to(INVITEE)).toHaveLength(1);
  });

  it('администратору и управляющему ссылкой нельзя: только письмо, приглашения нет', async () => {
    const token = await login();
    for (const role of ['STAFF', 'MANAGER']) {
      const res = await create(token, { email: INVITEE, role, delivery: 'link' }).expect(400);
      expect(res.body.message).toBe('Ссылкой приглашают только в «Личный кабинет». Администратору и управляющему приглашение уходит на почту.');
    }
    expect(repo.invites).toHaveLength(0);
    expect(sender.sent).toHaveLength(0);
  });

  it('«Новая ссылка»: старая перестаёт открываться, новая открывается; письмо не уходит', async () => {
    const token = await login();
    const first = await create(token, { email: INVITEE, role: 'EMPLOYEE', delivery: 'link' }).expect(201);
    const next = await issue(token, first.body.id).expect(201);
    expect(next.body.link).not.toBe(first.body.link);
    await request(app.getHttpServer()).get(`/auth/invites/${tokenOf(first.body.link)}`).expect(404);
    await request(app.getHttpServer()).get(`/auth/invites/${tokenOf(next.body.link)}`).expect(200);
    expect(sender.sent).toHaveLength(0);
  });

  it('«Новая ссылка» администратора не выдаётся, отозванного и чужого тоже нет', async () => {
    const token = await login();
    const staff = await create(token, { email: 'admin@example.com', role: 'STAFF' }).expect(201);
    expect((await issue(token, staff.body.id)).status).toBe(400);
    const own = await create(token, { email: INVITEE, role: 'EMPLOYEE', delivery: 'link' }).expect(201);
    await request(app.getHttpServer()).delete(`/auth/invites/${own.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect((await issue(token, own.body.id)).status).toBe(404);
    expect((await issue(token, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('администратор «Новую ссылку» не получает (403)', async () => {
    const token = await login();
    const own = await create(token, { email: INVITEE, role: 'EMPLOYEE', delivery: 'link' }).expect(201);
    repo.accounts = [{ ...ACCOUNT, role: 'STAFF' }];
    expect((await issue(token, own.body.id)).status).toBe(403);
  });
});

