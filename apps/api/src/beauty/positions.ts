import { BadRequestException, Body, ConflictException, Controller, Get, Inject, Injectable, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { can, canRemoveMember, parseBeautyPermissions, roleAt, type BeautyAction, type MembershipRole } from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentAssignments, currentBusinessId, currentOrganizationId, currentRole, currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { BeautyAccess } from './access.decorator';
import { assertBeautyOperation } from './access';
import { beautyScope, beautyTransaction, mayBeautyWrite, UUID, type BeautyScope } from './scope';
import { ForbiddenException } from '@nestjs/common';

function bodyOf(raw: unknown, keys: string[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !keys.includes(key))) throw new BadRequestException('Проверьте поля запроса');
  return raw as Record<string, unknown>;
}
function revisionOf(raw: unknown, allowNew = false): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < (allowNew ? 0 : 1)) throw new BadRequestException('Укажите текущую версию данных');
  return raw;
}
function checkedId(raw: unknown): string {
  if (typeof raw !== 'string' || !UUID.test(raw)) throw new BadRequestException('Выберите существующую запись');
  return raw;
}
function positionInput(raw: unknown, updating = false) {
  const body = bodyOf(raw, ['name', 'permissions', ...(updating ? ['expectedRevision'] : [])]);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) throw new BadRequestException('Название должности: от 1 до 100 знаков');
  const parsed = parseBeautyPermissions(body.permissions);
  if (!parsed.ok) throw new BadRequestException(parsed.reason);
  return { name, permissions: parsed.value, expectedRevision: updating ? revisionOf(body.expectedRevision) : 0 };
}
const positionView = (row: { id: string; name: string; revision: number; archivedAt: Date | null; permissions: Array<{section:string;action:string;scope:string}> }) => ({
  id: row.id, name: row.name, revision: row.revision, archivedAt: row.archivedAt?.toISOString() ?? null,
  permissions: row.permissions.map(({section,action,scope}) => ({section,action,scope})),
});
const assignmentView = (row: { id: string; userId: string; locationId: string | null; positionId: string; revision: number; revokedAt: Date | null }) => ({
  id: row.id, userId: row.userId, locationId: row.locationId, positionId: row.positionId, revision: row.revision, revokedAt: row.revokedAt?.toISOString() ?? null,
});

