import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
import { BeautyPositionsService } from '../../apps/api/src/beauty/positions';
import { assertBeautyOperation, runWithBeautyWriteAuthorization } from '../../apps/api/src/beauty/access';
import { withSignedInUser, withVerifiedBeautyOperation } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Beauty positions API: persisted matrix, assignments and strict revocation', () => {
  let db: Db;

  beforeAll(() => {
    if (!isLocalDatabase(url!)) throw new Error('Beauty positions API integration test requires an isolated localhost database');
    db = createPrismaClient(url);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  const ownerActor = (ids: Awaited<ReturnType<typeof seed>>) => ({
    userId: ids.owner,
    organizationId: ids.org,
    role: 'OWNER' as const,
    scope: 'BUSINESS' as const,
    businessId: ids.business,
    vertical: 'BEAUTY' as const,
  });
  const managerActor = (ids: Awaited<ReturnType<typeof seed>>, userId = ids.manager) => ({
    userId,
    organizationId: ids.org,
    role: 'MANAGER' as const,
    scope: 'BUSINESS' as const,
    businessId: ids.business,
    vertical: 'BEAUTY' as const,
  });
  const staffActor = (ids: Awaited<ReturnType<typeof seed>>) => ({
    userId: ids.staff,
    organizationId: ids.org,
    role: 'STAFF' as const,
    scope: 'BUSINESS' as const,
    businessId: ids.business,
    vertical: 'BEAUTY' as const,
  });

  async function seed(tx: DbTx) {
    const ids = {
      org: randomUUID(),
      foreignOrg: randomUUID(),
      owner: randomUUID(),
      manager: randomUUID(),
      manager2: randomUUID(),
      staff: randomUUID(),
      foreignUser: randomUUID(),
      business: randomUUID(),
      otherBusiness: randomUUID(),
      foreignBusiness: randomUUID(),
      locationA: randomUUID(),
      locationB: randomUUID(),
      otherLocation: randomUUID(),
    };
    await tx.organization.createMany({
      data: [
        { id: ids.org, name: 'Beauty positions API synthetic', status: 'ACTIVE' },
        { id: ids.foreignOrg, name: 'Beauty positions API foreign', status: 'ACTIVE' },
      ],
    });
    await tx.user.createMany({
      data: [
        { id: ids.owner, email: `beauty-owner-${ids.owner}@example.test`, emailVerifiedAt: new Date() },
        { id: ids.manager, email: `beauty-manager-${ids.manager}@example.test`, emailVerifiedAt: new Date() },
        { id: ids.manager2, email: `beauty-manager-${ids.manager2}@example.test`, emailVerifiedAt: new Date() },
        { id: ids.staff, email: `beauty-staff-${ids.staff}@example.test`, emailVerifiedAt: new Date() },
        { id: ids.foreignUser, email: `beauty-foreign-${ids.foreignUser}@example.test`, emailVerifiedAt: new Date() },
      ],
    });
    await tx.membership.createMany({
      data: [
        { userId: ids.owner, organizationId: ids.org, role: 'OWNER' },
        { userId: ids.manager, organizationId: ids.org, role: 'MANAGER' },
        { userId: ids.manager2, organizationId: ids.org, role: 'MANAGER' },
        { userId: ids.staff, organizationId: ids.org, role: 'STAFF' },
        { userId: ids.foreignUser, organizationId: ids.foreignOrg, role: 'STAFF' },
      ],
    });
    await tx.business.createMany({
      data: [
        { id: ids.business, organizationId: ids.org, name: 'Beauty positions API', vertical: 'BEAUTY', status: 'ACTIVE' },
        { id: ids.otherBusiness, organizationId: ids.org, name: 'Beauty positions API other', vertical: 'BEAUTY', status: 'ACTIVE' },
        { id: ids.foreignBusiness, organizationId: ids.foreignOrg, name: 'Beauty positions API foreign', vertical: 'BEAUTY', status: 'ACTIVE' },
      ],
    });
    await tx.location.createMany({
      data: [
        { id: ids.locationA, businessId: ids.business, name: 'Beauty A', timezone: 'Asia/Almaty', currency: 'KZT' },
        { id: ids.locationB, businessId: ids.business, name: 'Beauty B', timezone: 'Asia/Almaty', currency: 'KZT' },
        { id: ids.otherLocation, businessId: ids.otherBusiness, name: 'Beauty other', timezone: 'Asia/Almaty', currency: 'KZT' },
      ],
    });
    return ids;
  }

  async function rolledBack(
    fn: (fixture: { tx: DbTx; service: BeautyPositionsService; ids: Awaited<ReturnType<typeof seed>> }) => Promise<void>,
  ) {
    const sentinel = new Error('ROLLBACK_BEAUTY_POSITIONS_API_FIXTURE');
    let completed = false;
    try {
      await db.$transaction(async (tx) => {
        const ids = await seed(tx);
        const transactionBound = new Proxy(tx as object, {
          get(target, property, receiver) {
            if (property === '$transaction') return async (callback: (inner: DbTx) => Promise<unknown>) => callback(tx);
            return Reflect.get(target, property, receiver);
          },
        }) as unknown as Db;
        const service = new BeautyPositionsService({ db: transactionBound } as unknown as PrismaService);
        await fn({ tx, service, ids });
        completed = true;
        throw sentinel;
      }, { timeout: 30000 });
    } catch (error) {
      if (error !== sentinel) throw error;
    }
    expect(completed).toBe(true);
  }

  it('rejects a narrowed current membership through the real restricted tenant role before a write', async () =>
    rolledBack(async ({tx,ids}) => {
      await tx.membershipScope.create({data:{userId:ids.staff,organizationId:ids.org,businessId:ids.business,locationId:ids.locationA,role:'STAFF'}});
      await tx.$executeRaw`SET LOCAL ROLE wetop_app`;
      await tx.$executeRaw`SELECT set_config('app.org_id', ${ids.org}, true)`;
      const write=vi.fn().mockResolvedValue('written');
      const actor={...staffActor(ids),scope:'LOCATION' as const,locationId:ids.locationB,scopes:[{businessId:ids.business,locationId:ids.locationB,role:'STAFF' as const}]};
      await expect(withSignedInUser(actor,()=>withVerifiedBeautyOperation({section:'stock',action:'create',legacy:'desk'},()=>runWithBeautyWriteAuthorization(tx,write)))).rejects.toBeInstanceOf(ForbiddenException);
      expect(write).not.toHaveBeenCalled();
    }), 30000);

  it('locks a matching branch-specific membership using the existing restricted tenant grants', async () =>
    rolledBack(async ({tx,ids}) => {
      await tx.membership.update({where:{userId_organizationId:{userId:ids.staff,organizationId:ids.org}},data:{role:'MANAGER'}});
      await tx.membershipScope.create({data:{userId:ids.staff,organizationId:ids.org,businessId:ids.business,locationId:ids.locationB,role:'STAFF'}});
      await tx.$executeRaw`SET LOCAL ROLE wetop_app`;
      await tx.$executeRaw`SELECT set_config('app.org_id', ${ids.org}, true)`;
      const actor={...staffActor(ids),scope:'LOCATION' as const,locationId:ids.locationB,scopes:[{businessId:ids.business,locationId:ids.locationB,role:'STAFF' as const}]};
      const result=await withSignedInUser(actor,()=>withVerifiedBeautyOperation({section:'stock',action:'create',legacy:'desk'},()=>runWithBeautyWriteAuthorization(tx,()=>tx.$queryRaw<Array<{role:string}>>`SELECT current_user AS role`)));
      expect(result).toEqual([{role:'wetop_app'}]);
    }), 30000);

  it('reads the positions workspace through the real restricted tenant database role', async () =>
    rolledBack(async ({tx,service,ids}) => {
      await tx.$executeRaw`SET LOCAL ROLE wetop_app`;
      await tx.$executeRaw`SELECT set_config('app.org_id', ${ids.org}, true)`;
      const workspace=await withSignedInUser(ownerActor(ids),()=>service.list());
      expect(workspace.businessId).toBe(ids.business);
      expect(workspace.members.map(row=>row.userId)).toContain(ids.staff);
      expect(workspace.members.map(row=>row.userId)).not.toContain(ids.foreignUser);
      expect(workspace.locations.map(row=>row.id).sort()).toEqual([ids.locationA,ids.locationB].sort());
    }));

  it('создаёт и целиком заменяет матрицу с optimistic revision, не теряя состояние при stale update', async () =>
    rolledBack(async ({ tx, service, ids }) => {
      const created = await withSignedInUser(ownerActor(ids), () =>
        service.create({
          name: 'Администратор',
          permissions: [
            { section: 'employees', action: 'view', scope: 'BUSINESS' },
            { section: 'finance', action: 'refund', scope: 'BUSINESS' },
          ],
        }),
      );
      expect(created).toMatchObject({ name: 'Администратор', revision: 1 });
      expect(created.permissions).toHaveLength(2);

      const updated = await withSignedInUser(ownerActor(ids), () =>
        service.update(created.id, {
          name: 'Старший администратор',
          expectedRevision: 1,
          permissions: [{ section: 'appointments', action: 'view', scope: 'OWN' }],
        }),
      );
      expect(updated).toMatchObject({ name: 'Старший администратор', revision: 2 });
      expect(updated.permissions).toEqual([
        expect.objectContaining({ section: 'appointments', action: 'view', scope: 'OWN' }),
      ]);

      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.update(created.id, { name: 'Потерянная правка', expectedRevision: 1, permissions: [] }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      const stored = await tx.beautyPosition.findUniqueOrThrow({ where: { id: created.id }, include: { permissions: true } });
      expect(stored).toMatchObject({ name: 'Старший администратор', revision: 2, archivedAt: null });
      expect(stored.permissions).toEqual([
        expect.objectContaining({ section: 'appointments', action: 'view', scope: 'OWN' }),
      ]);
    }));

  it('отклоняет чужого участника, должность и филиал и не расширяет старый membership scope', async () =>
    rolledBack(async ({ tx, service, ids }) => {
      const position = await withSignedInUser(ownerActor(ids), () => service.create({ name: 'Мастер', permissions: [] }));
      const foreignPosition = await tx.beautyPosition.create({
        data: { id: randomUUID(), businessId: ids.otherBusiness, name: 'Чужая должность' },
      });
      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.assign({ userId: ids.foreignUser, positionId: position.id, locationId: null, expectedRevision: 0 }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.assign({ userId: ids.staff, positionId: foreignPosition.id, locationId: null, expectedRevision: 0 }),
        ),
      ).rejects.toThrow('Выберите активную должность этого салона');
      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.assign({ userId: ids.staff, positionId: position.id, locationId: ids.otherLocation, expectedRevision: 0 }),
        ),
      ).rejects.toThrow('Выберите филиал этого салона');

      await tx.membershipScope.create({
        data: {
          id: randomUUID(),
          organizationId: ids.org,
          userId: ids.staff,
          role: 'STAFF',
          businessId: ids.business,
          locationId: ids.locationA,
        },
      });
      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.assign({ userId: ids.staff, positionId: position.id, locationId: null, expectedRevision: 0 }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        withSignedInUser(ownerActor(ids), () =>
          service.assign({ userId: ids.staff, positionId: position.id, locationId: ids.locationB, expectedRevision: 0 }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const allowed = await withSignedInUser(ownerActor(ids), () =>
        service.assign({ userId: ids.staff, positionId: position.id, locationId: ids.locationA, expectedRevision: 0 }),
      );
      expect(allowed).toMatchObject({ userId: ids.staff, locationId: ids.locationA, revision: 1, revokedAt: null });
    }));

  it('сохраняет последнюю отозванную строку и не возвращает MANAGER старые coarse-права', async () =>
    rolledBack(async ({ tx, service, ids }) => {
      const position = await withSignedInUser(ownerActor(ids), () =>
        service.create({
          name: 'Управляющий без сотрудников',
          permissions: [{ section: 'appointments', action: 'view', scope: 'BUSINESS' }],
        }),
      );
      const assigned = await withSignedInUser(ownerActor(ids), () =>
        service.assign({ userId: ids.manager, positionId: position.id, locationId: null, expectedRevision: 0 }),
      );
      const revoked = await withSignedInUser(ownerActor(ids), () =>
        service.revoke(assigned.id, { expectedRevision: assigned.revision }),
      );
      expect(revoked).toMatchObject({ id: assigned.id, revision: 2 });
      expect(revoked.revokedAt).not.toBeNull();
      expect(await tx.beautyPositionAssignment.count({ where: { id: assigned.id } })).toBe(1);

      await expect(
        withSignedInUser(managerActor(ids), () =>
          assertBeautyOperation(tx, 'employees', 'view', { legacy: 'staff' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }));

  it('не архивирует должность с активным назначением', async () =>
    rolledBack(async ({ tx, service, ids }) => {
      const position = await withSignedInUser(ownerActor(ids), () => service.create({ name: 'Активный мастер', permissions: [] }));
      await withSignedInUser(ownerActor(ids), () =>
        service.assign({ userId: ids.staff, positionId: position.id, locationId: null, expectedRevision: 0 }),
      );
      await expect(
        withSignedInUser(ownerActor(ids), () => service.archive(position.id, { expectedRevision: position.revision })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await tx.beautyPosition.findUnique({ where: { id: position.id }, select: { archivedAt: true } })).toEqual({ archivedAt: null });
    }));

  it('не позволяет обычному STAFF управлять должностями, а MANAGER менять OWNER, другого MANAGER или себя', async () =>
    rolledBack(async ({ tx, service, ids }) => {
      await expect(
        withSignedInUser(staffActor(ids), () => service.create({ name: 'Самоназначение', permissions: [] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const position = await tx.beautyPosition.create({
        data: { id: randomUUID(), businessId: ids.business, name: 'Для проверки руководителя' },
      });
      for (const userId of [ids.owner, ids.manager2, ids.manager])
        await expect(
          withSignedInUser(managerActor(ids), () =>
            service.assign({ userId, positionId: position.id, locationId: null, expectedRevision: 0 }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await tx.beautyPositionAssignment.count({ where: { positionId: position.id } })).toBe(0);
    }));
});
