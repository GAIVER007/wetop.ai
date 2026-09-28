import 'reflect-metadata';
process.env.SESSION_SECRET ??= 'секрет-для-прогона';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  INVITE_MANAGER_OWNER_ONLY_MESSAGE,
  INVITE_ROLE_MESSAGE,
  INVITE_STAFF_ONLY_MESSAGE,
  MEMBER_MANAGER_REMOVES_STAFF_MESSAGE,
  MEMBER_NOT_FOUND_MESSAGE,
  MEMBER_OWNER_MESSAGE,
  MEMBER_ROLE_MESSAGE,
  MEMBER_ROLE_OWNER_ONLY_MESSAGE,
  MEMBER_SELF_MESSAGE,
  hashSessionToken,
  type MembershipRole,
} from '@pms/domain';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { ACCOUNT, FakeAccountsRepository } from './fake-repository';

/**
 * Сотрудники и приглашения с ролью (ADR-107, DATA_MODEL §13.6, §16.1): владелец зовёт управляющих и администраторов,
 * управляющий — администраторов; отключает тот, кто вправе позвать с этой ролью; роль меняет владелец. Сервис решает
 * это сам — замок ролей на маршрутах стоит в приложении отдельно и здесь не собирается.
 */
let app: INestApplication;
let repo: FakeAccountsRepository;
let sender: mail.StubMailSender;

const ORG = ACCOUNT.organizationId;
const person = (userId: string, role: MembershipRole) => ({
  ...ACCOUNT,
  userId,
  email: `${userId}@example.invalid`,
  role,
});

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
      { provide: 'APP_URL', useValue: 'https://app.example.com' },
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
  repo.sessions.length = 0;
  repo.invites.length = 0;
  repo.removed.length = 0;
  repo.blocked.clear();
  repo.accounts = [
    person('u-owner', 'OWNER'),
    person('u-manager', 'MANAGER'),
    person('u-admin', 'STAFF'),
    person('u-admin2', 'STAFF'),
    // другая организация: её людей здесь не видно и не отключить
    { ...person('u-other', 'STAFF'), organizationId: 'org-2', organizationName: 'Чужой хостел' },
  ];
  sender.clear();
});

/** Сессия человека прямо в подставном хранилище: вход по паролю живёт в AuthService, этот контроллер его не видит */
async function as(userId: string): Promise<string> {
  const token = `members-${userId}`;
  await repo.createSession({
    tokenHash: hashSessionToken(token),
    userId,
    organizationId: repo.accounts.find((a) => a.userId === userId)!.organizationId,
    expiresAt: new Date(Date.now() + 12 * 3600_000),
    userAgent: null,
  });
  return token;
}

const http = () => request(app.getHttpServer());
const invite = (token: string, body: Record<string, unknown>) =>
  http().post('/auth/invites').set('Authorization', `Bearer ${token}`).send(body);