@Injectable()
export class BeautyPositionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async manager(db: Pick<DbTx, 'beautyPositionAssignment'>, action: BeautyAction) {
    const role = currentRole(), businessId = currentBusinessId();
    if (!role || !can(role, 'staff') || !businessId || !currentUserId() || !currentOrganizationId() ||
      !roleAt(role, currentAssignments(), { businessId })) throw new ForbiddenException('Должностями салона управляет руководитель бизнеса');
    await assertBeautyOperation(db, 'employees', action, { legacy: 'staff' });
  }

  private async write<T>(scope: BeautyScope, action: BeautyAction, fn: (tx: DbTx) => Promise<T>): Promise<T> {
    return withServiceDatabase(() => beautyTransaction(this.prisma, scope, async tx => {
      await this.manager(tx, action);
      return fn(tx);
    }));
  }

  async list() {
    await this.manager(this.prisma.db, 'view');
    const scope = await beautyScope(this.prisma);
    const [positions, assignments, members, locations, legacyScopes] = await Promise.all([
      this.prisma.db.beautyPosition.findMany({ where: { businessId: scope.businessId }, include: { permissions: { orderBy: [{section:'asc'},{action:'asc'}] } }, orderBy: [{name:'asc'},{id:'asc'}], take: 501 }),
      this.prisma.db.beautyPositionAssignment.findMany({ where: { businessId: scope.businessId, organizationId: scope.organizationId }, orderBy: [{createdAt:'asc'},{id:'asc'}], take: 2001 }),
      this.prisma.db.membership.findMany({ where: { organizationId: scope.organizationId, status: 'ACTIVE', user: { status: 'ACTIVE', emailVerifiedAt: {not:null} } }, include: { user: { select: { name: true, email: true } } }, orderBy: {createdAt:'asc'}, take: 2001 }),
      this.prisma.db.location.findMany({ where: { businessId: scope.businessId, status: 'ACTIVE' }, select: {id:true,name:true}, orderBy: [{name:'asc'},{id:'asc'}] }),
      this.prisma.db.membershipScope.findMany({ where: {organizationId:scope.organizationId}, take:10001 }),
    ]);
    if (positions.length > 500 || assignments.length > 2000 || members.length > 2000 || legacyScopes.length > 10000) throw new ConflictException('Слишком много записей для этого экрана. Обратитесь к руководителю.');
    const actorRole = currentRole()!;
    const eligible = members.filter(member => member.userId !== currentUserId() && canRemoveMember(actorRole, member.role as MembershipRole)).map(member => {
      const scopes = legacyScopes.filter(row => row.userId === member.userId).map(row => ({ businessId:row.businessId, locationId:row.locationId, role:row.role as 'MANAGER'|'STAFF' }));
      const targets = locations.filter(location => roleAt(member.role as MembershipRole, scopes, {businessId:scope.businessId,locationId:location.id}));
      return { userId:member.userId, name:member.user.name, email:member.user.email, businessWide:roleAt(member.role as MembershipRole,scopes,{businessId:scope.businessId}) !== null, locationIds:targets.map(row=>row.id) };
    }).filter(member => member.businessWide || member.locationIds.length > 0);
    return { businessId:scope.businessId, positions:positions.map(positionView), assignments:assignments.map(assignmentView), members:eligible, locations };
  }

  async create(raw: unknown) {
    await this.manager(this.prisma.db, 'create');
    const input = positionInput(raw);
    await mayBeautyWrite(this.prisma, 'staff');
    const scope = await beautyScope(this.prisma);
    return this.write(scope, 'create', async tx => {
      const row = await tx.beautyPosition.create({ data: { id:randomUUID(), businessId:scope.businessId, name:input.name, permissions:{create:input.permissions} }, include:{permissions:true} });
      await this.audit(tx, scope, 'beauty.position.created', row.id, null, positionView(row));
      return positionView(row);
    });
  }

  async update(positionId: string, raw: unknown) {
    await this.manager(this.prisma.db, 'update');
    checkedId(positionId);
    const input = positionInput(raw, true);
    await mayBeautyWrite(this.prisma, 'staff');
    const scope = await beautyScope(this.prisma);
    return this.write(scope, 'update', async tx => {
      const old = await tx.beautyPosition.findFirst({where:{id:positionId,businessId:scope.businessId,archivedAt:null},include:{permissions:true}});
      if (!old) throw new NotFoundException('Должность не найдена или в архиве');
      const saved = await tx.beautyPosition.updateMany({where:{id:positionId,revision:input.expectedRevision},data:{name:input.name,revision:{increment:1}}});
      if (saved.count !== 1) throw new ConflictException('Должность изменена. Обновите данные перед сохранением.');
      await tx.beautyPositionPermission.deleteMany({where:{positionId}});
      if (input.permissions.length) await tx.beautyPositionPermission.createMany({data:input.permissions.map(permission=>({...permission,positionId}))});
      const row = await tx.beautyPosition.findUniqueOrThrow({where:{id:positionId},include:{permissions:true}});
      await this.audit(tx,scope,'beauty.position.updated',row.id,positionView(old),positionView(row));
      return positionView(row);
    });
  }

  async archive(positionId: string, raw: unknown) {
    await this.manager(this.prisma.db, 'delete');
    checkedId(positionId);
    const body = bodyOf(raw,['expectedRevision']), expectedRevision=revisionOf(body.expectedRevision);
    await mayBeautyWrite(this.prisma,'staff');
    const scope=await beautyScope(this.prisma);
    return this.write(scope,'delete',async tx=>{
      const old=await tx.beautyPosition.findFirst({where:{id:positionId,businessId:scope.businessId,archivedAt:null},include:{permissions:true}});
      if (!old) throw new NotFoundException('Должность не найдена или в архиве');
      if (await tx.beautyPositionAssignment.count({where:{positionId,revokedAt:null}})) throw new ConflictException('Сначала переназначьте сотрудников этой должности или отзовите назначения.');
      const saved=await tx.beautyPosition.updateMany({where:{id:positionId,revision:expectedRevision},data:{archivedAt:new Date(),revision:{increment:1}}});
      if(saved.count!==1) throw new ConflictException('Должность изменена. Обновите данные.');
      const row=await tx.beautyPosition.findUniqueOrThrow({where:{id:positionId},include:{permissions:true}});
      await this.audit(tx,scope,'beauty.position.archived',row.id,positionView(old),positionView(row));
      return positionView(row);
    });
  }

  private async targetMember(tx: DbTx, scope: BeautyScope, userId: string) {
    if (userId === currentUserId()) throw new ForbiddenException('Своё назначение меняет другой руководитель');
    await tx.$queryRaw`SELECT user_id FROM memberships WHERE user_id=${userId}::uuid AND organization_id=${scope.organizationId}::uuid FOR UPDATE`;
    const target=await tx.membership.findFirst({where:{userId,organizationId:scope.organizationId,status:'ACTIVE',user:{status:'ACTIVE',emailVerifiedAt:{not:null}}}});
    if (!target || !canRemoveMember(currentRole()!, target.role as MembershipRole)) throw new ForbiddenException('Этот аккаунт недоступен для назначения');
    return target;
  }

  async assign(raw: unknown) {
    await this.manager(this.prisma.db,'update');
    const body=bodyOf(raw,['userId','positionId','locationId','expectedRevision']);
    const userId=checkedId(body.userId), positionId=checkedId(body.positionId), locationId=body.locationId === null ? null : checkedId(body.locationId);
    const expectedRevision=revisionOf(body.expectedRevision,true);
    await mayBeautyWrite(this.prisma,'staff');
    const scope=await beautyScope(this.prisma);
    return this.write(scope,'update',async tx=>{
      const target=await this.targetMember(tx,scope,userId);
      const oldScopes=await tx.membershipScope.findMany({where:{userId,organizationId:scope.organizationId}});
      const scopes=oldScopes.map(row=>({businessId:row.businessId,locationId:row.locationId,role:row.role as 'MANAGER'|'STAFF'}));
      if(!roleAt(target.role as MembershipRole,scopes,{businessId:scope.businessId,...(locationId?{locationId}:{})})) throw new ForbiddenException('Назначение выходит за существующий доступ сотрудника');
      if(locationId && !await tx.location.findFirst({where:{id:locationId,businessId:scope.businessId,status:'ACTIVE'},select:{id:true}})) throw new BadRequestException('Выберите филиал этого салона');
      if(!await tx.beautyPosition.findFirst({where:{id:positionId,businessId:scope.businessId,archivedAt:null},select:{id:true}})) throw new BadRequestException('Выберите активную должность этого салона');
      const old=await tx.beautyPositionAssignment.findFirst({where:{organizationId:scope.organizationId,userId,businessId:scope.businessId,locationId}});
      if((old?.revision??0)!==expectedRevision) throw new ConflictException('Назначение изменено. Обновите данные.');
      const row=old ? await tx.beautyPositionAssignment.update({where:{id:old.id},data:{positionId,revokedAt:null,revision:{increment:1}}}) : await tx.beautyPositionAssignment.create({data:{organizationId:scope.organizationId,userId,businessId:scope.businessId,locationId,positionId}});
      await this.audit(tx,scope,'beauty.position.assigned',row.id,old?assignmentView(old):null,assignmentView(row),'beauty_position_assignment');
      return assignmentView(row);
    });
  }

  async revoke(assignmentId: string, raw: unknown) {
    await this.manager(this.prisma.db,'update');
    checkedId(assignmentId);
    const body=bodyOf(raw,['expectedRevision']), expectedRevision=revisionOf(body.expectedRevision);
    await mayBeautyWrite(this.prisma,'staff');
    const scope=await beautyScope(this.prisma);
    return this.write(scope,'update',async tx=>{
      const old=await tx.beautyPositionAssignment.findFirst({where:{id:assignmentId,businessId:scope.businessId,organizationId:scope.organizationId}});
      if(!old) throw new NotFoundException('Назначение не найдено');
      await this.targetMember(tx,scope,old.userId);
      if(old.revision!==expectedRevision) throw new ConflictException('Назначение изменено. Обновите данные.');
      const row=await tx.beautyPositionAssignment.update({where:{id:old.id},data:{revokedAt:new Date(),revision:{increment:1}}});
      await this.audit(tx,scope,'beauty.position.revoked',row.id,assignmentView(old),assignmentView(row),'beauty_position_assignment');
      return assignmentView(row);
    });
  }

  private async audit(tx: DbTx, scope: BeautyScope, action: string, entityId: string, before: unknown, after: unknown, entityType='beauty_position') {
    await tx.auditLog.create({data:{organizationId:scope.organizationId,userId:currentUserId(),action,entityType,entityId,before:(before ?? {}) as Prisma.InputJsonValue,after:after as Prisma.InputJsonValue}});
  }
}

@RequiresBusinessCapability('beauty.employees')
@Access('staff')
@Controller('beauty/positions')
export class BeautyPositionsController {
  constructor(@Inject(BeautyPositionsService) private readonly service: BeautyPositionsService) {}
  @Get() @BeautyAccess('employees','view',{managerOnly:true}) list() {return this.service.list();}
  @Post() @BeautyAccess('employees','create',{managerOnly:true}) create(@Body() body: unknown) {return this.service.create(body);}
  @Patch(':id') @BeautyAccess('employees','update',{managerOnly:true}) update(@Param('id') id: string,@Body() body: unknown) {return this.service.update(id,body);}
  @Post(':id/archive') @BeautyAccess('employees','delete',{managerOnly:true}) archive(@Param('id') id: string,@Body() body: unknown) {return this.service.archive(id,body);}
  @Put('assignments') @BeautyAccess('employees','update',{managerOnly:true}) assign(@Body() body: unknown) {return this.service.assign(body);}
  @Post('assignments/:id/revoke') @BeautyAccess('employees','update',{managerOnly:true}) revoke(@Param('id') id: string,@Body() body: unknown) {return this.service.revoke(id,body);}
}
