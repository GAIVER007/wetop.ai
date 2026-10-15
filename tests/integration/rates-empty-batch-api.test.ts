import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
import { hashPassword } from '@pms/domain';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { ARI_PUBLISHER, NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { isLocalDatabase } from '../tools/seed-local';
import { deleteOrganizationChain } from '../tools/property-owner';
import { purgeAuditRows } from '../tools/audit-purge';

it('real API: authenticated empty rate batches return 400 without changing rates, restrictions, audit or outbox', async () => {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated local DB required');
  const saved = { ...process.env };
  for (const key of Object.keys(process.env))
    if (
      /^(CHANNEX|EQONAQ|FISCAL|TELEGRAM|SMTP|MAIL|RESEND|OPENAI|ASSISTANT|GUARD|SERVICE_API_KEY)/.test(
        key,
      )
    )
      delete process.env[key];
  process.env.AUTH_REQUIRED = '1';
  process.env.NODE_ENV = 'test';
  const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
  const id = randomUUID();
  const org = await db.organization.create({
    data: { name: `TEST empty-rates ${id}`, status: 'ACTIVE' },
  });
  const property = await createPropertyInChain(db, org.id, {
    name: `TEST empty-rates ${id}`,
    ...NEW_PROPERTY_DEFAULTS,
  });
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const user = await db.user.create({
    data: {
      email: `empty-rates-${id}@example.invalid`,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(password),
    },
  });
  await db.membership.create({ data: { organizationId: org.id, userId: user.id, role: 'OWNER' } });
  const category = await db.accommodationType.create({
    data: {
      propertyId: property.id,
      code: 'EMPTY_QA',
      name: 'Synthetic single',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
    },
  });
  const plan = await db.ratePlan.create({
    data: { propertyId: property.id, code: 'EMPTY_QA', name: 'Synthetic base', currency: 'KZT' },
  });
  await db.ratePlanAccommodationType.create({
    data: { accommodationTypeId: category.id, ratePlanId: plan.id },
  });
  await db.dailyRate.create({
    data: {
      accommodationTypeId: category.id,
      ratePlanId: plan.id,
      date: new Date('2029-11-01T00:00:00Z'),
      occupancy: 1,
      price: 999000n,
    },
  });
  await db.restriction.create({
    data: {
      accommodationTypeId: category.id,
      ratePlanId: plan.id,
      date: new Date('2029-11-01T00:00:00Z'),
      minStay: 2,
    },
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({ db })
    .overrideProvider(ARI_PUBLISHER)
    .useClass(NoopAriPublisher)
    .compile();
  const app = module.createNestApplication({ logger: false });
  await app.init();
  const snapshot = async () => ({
    rates: await db.dailyRate.findMany({
      where: { ratePlanId: plan.id },
      orderBy: { date: 'asc' },
    }),
    restrictions: await db.restriction.findMany({
      where: { ratePlanId: plan.id },
      orderBy: { date: 'asc' },
    }),
    audit: await db.auditLog.count(),
    outbox: await db.channelOutbox.count(),
  });
  try {
    await request(app.getHttpServer()).post('/rates/bulk').send({ changes: [] }).expect(401);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password })
      .expect(201);
    const token = login.body.token as string;
    expect(typeof token).toBe('string');
    const before = await snapshot();
    const row = {
      accommodationTypeCode: category.code,
      ratePlanCode: plan.code,
      dateFrom: '2029-11-01',
      dateTo: '2029-11-02',
    };
    for (const changes of [[], [row], [{ ...row, price: '', occupancy: 1 }]]) {
      const response = await request(app.getHttpServer())
        .post('/rates/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({ changes })
        .expect(400);
      expect(response.body.message).toMatch(/хотя бы одно|нечего менять/);
      expect(await snapshot()).toEqual(before);
    }
  } finally {
    await app.close();
    await purgeAuditRows(db, { organizationId: org.id });
    await db.dailyRate.deleteMany({ where: { ratePlanId: plan.id } });
    await db.restriction.deleteMany({ where: { ratePlanId: plan.id } });
    await db.ratePlanAccommodationType.deleteMany({ where: { ratePlanId: plan.id } });
    await db.ratePlan.delete({ where: { id: plan.id } });
    await db.accommodationType.delete({ where: { id: category.id } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.membership.deleteMany({ where: { userId: user.id } });
    await db.property.delete({ where: { id: property.id } });
    await deleteOrganizationChain(db, [org.id]);
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}, 60000);
