import { ForbiddenException } from '@nestjs/common';
import type { DbTx } from '@pms/database';
import type { BeautyRequirement } from './access.decorator';
import type { VerifiedBeautyOperation } from '../auth/request-context';
import {
  beautyPermissionScope, can, canWrite, parseBeautyPermissions, resolveBeautyPositionAccess, roleAt,
  type BeautyAction, type BeautyAssignment, type BeautyPermissionScope, type BeautySection, type Permission, type MembershipRole, type ScopeAssignment,
} from '@pms/domain';
import {
  currentAssignments, currentBusinessId, currentLocationId, currentOrganizationId,
  currentRole, currentUserId, currentVertical, currentBeautyOperation, withVerifiedBeautyOperation,
} from '../auth/request-context';

type BeautyAccessDb = Pick<DbTx, 'beautyPositionAssignment'>;

/** No selected business is needed for the scope selector; the actor and tenant remain mandatory. */
export async function currentBeautyAssignments(db: BeautyAccessDb): Promise<BeautyAssignment[]> {
  const userId = currentUserId(), organizationId = currentOrganizationId();
  if (!userId || !organizationId || currentRole() === 'OWNER') return [];
  const rows = await db.beautyPositionAssignment.findMany({
    where: { userId, organizationId },
    include: { position: { include: { permissions: true } } },
  });
  return rows.map(row => {
    const parsed = parseBeautyPermissions(row.position.permissions.map(({ section, action, scope }) => ({ section, action, scope })));
    return { ...row, position: { archivedAt: row.position.archivedAt, permissions: parsed.ok ? parsed.value : [] } };
  });
}

/** Every retained assignment activates strict mode, including revoked assignments in another salon. */
export async function currentBeautyPositionAccess(db: BeautyAccessDb) {
  const businessId = currentBusinessId();
  if (!currentUserId() || !currentOrganizationId() || !businessId || currentVertical() !== 'BEAUTY')
    throw new ForbiddenException('Выберите доступный салон и войдите в организацию');
  return resolveBeautyPositionAccess(await currentBeautyAssignments(db), { businessId, locationId: currentLocationId() });
}

/** Intersect this with the existing MembershipScope projection; other verticals retain their old boundaries. */
export async function filterBeautyLocations<T extends { id: string; businessId: string; vertical: string }>(
  db: BeautyAccessDb, locations: readonly T[], required?: { section: BeautySection; action: BeautyAction },
): Promise<T[]> {
  const assignments = await currentBeautyAssignments(db);
  if (!assignments.length) return [...locations];
  return locations.filter(location => {
    if (location.vertical !== 'BEAUTY') return true;
    const access = resolveBeautyPositionAccess(assignments, { businessId: location.businessId, locationId: location.id });
    return access.assigned && (!required || beautyPermissionScope(access.permissions, required.section, required.action) === 'BUSINESS');
  });
}

/** OWN never authorizes a business-wide endpoint. Callers opting into OWN must filter by their own Employee. */
export async function assertBeautyOperation(
  db: BeautyAccessDb, section: BeautySection, action: BeautyAction,
  options: { legacy: Permission; own?: boolean },
): Promise<BeautyPermissionScope> {
  const role = currentRole(), businessId = currentBusinessId();
  if (!currentUserId() || !currentOrganizationId() || !role || !businessId || currentVertical() !== 'BEAUTY')
    throw new ForbiddenException('Выберите доступный салон и войдите в организацию');
  if (role === 'OWNER') return 'BUSINESS';
  if (!roleAt(role, currentAssignments(), { businessId, ...(currentLocationId() ? { locationId: currentLocationId()! } : {}) }))
    throw new ForbiddenException('Нет назначения в этот салон или филиал');
  const access = await currentBeautyPositionAccess(db);
  if (access.mode === 'LEGACY') {
    if (can(role, options.legacy)) return 'BUSINESS';
  } else if (access.assigned) {
    const scope = beautyPermissionScope(access.permissions, section, action);
    if (scope === 'BUSINESS' || (scope === 'OWN' && options.own)) return scope;
  }
  throw new ForbiddenException('У должности нет права на это действие в выбранном салоне');
}

