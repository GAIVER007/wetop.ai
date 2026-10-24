import 'reflect-metadata';
process.env.SESSION_SECRET ??= 'секрет-для-прогона';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashSessionToken } from '@pms/domain';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { ACCOUNT, FakeAccountsRepository } from './fake-repository';

/**
 * Доступ при добавлении сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md):
 * приглашение с `employeeId` берёт имя и филиал сотрудника; по умолчанию только его филиал, «Все филиалы» без
 * назначений; сотрудник другой организации или уже с входом: отказ; «Личный кабинет» выдаёт и управляющий.
 */
const BIZ = '11111111-1111-4111-8111-111111111111';
const LOC = '22222222-2222-4222-8222-222222222222';
const EMP = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

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
      { provide: 'APP_URL', useValue: 'https://app.example.com' },
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
  repo.invites.length = 0;
  repo.accounts = [ACCOUNT];
  repo.structure = {
    businesses: [{ id: BIZ, name: 'Салон', vertical: 'BEAUTY', locations: [{ id: LOC, name: 'Центр' }] }],
  };
  repo.employees = [
    { id: EMP, organizationId: ACCOUNT.organizationId, businessId: BIZ, name: 'Анна Мастер', locationIds: [LOC], userId: null },
    { id: OTHER, organizationId: 'org-2', businessId: BIZ, name: 'Чужой', locationIds: [LOC], userId: null },
  ];
  sender.clear();
});

async function login(role: 'OWNER' | 'MANAGER' = 'OWNER'): Promise<string> {
  repo.accounts = [{ ...ACCOUNT, role }];
  const token = `t-${role}`;
  await repo.createSession({
    tokenHash: hashSessionToken(token),
    userId: ACCOUNT.userId,
    organizationId: ACCOUNT.organizationId,
    expiresAt: new Date(Date.now() + 3600_000),
    userAgent: null,
  });
  return token;
}

const send = (token: string, body: Record<string, unknown>) =>
  request(app.getHttpServer()).post('/auth/invites').set('Authorization', `Bearer ${token}`).send(body);

describe('приглашение сотрудника из формы «Новый сотрудник»', () => {
  it('«Личный кабинет»: только филиал сотрудника, имя из карточки, сотрудник запомнен', async () => {
    const res = await send(await login(), { email: 'anna@example.com', role: 'employee', employeeId: EMP });
    expect(res.status).toBe(201);
    const stored = repo.invites.at(-1)!;
    expect(stored).toMatchObject({
      role: 'EMPLOYEE',
      employeeId: EMP,
      firstName: 'Анна',
      lastName: 'Мастер',
      scopes: [{ role: 'EMPLOYEE', businessId: BIZ, locationId: LOC }],
    });
    expect(sender.to('anna@example.com').at(-1)?.text).toContain('личный кабинет');
  });

  it('«Все филиалы»: без назначений, вся организация', async () => {
    await send(await login(), { email: 'a@example.com', role: 'staff', employeeId: EMP, allBranches: true }).expect(201);
    expect(repo.invites.at(-1)).toMatchObject({ role: 'STAFF', scopes: [] });
  });

  it('управляющий выдаёт «Личный кабинет», но не «Управляющего»', async () => {
    const token = await login('MANAGER');
    await send(token, { email: 'a@example.com', role: 'employee', employeeId: EMP }).expect(201);
    expect((await send(token, { email: 'b@example.com', role: 'manager', employeeId: EMP })).status).toBe(403);
  });

  it('сотрудник другой организации или уже с входом: 400 и без письма', async () => {
    const token = await login();
    const foreign = await send(token, { email: 'a@example.com', role: 'employee', employeeId: OTHER });
    expect(foreign.status).toBe(400);
    expect(foreign.body.message).toBe('Сотрудник не найден в вашей организации.');
    repo.employees[0]!.userId = 'u-9';
    const linked = await send(token, { email: 'a@example.com', role: 'employee', employeeId: EMP });
    expect(linked.status).toBe(400);
    expect(linked.body.message).toBe('У сотрудника уже есть вход в WETOP.');
    expect(sender.sent).toHaveLength(0);
  });
});
