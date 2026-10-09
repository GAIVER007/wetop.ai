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
  MEMBER_DETAILS_FORBIDDEN_MESSAGE,
  MEMBER_OWNER_MESSAGE,
  MEMBER_PHONE_MESSAGE,
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
  repo.suspended.clear();
  repo.scopes.clear();
  repo.scopeWrites.length = 0;
  repo.suspensions.length = 0;
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
    // «Был в системе» на экране «Сотрудники» (TEAM1): дата последнего входа; не входил — null, не undefined
    expect(rows.map((r) => [r.userId, r.lastLoginAt])).toEqual([
      ['u-owner', '2026-09-20T10:00:00.000Z'],
      ['u-manager', '2026-09-20T10:00:00.000Z'],
      ['u-admin', '2026-09-20T10:00:00.000Z'],
      ['u-admin2', null],
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

  it('без сессии: 401', async () => {
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

/** Телефон и должность (TEAM2, Q-244, DATA_MODEL v2.10 §13.3): правит тот, кто вправе отключить, и каждый свои */
describe('телефон и должность сотрудника', () => {
  const setDetails = (token: string, userId: string, body: Record<string, unknown>) =>
    http()
      .patch(`/auth/members/${userId}/details`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const list = async (userId: string) =>
    (
      await http()
        .get('/auth/members')
        .set('Authorization', `Bearer ${await as(userId)}`)
        .expect(200)
    ).body as Array<Record<string, unknown>>;

  beforeEach(() => {
    repo.details.clear();
    repo.detailChanges.length = 0;
    repo.roleOverride.clear();
  });

  it('в списке: телефон и должность (пусто: null) и кому их можно править', async () => {
    expect(
      (await list('u-owner')).map((r) => [r.userId, r.phone, r.position, r.detailsEditable]),
    ).toEqual([
      ['u-owner', null, null, true],
      ['u-manager', null, null, true],
      ['u-admin', null, null, true],
      ['u-admin2', null, null, true],
    ]);
    expect((await list('u-manager')).map((r) => [r.userId, r.detailsEditable])).toEqual([
      ['u-owner', false],
      ['u-manager', true],
      ['u-admin', true],
      ['u-admin2', true],
    ]);
  });

  it('владелец записывает администратору телефон и должность; в журнал: должность, телефон только отметкой', async () => {
    const res = await setDetails(await as('u-owner'), 'u-admin', {
      phone: '8 701 555 44 33',
      position: 'Старший администратор',
    }).expect(200);
    expect(res.body).toEqual({
      userId: 'u-admin',
      phone: '+77015554433',
      position: 'Старший администратор',
    });
    const row = (await list('u-owner')).find((r) => r.userId === 'u-admin')!;
    expect([row.phone, row.position]).toEqual(['+77015554433', 'Старший администратор']);
    expect(repo.detailChanges).toEqual([
      {
        organizationId: ORG,
        userId: 'u-admin',
        by: 'u-owner',
        positionBefore: null,
        positionAfter: 'Старший администратор',
        phoneChanged: true,
      },
    ]);
  });

  it('не телефон: 400 словами, ничего не записано', async () => {
    const res = await setDetails(await as('u-owner'), 'u-admin', {
      phone: '12-34',
      position: 'Кассир',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MEMBER_PHONE_MESSAGE);
    expect(repo.detailChanges).toEqual([]);
  });

  it('управляющий правит себя и администраторов, но не владельца; администратор: никого; чужой: 404', async () => {
    const manager = await as('u-manager');
    await setDetails(manager, 'u-manager', { phone: '', position: 'Управляющий сменой' }).expect(
      200,
    );
    await setDetails(manager, 'u-admin', { phone: '', position: 'Ночной администратор' }).expect(
      200,
    );
    const owner = await setDetails(manager, 'u-owner', { phone: '', position: 'Директор' });
    expect(owner.status).toBe(403);
    expect(owner.body.message).toBe(MEMBER_DETAILS_FORBIDDEN_MESSAGE);
    const admin = await setDetails(await as('u-admin'), 'u-admin', { phone: '', position: 'x' });
    expect(admin.status).toBe(403);
    expect(admin.body.message).toBe(INVITE_STAFF_ONLY_MESSAGE);
    const other = await setDetails(await as('u-owner'), 'u-other', { phone: '', position: 'x' });
    expect(other.status).toBe(404);
    expect(other.body.message).toBe(MEMBER_NOT_FOUND_MESSAGE);
    expect(repo.detailChanges.map((c) => c.userId)).toEqual(['u-manager', 'u-admin']);
  });

  it('роль сменилась между проверкой и записью: управляющий не правит нового управляющего', async () => {
    repo.roleOverride.set('u-admin', 'MANAGER');
    const res = await setDetails(await as('u-manager'), 'u-admin', { phone: '', position: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(MEMBER_DETAILS_FORBIDDEN_MESSAGE);
    expect(repo.detailChanges).toEqual([]);
  });

  it('без сессии: 401', async () => {
    await http().patch('/auth/members/u-admin/details').send({ position: 'x' }).expect(401);
  });
});

describe('приостановка доступа (DATA_MODEL §30.2, Q-289)', () => {
  const suspend = (token: string, userId: string) =>
    http().post(`/auth/members/${userId}/suspend`).set('Authorization', `Bearer ${token}`);
  const resume = (token: string, userId: string) =>
    http().post(`/auth/members/${userId}/resume`).set('Authorization', `Bearer ${token}`);
  const list = async (token: string) =>
    (await http().get('/auth/members').set('Authorization', `Bearer ${token}`)).body as Array<{
      userId: string;
      suspended: boolean;
      suspendable: boolean;
    }>;

  it('владелец приостанавливает администратора: член остаётся, сессии гаснут, в журнал кто и кого', async () => {
    const adminToken = await as('u-admin');
    const owner = await as('u-owner');
    await suspend(owner, 'u-admin').expect(200);
    expect(repo.accounts.some((a) => a.userId === 'u-admin')).toBe(true);
    expect(repo.suspensions).toEqual([{ userId: 'u-admin', suspended: true, by: 'u-owner' }]);
    const row = (await list(owner)).find((m) => m.userId === 'u-admin');
    expect(row?.suspended).toBe(true);
    // его сессия больше не действует
    expect(
      (await http().get('/auth/members').set('Authorization', `Bearer ${adminToken}`)).status,
    ).toBe(401);
  });

  it('возобновление возвращает вход одним действием', async () => {
    const owner = await as('u-owner');
    await suspend(owner, 'u-admin2').expect(200);
    await resume(owner, 'u-admin2').expect(200);
    expect((await list(owner)).find((m) => m.userId === 'u-admin2')?.suspended).toBe(false);
    expect(repo.suspensions.map((x) => x.suspended)).toEqual([true, false]);
  });

  it('круг тот же, что у отключения: управляющий приостанавливает администратора, но не управляющего и не владельца', async () => {
    const token = await as('u-manager');
    await suspend(token, 'u-admin').expect(200);
    expect((await suspend(token, 'u-owner')).status).toBe(403);
    repo.accounts.push(person('u-manager2', 'MANAGER'));
    expect((await suspend(token, 'u-manager2')).status).toBe(403);
    expect(repo.suspended.has('u-manager2')).toBe(false);
  });

  it('себя нельзя, администратору нельзя, чужого и несуществующего нет', async () => {
    const owner = await as('u-owner');
    expect((await suspend(owner, 'u-owner')).status).toBe(403);
    expect((await suspend(await as('u-admin'), 'u-admin2')).status).toBe(403);
    expect((await suspend(owner, 'u-other')).status).toBe(404);
    expect((await suspend(owner, 'nobody')).status).toBe(404);
    expect(repo.suspensions).toEqual([]);
  });

  it('в списке «можно приостановить» только тем, кого вошедший вправе отключить', async () => {
    const rows = await list(await as('u-manager'));
    expect(rows.find((m) => m.userId === 'u-admin')?.suspendable).toBe(true);
    expect(rows.find((m) => m.userId === 'u-owner')?.suspendable).toBe(false);
    expect(rows.find((m) => m.userId === 'u-manager')?.suspendable).toBe(false);
  });
});

describe('область доступа: назначения по бизнесам и филиалам (DATA_MODEL §30.1, Q-286, Q-287)', () => {
  const B1 = '11111111-1111-4111-8111-111111111111';
  const L1 = '21111111-1111-4111-8111-111111111111';
  const L2 = '22222222-2222-4222-8222-222222222222';
  const B2 = '33333333-3333-4333-8333-333333333333';
  const L3 = '44444444-4444-4444-8444-444444444444';
  const put = (token: string, userId: string, scopes: unknown) =>
    http()
      .put(`/auth/members/${userId}/scopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scopes });

  it('владелец назначает администратору один филиал: в списке видно, журнал ведётся', async () => {
    const owner = await as('u-owner');
    await put(owner, 'u-admin', [{ role: 'STAFF', businessId: B1, locationId: L1 }]).expect(200);
    const rows = (await http().get('/auth/members').set('Authorization', `Bearer ${owner}`)).body;
    expect(rows.find((m: { userId: string }) => m.userId === 'u-admin').scopes).toEqual([
      { role: 'STAFF', businessId: B1, locationId: L1 },
    ]);
    expect(repo.scopeWrites).toHaveLength(1);
  });

  it('разные роли в разных филиалах; роль членства становится старшей из назначенных', async () => {
    const owner = await as('u-owner');
    await put(owner, 'u-admin', [
      { role: 'MANAGER', businessId: B1, locationId: L2 },
      { role: 'STAFF', businessId: B2, locationId: L3 },
    ]).expect(200);
    expect(repo.roleOverride.get('u-admin')).toBe('MANAGER');
  });

  it('пустой список возвращает работу на всю организацию', async () => {
    const owner = await as('u-owner');
    await put(owner, 'u-admin', [{ role: 'STAFF', businessId: B1, locationId: null }]).expect(200);
    await put(owner, 'u-admin', []).expect(200);
    expect(repo.scopes.has('u-admin')).toBe(false);
  });

  it('управляющий назначает администратора, но не управляющего; чужой бизнес и чужой филиал отклоняются', async () => {
    const manager = await as('u-manager');
    await put(manager, 'u-admin', [{ role: 'STAFF', businessId: B1, locationId: L1 }]).expect(200);
    expect(
      (await put(manager, 'u-admin', [{ role: 'MANAGER', businessId: B1, locationId: L1 }])).status,
    ).toBe(400);
    const owner = await as('u-owner');
    expect(
      (
        await put(owner, 'u-admin', [
          { role: 'STAFF', businessId: '99999999-9999-4999-8999-999999999999', locationId: null },
        ])
      ).status,
    ).toBe(400);
    expect(
      (await put(owner, 'u-admin', [{ role: 'STAFF', businessId: B1, locationId: L3 }])).status,
    ).toBe(400);
    // повтор и филиал внутри целого бизнеса: конфликт назначения
    expect(
      (
        await put(owner, 'u-admin', [
          { role: 'MANAGER', businessId: B1, locationId: null },
          { role: 'STAFF', businessId: B1, locationId: L1 },
        ])
      ).status,
    ).toBe(400);
  });

  it('себе, владельцу и администратору нельзя; несуществующему 404; мусор вместо списка 400', async () => {
    const owner = await as('u-owner');
    expect((await put(owner, 'u-owner', [])).status).toBe(403);
    expect((await put(await as('u-manager'), 'u-owner', [])).status).toBe(403);
    expect((await put(await as('u-admin'), 'u-admin2', [])).status).toBe(403);
    expect((await put(owner, 'u-other', [])).status).toBe(404);
    expect((await put(owner, 'u-admin', 'staff')).status).toBe(400);
    expect(repo.scopeWrites).toEqual([]);
  });

  it('структура организации: владельцу и управляющему, администратору нет', async () => {
    const res = await http()
      .get('/auth/access-structure')
      .set('Authorization', `Bearer ${await as('u-manager')}`)
      .expect(200);
    expect(res.body.businesses).toHaveLength(2);
    expect(
      (
        await http()
          .get('/auth/access-structure')
          .set('Authorization', `Bearer ${await as('u-admin')}`)
      ).status,
    ).toBe(403);
  });

  it('приглашение с именем, телефоном, должностью и областью: хранится, принятие переносит область', async () => {
    const owner = await as('u-owner');
    const res = await invite(owner, {
      email: 'scoped@example.invalid',
      role: 'staff',
      firstName: 'Айгерим',
      lastName: 'Тестова',
      phone: '8 701 000 11 22',
      position: 'Старший администратор',
      scopes: [{ role: 'STAFF', businessId: B1, locationId: L1 }],
    }).expect(201);
    expect(res.body.scopes).toEqual([{ role: 'STAFF', businessId: B1, locationId: L1 }]);
    expect(repo.invites[0]).toMatchObject({
      firstName: 'Айгерим',
      lastName: 'Тестова',
      phone: '+77010001122',
    });
    const link = /\/invite\/(\S+)/.exec(sender.to('scoped@example.invalid').at(-1)!.text)![1]!;
    await http().post(`/auth/invites/${link}/accept`).expect(200);
    const joined = repo.accounts.find((a) => a.email === 'scoped@example.invalid')!;
    expect(repo.scopes.get(joined.userId)).toEqual([
      { role: 'STAFF', businessId: B1, locationId: L1 },
    ]);
  });

  it('приглашение: плохая область, телефон или длинное имя отклоняются до записи', async () => {
    const owner = await as('u-owner');
    const bad = (extra: Record<string, unknown>) =>
      invite(owner, { email: 'bad@example.invalid', ...extra });
    expect((await bad({ scopes: [{ role: 'STAFF', businessId: 'x' }] })).status).toBe(400);
    expect(
      (await bad({ scopes: [{ role: 'STAFF', businessId: B1, locationId: L3 }] })).status,
    ).toBe(400);
    expect((await bad({ phone: '12-34' })).status).toBe(400);
    expect((await bad({ firstName: 'я'.repeat(101) })).status).toBe(400);
    // управляющий не может пригласить управляющего через область
    const manager = await as('u-manager');
    const res = await invite(manager, {
      email: 'bad2@example.invalid',
      scopes: [{ role: 'MANAGER', businessId: B1, locationId: L1 }],
    });
    expect(res.status).toBe(400);
    expect(repo.invites).toHaveLength(0);
  });
});