/** A bundled self response may expose independently granted sections. Compound writes require every affected section. */
export async function authorizeBeautyRequirement(db: BeautyAccessDb, requirement: BeautyRequirement, legacy: Permission): Promise<VerifiedBeautyOperation> {
  let chosen: BeautySection | undefined;
  for (const section of [requirement.section, ...(requirement.anyOf ?? [])]) {
    try {
      await assertBeautyOperation(db, section, requirement.action, {legacy,...(requirement.own === undefined ? {} : {own:requirement.own})});
      chosen=section;
      break;
    } catch(error) { if (!(error instanceof ForbiddenException)) throw error; }
  }
  if (!chosen) throw new ForbiddenException('У должности нет права на этот раздел салона');
  for (const extra of requirement.also ?? []) await assertBeautyOperation(db,extra.section,extra.action,{legacy,...(extra.own === undefined ? {} : {own:extra.own})});
  return {section:chosen,action:requirement.action,...(requirement.own === undefined ? {} : {own:requirement.own}),legacy,...(requirement.also?{also:requirement.also}:{})};
}

/** Account writers lock this same membership before changing role, status or scope rows. */
export async function assertCurrentBeautyMembership(tx: DbTx): Promise<void> {
  const operation = currentBeautyOperation();
  if (currentVertical() !== 'BEAUTY' || !operation || operation.action === 'view') return;
  const userId = currentUserId(), organizationId = currentOrganizationId(), businessId = currentBusinessId();
  const denied = () => new ForbiddenException('Права доступа изменились. Обновите страницу и откройте форму заново.');
  if (!userId || !organizationId || !businessId) throw denied();
  const [membership] = await tx.$queryRaw<Array<{ role: MembershipRole; status: string }>>`
    SELECT role, status FROM memberships
    WHERE user_id=${userId}::uuid AND organization_id=${organizationId}::uuid FOR SHARE`;
  if (!membership || membership.status !== 'ACTIVE') throw denied();
  const rows = await tx.membershipScope.findMany({ where: { userId, organizationId }, select: { role: true, businessId: true, locationId: true } });
  const scopes: ScopeAssignment[] = rows.filter(row => row.role !== 'OWNER').map(row => ({ businessId: row.businessId, locationId: row.locationId, role: row.role as ScopeAssignment['role'] }));
  const effectiveRole = roleAt(membership.role, scopes, { businessId, ...(currentLocationId() ? { locationId: currentLocationId()! } : {}) });
  const canonical = (values: readonly ScopeAssignment[]) => values.map(row => JSON.stringify([row.businessId, row.locationId ?? null, row.role])).sort().join('\n');
  if (effectiveRole !== currentRole() || canonical(scopes) !== canonical(currentAssignments())) throw denied();
}

/** Called inside a mutation transaction. The business lock also serializes position revisions and revocation. */
export async function runWithBeautyWriteAuthorization<T>(tx: DbTx, fn: () => Promise<T>): Promise<T> {
  const operation=currentBeautyOperation();
  if(currentVertical()!=='BEAUTY'||!operation) return fn();
  const organizationId=currentOrganizationId(),businessId=currentBusinessId(),locationId=currentLocationId();
  if(!organizationId||!businessId) throw new ForbiddenException('Выберите доступный салон');
  await tx.$queryRaw`SELECT id FROM organizations WHERE id=${organizationId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM businesses WHERE id=${businessId}::uuid FOR UPDATE`;
  if(locationId) await tx.$queryRaw`SELECT id FROM locations WHERE id=${locationId}::uuid FOR UPDATE`;
  const org=await tx.organization.findUnique({where:{id:organizationId},select:{status:true,trialEndsAt:true}});
  if(!org||!canWrite(org.status,org.trialEndsAt,new Date())) throw new ForbiddenException('Организация доступна только для чтения');
  const business=await tx.business.findFirst({where:{id:businessId,organizationId,vertical:'BEAUTY',status:'ACTIVE'}});
  if(!business) throw new ForbiddenException('Салон недоступен');
  if(locationId&&!await tx.location.findFirst({where:{id:locationId,businessId,status:'ACTIVE'}})) throw new ForbiddenException('Филиал недоступен');
  await assertCurrentBeautyMembership(tx);
  await authorizeBeautyRequirement(tx,operation,operation.legacy);
  return withVerifiedBeautyOperation(operation,fn,await currentBeautyPositionAccess(tx));
}
