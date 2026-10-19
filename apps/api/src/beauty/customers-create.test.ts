import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BeautyCatalogController, BeautyCatalogService } from './beauty.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

const customerId = '00000000-0000-4000-8000-000000000001';
const actor = {
  userId: 'user', organizationId: 'org', role: 'OWNER' as 'OWNER' | null,
  scope: 'BUSINESS' as const, businessId: 'business', vertical: 'BEAUTY' as const,
};

function fixture() {
  const db = {
    organization: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }) },
    business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({ ...data })),
    },
    customerBusiness: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return db;
}

describe('POST /beauty/customers: клиент без записи', () => {
  let app: INestApplication;
  let db: ReturnType<typeof fixture>;
  beforeEach(async () => {
    actor.role = 'OWNER';
    db = fixture();
    const service = new BeautyCatalogService({ db } as unknown as PrismaService);
    const module = await Test.createTestingModule({
      controllers: [BeautyCatalogController],
      providers: [{ provide: BeautyCatalogService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use((_req: unknown, _res: unknown, next: () => void) => withSignedInUser(actor, async () => next()));
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => app?.close());

  it('создаёт клиента в серверном scope, сохраняет исходный номер и audit без контактов', async () => {
    const result = await request(app.getHttpServer()).post('/beauty/customers').send({
      firstName: ' Тестовый клиент ', lastName: ' Синтетический ', phone: '8 (700) 000-10-01',
      organizationId: 'foreign', businessId: 'foreign', phoneNormalized: 'forged',
    }).expect(201);
    expect(result.body).toMatchObject({ created: true, id: expect.any(String) });
    expect(db.customer.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: 'org', firstName: 'Тестовый клиент', lastName: 'Синтетический', phone: '8 (700) 000-10-01',
    }) });
    expect(db.customer.create.mock.calls[0]![0].data).not.toHaveProperty('phoneNormalized');
    expect(db.customerBusiness.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { customerId: result.body.id, businessId: 'business' },
    }));
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    // entityId is a random UUID and may contain any digits by chance: check it separately, then look for the
    // phone in everything else (flaky before: a UUID with «700» failed this test on main 39276461202).
    const [[auditCall]] = db.auditLog.create.mock.calls as unknown as [[{ data: Record<string, unknown> }]];
    expect(auditCall.data.entityId).toBe(result.body.id);
    const auditRest = Object.fromEntries(Object.entries(auditCall.data).filter(([key]) => key !== 'entityId'));
    expect(JSON.stringify(auditRest)).not.toMatch(/700|000-10-01|0001001|1001/);
  });

  for (const phone of ['+77000001001', '87000001001', '7000001001', '+7 (700) 000-10-01']) {
    it(`повтор ${phone}: использует каноническую карточку без перезаписи профиля`, async () => {
      db.customer.findFirst.mockResolvedValue({ id: customerId, status: 'ACTIVE' });
      const result = await request(app.getHttpServer()).post('/beauty/customers')
        .send({ firstName: 'Другое имя', phone }).expect(201);
      expect(result.body).toEqual({ id: customerId, created: false });
      expect(db.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { organizationId: 'org', phoneNormalized: '+77000001001' },
      }));
      expect(db.customer.create).not.toHaveBeenCalled();
      expect(db.customerBusiness.upsert).toHaveBeenCalled();
    });
  }

  it('не восстанавливает архивного клиента', async () => {
    db.customer.findFirst.mockResolvedValue({ id: customerId, status: 'ARCHIVED' });
    await request(app.getHttpServer()).post('/beauty/customers')
      .send({ firstName: 'Тест', phone: '+77000001001' }).expect(409);
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.customerBusiness.upsert).not.toHaveBeenCalled();
  });

  it('повтор в том же бизнесе не создаёт ложную историю привязки', async () => {
    db.customer.findFirst.mockResolvedValue({ id: customerId, status: 'ACTIVE' });
    db.customerBusiness.findUnique.mockResolvedValue({ customerId });
    await request(app.getHttpServer()).post('/beauty/customers')
      .send({ firstName: 'Тест', phone: '+77000001001' }).expect(201);
    expect(db.customerBusiness.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  for (const body of [{ phone: '+77000001001' }, { firstName: 'Тест' }, { firstName: 'Тест', phone: 'abc123' }]) {
    it(`отклоняет некорректный ввод ${JSON.stringify(body)}`, async () => {
      await request(app.getHttpServer()).post('/beauty/customers').send(body).expect(400);
      expect(db.customer.create).not.toHaveBeenCalled();
    });
  }

  it('не обходит backend право записи', async () => {
    actor.role = null;
    await request(app.getHttpServer()).post('/beauty/customers')
      .send({ firstName: 'Тест', phone: '+77000001001' }).expect(403);
    expect(db.customer.findFirst).not.toHaveBeenCalled();
  });

  it('не пишет в read-only организации', async () => {
    db.organization.findUnique.mockResolvedValue({ status: 'READ_ONLY', trialEndsAt: null });
    await request(app.getHttpServer()).post('/beauty/customers')
      .send({ firstName: 'Тест', phone: '+77000001001' }).expect(403);
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it('конкурентный UNIQUE даёт 409 без привязки и ложного audit', async () => {
    db.customer.create.mockRejectedValue({ code: 'P2002' });
    await request(app.getHttpServer()).post('/beauty/customers')
      .send({ firstName: 'Тест', phone: '+77000001001' }).expect(409);
    expect(db.customerBusiness.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
