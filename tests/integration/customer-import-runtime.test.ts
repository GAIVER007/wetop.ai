import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, type Db } from '@pms/database';
import { CustomerImportService } from '../../apps/api/src/beauty/customer-import';
import { BeautyModule } from '../../apps/api/src/beauty/beauty.module';
import { CustomerImportWorker } from '../../apps/api/src/beauty/customer-import.worker';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { bootApp, call, makeClients, seedUser, url, type Actor } from './core-security/harness';

type Row = { sourceLine: number; firstName: string; lastName: string | null; phone: string | null };
const own = { org: randomUUID(), otherOrg: randomUUID(), business: randomUUID(), sibling: randomUUID(), food: randomUUID(), location: randomUUID(), foodLocation: randomUUID() };

describe.skipIf(!url)('M4-B2: durable customer import, real RLS and transactions', () => {
  let admin: Db, tenant: Db, service: CustomerImportService, worker: CustomerImportWorker;
  let owner: string, secondOwner: string, employee: string, beautyService: string, period: string;
  const run = <T>(fn: () => Promise<T>, role: 'OWNER' | 'STAFF' = 'OWNER', businessId = own.business, userId = owner) => withSignedInUser({
    userId, organizationId: own.org, role, scope: 'BUSINESS', businessId, vertical: 'BEAUTY',
  }, fn);
  let maxProcessMs = 0;
  let phoneSequence = 0;
  const phone = () => '+7701' + String(++phoneSequence).padStart(7, '0');
  const raw = (name = 'Тестовый клиент', number: string | null = phone(), line = 2): Row => ({ sourceLine: line, firstName: name, lastName: null, phone: number });

  async function upload(rows: Row[]) {
    const item = await run(() => service.start({ clientRequestId: randomUUID(), totalRows: rows.length }));
    for (let offset = 0; offset < rows.length;) {
      let count = Math.min(500, rows.length - offset);
      while (new TextEncoder().encode(JSON.stringify({ offset, rows: rows.slice(offset, offset + count) })).length > 65536) count = Math.floor(count / 2);
      expect(count).toBeGreaterThan(0);
      await run(() => service.uploadRows(item.id, { offset, rows: rows.slice(offset, offset + count) }));
      offset += count;
    }
    await run(() => service.submit(item.id));
    return item.id;
  }
  async function drain(id: string) {
    let held: Awaited<ReturnType<CustomerImportWorker['claim']>> = null;
    for (let i = 0; i < 3000; i += 1) {
      const item = await admin.customerImport.findUniqueOrThrow({ where: { id } });
      if (item.state === 'COMPLETED' || item.state === 'FAILED') return item;
      held ??= await worker.claim();
      if (held) { const started = Date.now(); const more = await worker.process(held); maxProcessMs = Math.max(maxProcessMs, Date.now() - started); if (!more) held = null; }
      else {
        // Advance only this synthetic job's retry clock, never wait on a shared queue.
        await admin.customerImport.updateMany({ where: { id, state: 'QUEUED' }, data: { nextAttemptAt: new Date(0) } });
      }
    }
    throw new Error('Synthetic import did not reach a terminal state');
  }
  const createdIds = async (id: string) => (await admin.customerImportRow.findMany({ where: { importId: id, outcome: 'CREATED' }, select: { customerId: true } })).flatMap((r) => r.customerId ? [r.customerId] : []);

  beforeAll(async () => {
    ({ admin, tenant } = makeClients());
    for (const id of [own.org, own.otherOrg]) await admin.organization.create({ data: { id, name: 'Синтетическая сеть импорта', status: 'ACTIVE' } });
    for (const id of [own.business, own.sibling]) await admin.business.create({ data: { id, organizationId: own.org, name: 'Синтетический салон', vertical: 'BEAUTY' } });
    await admin.business.create({ data: { id: own.food, organizationId: own.org, name: 'Синтетический ресторан', vertical: 'FOOD_SERVICE' } });
    owner = await seedUser(admin, own.org, 'OWNER', 'M4B2');
    secondOwner = await seedUser(admin, own.org, 'OWNER', 'M4B2Second');
    await admin.location.create({ data: { id: own.location, businessId: own.business, name: 'Тестовый филиал', currency: 'KZT', timezone: 'UTC' } });
    await admin.location.create({ data: { id: own.foodLocation, businessId: own.food, name: 'Тестовый ресторан', currency: 'KZT', timezone: 'UTC' } });
    employee = (await admin.employee.create({ data: { businessId: own.business, name: 'Тестовый мастер' } })).id;
    beautyService = (await admin.beautyService.create({ data: { businessId: own.business, name: 'Тестовая услуга', durationMinutes: 30, price: 100n, currency: 'KZT' } })).id;
    await admin.employeeLocation.create({ data: { employeeId: employee, locationId: own.location } });
    await admin.employeeService.create({ data: { employeeId: employee, serviceId: beautyService } });
    await admin.locationService.create({ data: { locationId: own.location, serviceId: beautyService } });
    period = (await admin.servicePeriod.create({ data: { locationId: own.foodLocation, name: 'Тестовый период', weekday: 1, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z'), defaultDurationMinutes: 60 } })).id;
    service = new CustomerImportService({ db: tenant } as unknown as PrismaService);
    worker = new CustomerImportWorker({ db: admin } as unknown as PrismaService);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.appointmentLine.deleteMany({ where: { appointment: { locationId: own.location } } });
      await tx.appointment.deleteMany({ where: { locationId: own.location } });
      await tx.restaurantReservation.deleteMany({ where: { locationId: own.foodLocation } });
      await tx.customerImportRow.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.customerImport.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.customerBusiness.deleteMany({ where: { customer: { organizationId: { in: [own.org, own.otherOrg] } } } });
      await tx.customer.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.employeeService.deleteMany({ where: { employeeId: employee } });
      await tx.employeeLocation.deleteMany({ where: { employeeId: employee } });
      await tx.locationService.deleteMany({ where: { serviceId: beautyService } });
      await tx.employee.deleteMany({ where: { businessId: { in: [own.business, own.sibling] } } });
      await tx.beautyService.deleteMany({ where: { businessId: own.business } });
      await tx.servicePeriod.deleteMany({ where: { locationId: own.foodLocation } });
      await tx.location.deleteMany({ where: { id: { in: [own.location, own.foodLocation] } } });
      await tx.auditLog.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.membership.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.business.deleteMany({ where: { organizationId: { in: [own.org, own.otherOrg] } } });
      await tx.organization.deleteMany({ where: { id: { in: [own.org, own.otherOrg] } } });
      await tx.user.deleteMany({ where: { id: { in: [owner, secondOwner].filter(Boolean) } } });
    }, { timeout: 60000 });
    await tenant?.$disconnect(); await admin.$disconnect();
  });


  it('exposes an owner-only real HTTP endpoint with dependency injection', async () => {
    const actor: Actor = { id: owner, email: `owner-${owner}@example.invalid`, name: 'Synthetic owner', organizationId: own.org, role: 'OWNER', platformAdmin: false };
    const server = await bootApp([BeautyModule], tenant, new Map([['owner', actor], ['staff', { ...actor, role: 'STAFF' as const }]]));
    try {
      const response = await call(server.base, 'owner', 'POST', '/beauty/customer-imports', { businessId: own.business }, { clientRequestId: randomUUID(), totalRows: 1 });
      expect(response.status).toBe(201);
      expect(response.json).toMatchObject({ state: 'UPLOADING', totalRows: 1 });
      expect((await call(server.base, 'staff', 'GET', '/beauty/customer-imports', { businessId: own.business })).status).toBe(403);
    } finally { await server.app.close(); }
  });

  it('stages without customers, repeats requests/chunks, rejects changed payload and incomplete submit', async () => {
    const requestId = randomUUID();
    const input = { clientRequestId: requestId, totalRows: 2, organizationId: own.otherOrg, businessId: own.food };
    const item = await run(() => service.start(input));
    expect(await run(() => service.start(input))).toMatchObject({ id: item.id });
    await expect(run(() => service.start({ ...input, totalRows: 3 }))).rejects.toBeInstanceOf(ConflictException);
    const row = raw('Не сохранять до submit');
    const body = { offset: 0, rows: [row] };
    await run(() => service.uploadRows(item.id, body));
    await run(() => service.uploadRows(item.id, body));
    expect(await admin.customerImportRow.count({ where: { importId: item.id } })).toBe(1);
    expect(await admin.customer.count({ where: { organizationId: own.org, phone: row.phone } })).toBe(0);
    await expect(run(() => service.uploadRows(item.id, { offset: 0, rows: [raw()] }))).rejects.toBeInstanceOf(ConflictException);
    await expect(run(() => service.submit(item.id))).rejects.toBeInstanceOf(ConflictException);
    expect((await admin.customerImport.findUniqueOrThrow({ where: { id: item.id } })).businessId).toBe(own.business);
  });

  it('creates canonical phones, rejects mismatched names, defaults name, skips bad rows and atomically undoes', async () => {
    const number = phone();
    const id = await upload([raw('Первое имя', number), raw('Не перезаписывать', '8' + number.slice(2)), raw('', phone()), raw('Без телефона', null), raw('Неверный', 'abc'), raw('', null)]);
    const item = await drain(id);
    expect(item).toMatchObject({ state: 'COMPLETED', processedRows: 6, createdCount: 3, linkedCount: 0, unchangedCount: 0, skippedCount: 3 });
    expect(await admin.customerImportRow.findFirst({
      where: { importId: id, sourceLine: 3 },
      select: { outcome: true, errorCode: true },
    })).toEqual({ outcome: 'SKIPPED', errorCode: 'CUSTOMER_CONFLICT' });
    const ids = await createdIds(id);
    expect(await admin.customer.count({ where: { id: { in: ids }, firstName: 'Клиент' } })).toBe(1);
    expect((await admin.customer.findFirstOrThrow({ where: { organizationId: own.org, phoneNormalized: number } })).firstName).toBe('Первое имя');
    const audit = JSON.stringify(await admin.auditLog.findMany({ where: { organizationId: own.org, entityId: id } }));
    expect(audit).not.toContain(number); expect(audit).not.toContain('Первое имя');
    expect(await run(() => service.undo(id))).toMatchObject({ state: 'UNDONE' });
    expect(await admin.customer.count({ where: { id: { in: ids } } })).toBe(0);
    expect(await run(() => service.undo(id))).toMatchObject({ state: 'UNDONE' });
    expect(await admin.customerImportRow.count({ where: { importId: id } })).toBe(6);
  });

  it('rejects a sibling identity with another name, then links the exact identity and undoes only that link', async () => {
    const number = phone();
    const known = await admin.customer.create({ data: { organizationId: own.org, firstName: 'Старый профиль', phone: number } });
    await admin.customerBusiness.create({ data: { customerId: known.id, businessId: own.sibling } });
    const conflictId = await upload([raw('Новое имя', '8' + number.slice(2))]);
    expect(await drain(conflictId)).toMatchObject({
      createdCount: 0,
      linkedCount: 0,
      skippedCount: 1,
    });
    expect(await admin.customerImportRow.findFirst({
      where: { importId: conflictId },
      select: { outcome: true, errorCode: true, customerId: true },
    })).toEqual({ outcome: 'SKIPPED', errorCode: 'CUSTOMER_CONFLICT', customerId: null });
    expect(await admin.customerBusiness.count({ where: { customerId: known.id } })).toBe(1);

    const linkedId = await upload([raw('Старый профиль', '8' + number.slice(2))]);
    expect(await drain(linkedId)).toMatchObject({ createdCount: 0, linkedCount: 1, skippedCount: 0 });
    await run(() => service.undo(linkedId));
    expect((await admin.customer.findUniqueOrThrow({ where: { id: known.id } })).firstName).toBe('Старый профиль');
    expect(await admin.customerBusiness.findUnique({ where: { customerId_businessId: { customerId: known.id, businessId: own.business } } })).toBeNull();
    expect(await admin.customerBusiness.count({ where: { customerId: known.id } })).toBe(1);
  });

  it('rejects the whole undo if its last customer changed', async () => {
    const id = await upload([raw(), raw(), raw()]); await drain(id);
    const ids = await createdIds(id);
    await admin.customer.update({ where: { id: ids.at(-1)! }, data: { firstName: 'Ручное изменение' } });
    await expect(run(() => service.undo(id))).rejects.toBeInstanceOf(ConflictException);
    expect(await admin.customer.count({ where: { id: { in: ids } } })).toBe(3);
    expect((await admin.customerImport.findUniqueOrThrow({ where: { id } })).state).toBe('COMPLETED');
  });

  it.each(['beauty', 'food'] as const)('keeps cancelled %s history when undo is requested', async (kind) => {
    const id = await upload([raw()]); await drain(id); const [customerId] = await createdIds(id);
    if (kind === 'beauty') await admin.appointment.create({ data: { locationId: own.location, customerId: customerId!, employeeId: employee, serviceId: beautyService, startsAt: new Date('2026-10-19T10:00:00Z'), endsAt: new Date('2026-10-19T10:30:00Z'), price: 100n, currency: 'KZT', status: 'CANCELLED' } });
    else await admin.restaurantReservation.create({ data: { locationId: own.foodLocation, customerId: customerId!, servicePeriodId: period, startsAt: new Date('2026-10-19T10:00:00Z'), endsAt: new Date('2026-10-19T11:00:00Z'), partySize: 1, status: 'CANCELLED', creationKey: randomUUID(), creationFingerprint: 'a'.repeat(64) } });
    await expect(run(() => service.undo(id))).rejects.toBeInstanceOf(ConflictException);
    expect(await admin.customer.findUnique({ where: { id: customerId! } })).not.toBeNull();
  });

  it('denies every management read/write to staff, and hides sibling-business jobs', async () => {
    const item = await run(() => service.start({ clientRequestId: randomUUID(), totalRows: 1 }));
    const commands: Array<() => Promise<unknown>> = [() => service.get(item.id), () => service.list(), () => service.rows(item.id), () => service.submit(item.id), () => service.undo(item.id)];
    for (const command of commands)
      await expect(run(command, 'STAFF')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run(() => service.get(item.id), 'OWNER', own.sibling)).rejects.toBeInstanceOf(NotFoundException);
    await expect(run(() => tenant.customerImport.findMany({ where: { organizationId: own.otherOrg } }))).resolves.toEqual([]);
  });

  it('rejects a stale worker token and recovers the expired lease without double creation', async () => {
    const id = await upload([raw()]); const old = await worker.claim(); expect(old?.id).toBe(id);
    await admin.customerImport.update({ where: { id }, data: { leaseToken: randomUUID(), leaseExpiresAt: new Date(Date.now() + 60000) } });
    await worker.process(old!);
    expect(await admin.customerImportRow.count({ where: { importId: id, outcome: 'CREATED' } })).toBe(0);
    await admin.customerImport.update({ where: { id }, data: { leaseExpiresAt: new Date(0), nextAttemptAt: new Date(0) } });
    expect(await drain(id)).toMatchObject({ state: 'COMPLETED', createdCount: 1 });
    await worker.process(old!);
    expect(await admin.customerImportRow.count({ where: { importId: id, outcome: 'CREATED' } })).toBe(1);
  });


  it('rolls back a failed batch, schedules a safe retry and creates only once', async () => {
    const id = await upload([raw()]);
    let failures = 0;
    const faultDb = admin.$extends({ query: { customer: { async createMany({ args, query }) {
      if (failures++ === 0) throw new Error('Synthetic transient failure');
      return query(args);
    } } } });
    const faultWorker = new CustomerImportWorker({ db: faultDb } as unknown as PrismaService);
    const claim = await faultWorker.claim(); expect(claim?.id).toBe(id);
    await expect(faultWorker.process(claim!)).resolves.toBe(false);
    const retry = await admin.customerImport.findUniqueOrThrow({ where: { id } });
    expect(retry).toMatchObject({ state: 'QUEUED', processedRows: 0, createdCount: 0 });
    expect(retry.errorCode).toBeTruthy();
    expect(await admin.customerImportRow.count({ where: { importId: id, outcome: 'CREATED' } })).toBe(0);
    expect(await drain(id)).toMatchObject({ state: 'COMPLETED', createdCount: 1 });
  });

  it('rechecks the owner between batches and allows safe undo of partial failure', async () => {
    const id = await upload(Array.from({ length: 101 }, (_, i) => raw('Synthetic partial failure', phone(), i + 2)));
    const claim = await worker.claim(); expect(claim?.id).toBe(id);
    expect(await worker.process(claim!)).toBe(true);
    try {
      await admin.membership.update({ where: { userId_organizationId: { userId: owner, organizationId: own.org } }, data: { role: 'STAFF' } });
      expect(await worker.process(claim!)).toBe(false);
      const failed = await admin.customerImport.findUniqueOrThrow({ where: { id } });
      expect(failed).toMatchObject({ state: 'FAILED', processedRows: 100, createdCount: 100 });
      expect(failed.undoDeadline).not.toBeNull();
      expect(await run(() => service.undo(id), 'OWNER', own.business, secondOwner)).toMatchObject({ state: 'UNDONE' });
      expect(await admin.customer.count({ where: { id: { in: await createdIds(id) } } })).toBe(0);
    } finally {
      await admin.membership.update({ where: { userId_organizationId: { userId: owner, organizationId: own.org } }, data: { role: 'OWNER' } });
    }
  });

  it('clears expired terminal input/baselines, retaining customer, totals and outcome', async () => {
    const id = await upload([raw()]); await drain(id); const ids = await createdIds(id);
    await admin.customerImport.update({ where: { id }, data: { undoDeadline: new Date(0), contentsExpireAt: new Date(1) } });
    await worker.purgeExpiredContents();
    const rows = await admin.customerImportRow.findMany({ where: { importId: id } });
    expect(rows[0]).toMatchObject({ input: null, customerBaseline: null, linkBaseline: null, outcome: 'CREATED' });
    expect(await admin.customer.count({ where: { id: { in: ids } } })).toBe(1);
    expect((await run(() => service.get(id))).contentsExpired).toBe(true);
    await expect(run(() => service.undo(id))).rejects.toBeInstanceOf(ConflictException);
  });

  it.skipIf(process.env.CUSTOMER_IMPORT_PERF !== '1')('50 000 synthetic rows: durable upload, process and atomic undo budget', async () => {
    const before = await admin.customer.count({ where: { organizationId: own.org } });
    const rows = Array.from({ length: 50_000 }, (_, i) => raw(`Synthetic performance ${i}`, phone(), i + 2));
    const uploadStart = Date.now();
    const id = await upload(rows);
    const uploadMs = Date.now() - uploadStart;
    expect(await admin.customerImportRow.count({ where: { importId: id } })).toBe(50_000);
    const processStart = Date.now(); maxProcessMs = 0;
    const item = await drain(id);
    const processMs = Date.now() - processStart;
    expect(item).toMatchObject({ state: 'COMPLETED', totalRows: 50_000, processedRows: 50_000, createdCount: 50_000, skippedCount: 0 });
    expect(await admin.customer.count({ where: { organizationId: own.org } })).toBe(before + 50_000);
    const size = await admin.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_total_relation_size('customer_import_rows') AS bytes`;
    const undoStart = Date.now();
    expect(await run(() => service.undo(id))).toMatchObject({ state: 'UNDONE' });
    const undoMs = Date.now() - undoStart;
    expect(await admin.customer.count({ where: { organizationId: own.org } })).toBe(before);
    expect(await admin.customerImportRow.count({ where: { importId: id } })).toBe(50_000);
    await admin.customerImport.update({ where: { id }, data: { undoDeadline: new Date(0), contentsExpireAt: new Date(0) } });
    const retentionStart = Date.now();
    await worker.purgeExpiredContents();
    const retentionMs = Date.now() - retentionStart;
    expect(await admin.customerImportRow.count({ where: { importId: id, OR: [{ input: { not: Prisma.DbNull } }, { customerBaseline: { not: Prisma.DbNull } }, { linkBaseline: { not: null } }] } })).toBe(0);
    expect((await admin.customerImport.findUniqueOrThrow({ where: { id } })).uploadReceipts).toEqual({});
    console.info(JSON.stringify({ benchmark: 'customer-import-50000', rows: 50_000, uploadMs, processMs, maxProcessMs, undoMs, retentionMs, journalTotalBytes: size[0]!.bytes.toString() }));
    expect(maxProcessMs).toBeLessThan(10_000);
    expect(undoMs).toBeLessThan(10_000);
  }, 900_000);

});