describe('приглашение с ролью', () => {
  it('владелец зовёт управляющего: роль в приглашении, в ответе и в письме', async () => {
    const res = await invite(await as('u-owner'), {
      email: 'manager-new@example.invalid',
      role: 'manager',
    }).expect(201);
    expect(res.body.role).toBe('MANAGER');
    expect(repo.invites[0]!.role).toBe('MANAGER');
    expect(sender.to('manager-new@example.invalid').at(-1)?.text).toContain('Роль: управляющий.');
  });

  it('без роли — администратор, как принимались приглашения до ADR-107', async () => {
    const res = await invite(await as('u-owner'), { email: 'plain@example.invalid' }).expect(201);
    expect(res.body.role).toBe('STAFF');
    expect(sender.to('plain@example.invalid').at(-1)?.text).toContain('Роль: администратор.');
  });

  it('владельца приглашением не назначают; непонятная роль — 400, приглашения нет', async () => {
    const token = await as('u-owner');
    for (const role of ['owner', 'OWNER', 'admin', 42]) {
      const res = await invite(token, { email: 'x@example.invalid', role });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(INVITE_ROLE_MESSAGE);
    }
    expect(repo.invites).toHaveLength(0);
  });

  it('управляющий зовёт администратора, управляющего — нет', async () => {
    const token = await as('u-manager');
    await invite(token, { email: 'admin-new@example.invalid', role: 'staff' }).expect(201);
    const refused = await invite(token, { email: 'boss@example.invalid', role: 'manager' });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(INVITE_MANAGER_OWNER_ONLY_MESSAGE);
    expect(repo.invites.map((i) => i.email)).toEqual(['admin-new@example.invalid']);
  });

  it('администратор не приглашает и списка не видит', async () => {
    const token = await as('u-admin');
    const res = await invite(token, { email: 'y@example.invalid' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(INVITE_STAFF_ONLY_MESSAGE);
    const list = await http().get('/auth/invites').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);
  });

  it('управляющий видит все ожидающие приглашения, но отозвать может только приглашение администратора', async () => {
    await invite(await as('u-owner'), { email: 'm@example.invalid', role: 'manager' }).expect(201);
    await invite(await as('u-owner'), { email: 's@example.invalid', role: 'staff' }).expect(201);
    const token = await as('u-manager');
    const list = await http()
      .get('/auth/invites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byEmail = Object.fromEntries(
      (list.body as Array<{ email: string; role: string; revocable: boolean; id: string }>).map(
        (i) => [i.email, i],
      ),
    );
    expect(byEmail['m@example.invalid']).toMatchObject({ role: 'MANAGER', revocable: false });
    expect(byEmail['s@example.invalid']).toMatchObject({ role: 'STAFF', revocable: true });

    await http()
      .delete(`/auth/invites/${byEmail['m@example.invalid']!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await http()
      .delete(`/auth/invites/${byEmail['s@example.invalid']!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('принятое приглашение управляющего даёт роль управляющего', async () => {
    await invite(await as('u-owner'), { email: 'boss@example.invalid', role: 'manager' }).expect(
      201,
    );
    const link = /\/invite\/(\S+)/.exec(sender.to('boss@example.invalid').at(-1)!.text)![1]!;
    await http().post(`/auth/invites/${link}/accept`).expect(200);
    expect(repo.accounts.find((a) => a.email === 'boss@example.invalid')?.role).toBe('MANAGER');
  });
});

describe('сотрудники организации', () => {
  it('владелец видит людей своей организации с ролями; чужих — нет', async () => {
    const res = await http()
      .get('/auth/members')
      .set('Authorization', `Bearer ${await as('u-owner')}`)
      .expect(200);
    const rows = res.body as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.userId, r.role, r.you, r.removable, r.roleEditable])).toEqual([
      ['u-owner', 'OWNER', true, false, false],
      ['u-manager', 'MANAGER', false, true, true],
      ['u-admin', 'STAFF', false, true, true],
      ['u-admin2', 'STAFF', false, true, true],
    ]);
  });

  it('управляющему: отключить можно только администраторов, роль не меняет никому', async () => {
    const res = await http()
      .get('/auth/members')
      .set('Authorization', `Bearer ${await as('u-manager')}`)
      .expect(200);
    const rows = res.body as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.userId, r.removable, r.roleEditable])).toEqual([
      ['u-owner', false, false],
      ['u-manager', false, false],
      ['u-admin', true, false],
      ['u-admin2', true, false],
    ]);
  });

  it('администратор список сотрудников не видит', async () => {
    const res = await http()
      .get('/auth/members')
      .set('Authorization', `Bearer ${await as('u-admin')}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(INVITE_STAFF_ONLY_MESSAGE);
  });

  it('без сессии — 401', async () => {
    await http().get('/auth/members').expect(401);
    await http().delete('/auth/members/u-admin').expect(401);
  });
});

describe('отключить сотрудника', () => {
  const remove = (token: string, userId: string) =>
    http().delete(`/auth/members/${userId}`).set('Authorization', `Bearer ${token}`);

  it('владелец отключает управляющего: членства нет, в журнал — кто и кого', async () => {
    await remove(await as('u-owner'), 'u-manager').expect(200);
    expect(repo.accounts.some((a) => a.userId === 'u-manager')).toBe(false);
    expect(repo.removed).toEqual([{ organizationId: ORG, userId: 'u-manager', by: 'u-owner' }]);
  });

  it('управляющий отключает администратора, но не управляющего и не владельца', async () => {
    const token = await as('u-manager');
    await remove(token, 'u-admin').expect(200);
    const owner = await remove(token, 'u-owner');
    expect(owner.status).toBe(403);
    expect(owner.body.message).toBe(MEMBER_OWNER_MESSAGE);
    repo.accounts.push(person('u-manager2', 'MANAGER'));
    const peer = await remove(token, 'u-manager2');
    expect(peer.status).toBe(403);
    expect(peer.body.message).toBe(MEMBER_MANAGER_REMOVES_STAFF_MESSAGE);
  });

  it('себя не отключить; администратор не отключает никого; чужого и несуществующего нет', async () => {
    const self = await remove(await as('u-owner'), 'u-owner');
    expect(self.status).toBe(403);
    expect(self.body.message).toBe(MEMBER_SELF_MESSAGE);
    expect((await remove(await as('u-admin'), 'u-admin2')).status).toBe(403);
    for (const id of ['u-other', 'u-nobody']) {
      const res = await remove(await as('u-owner'), id);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(MEMBER_NOT_FOUND_MESSAGE);
    }
    expect(repo.accounts.find((a) => a.userId === 'u-other')).toBeDefined();
    expect(repo.removed).toEqual([]);
  });
});

describe('сменить роль', () => {
  const setRole = (token: string, userId: string, role: unknown) =>
    http().patch(`/auth/members/${userId}`).set('Authorization', `Bearer ${token}`).send({ role });

  it('владелец делает администратора управляющим и обратно; в журнал — было и стало', async () => {
    const token = await as('u-owner');
    const res = await setRole(token, 'u-admin', 'manager').expect(200);
    expect(res.body).toMatchObject({ userId: 'u-admin', role: 'MANAGER' });
    expect(repo.accounts.find((a) => a.userId === 'u-admin')?.role).toBe('MANAGER');
    await setRole(token, 'u-admin', 'staff').expect(200);
    expect(repo.roleChanges).toEqual([
      { organizationId: ORG, userId: 'u-admin', before: 'STAFF', after: 'MANAGER', by: 'u-owner' },
      { organizationId: ORG, userId: 'u-admin', before: 'MANAGER', after: 'STAFF', by: 'u-owner' },
    ]);
  });

  it('владельца так не назначить и не снять; себе — нельзя; непонятная роль — 400', async () => {
    const token = await as('u-owner');
    const owner = await setRole(token, 'u-admin', 'owner');
    expect(owner.status).toBe(400);
    expect(owner.body.message).toBe(MEMBER_ROLE_MESSAGE);
    const self = await setRole(token, 'u-owner', 'staff');
    expect(self.status).toBe(403);
    expect(self.body.message).toBe(MEMBER_SELF_MESSAGE);
    const missing = await setRole(token, 'u-other', 'manager');
    expect(missing.status).toBe(404);
  });

  it('управляющий роль не меняет', async () => {
    const res = await setRole(await as('u-manager'), 'u-admin', 'manager');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(MEMBER_ROLE_OWNER_ONLY_MESSAGE);
    expect(repo.accounts.find((a) => a.userId === 'u-admin')?.role).toBe('STAFF');
  });
});

/**
 * Сессия, по которой действуют приглашения и сотрудники, проверяется так же полно, как вход (аудит 26.09, С-4 и С-10):
 * у приостановленной организации, заблокированного человека и снятого членства её нет — даже если замок входа пропустил
 * запрос по другой сессии (замок читает заголовки, этот контроллер — сначала куку).
 */
describe('сессия действия проверяется полностью', () => {
  const members = (token: string) =>
    http().get('/auth/members').set('Authorization', `Bearer ${token}`);

  it('приостановленная организация — 401', async () => {
    const token = await as('u-owner');
    repo.accounts = repo.accounts.map((a) =>
      a.organizationId === ORG ? { ...a, organizationStatus: 'SUSPENDED' as const } : a,
    );
    expect((await members(token)).status).toBe(401);
    expect((await invite(token, { email: 'z@example.invalid' })).status).toBe(401);
  });

  it('заблокированный человек — 401', async () => {
    const token = await as('u-owner');
    repo.blocked.add('u-owner');
    expect((await members(token)).status).toBe(401);
  });

  it('отключённый со старой сессией — 401, а не «администратор»', async () => {
    const token = await as('u-manager');
    repo.accounts = repo.accounts.filter((a) => a.userId !== 'u-manager');
    expect((await members(token)).status).toBe(401);
    expect((await invite(token, { email: 'z@example.invalid' })).status).toBe(401);
  });
});

describe('отключение и смена роли — по роли в момент записи', () => {
  it('роль сменилась между проверкой и записью: управляющий не удаляет нового управляющего', async () => {
    const token = await as('u-manager');
    // хранилище говорит «роль уже не та» — так выглядит гонка с владельцем, повысившим человека
    repo.roleOverride.set('u-admin', 'MANAGER');
    const res = await http()
      .delete('/auth/members/u-admin')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(MEMBER_MANAGER_REMOVES_STAFF_MESSAGE);
    expect(repo.accounts.some((a) => a.userId === 'u-admin')).toBe(true);
  });

  it('повторное «Отключить» того же человека — 404, а не сбой', async () => {
    const token = await as('u-owner');
    await http()
      .delete('/auth/members/u-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await http()
      .delete('/auth/members/u-admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
