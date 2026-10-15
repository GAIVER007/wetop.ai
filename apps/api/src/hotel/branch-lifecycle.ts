import 'reflect-metadata';
import {
  Controller,
  Get,
  Post,
  Param,
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import {
  currentOrganizationId,
  currentRole,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable()
export class BranchLifecycleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private owner() {
    const org = currentOrganizationId();
    if (!hasSignedInActor() || !org || currentRole() !== 'OWNER')
      throw new ForbiddenException('Архивом управляет владелец организации');
    return org;
  }
  async archived() {
    const organizationId = this.owner();
    const rows = await this.prisma.db.location.findMany({
      where: { status: 'ARCHIVED', business: { organizationId, status: 'ACTIVE' } },
      select: {
        id: true,
        name: true,
        address: true,
        business: { select: { name: true, vertical: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      businessName: row.business.name,
      vertical: row.business.vertical,
    }));
  }
  async setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED') {
    const organizationId = this.owner();
    if (!UUID.test(id)) throw new BadRequestException('Некорректный объект');
    return this.prisma.db.$transaction(async (tx) => {
      const row = await tx.location.findFirst({
        where: { id, business: { organizationId, status: 'ACTIVE' } },
        select: { id: true, name: true, status: true },
      });
      if (!row) throw new NotFoundException('Объект недоступен');
      if (row.status === status) return { id, status };
      const result = await tx.location.updateMany({
        where: { id, status: row.status, business: { organizationId, status: 'ACTIVE' } },
        data: { status },
      });
      if (result.count !== 1)
        throw new ConflictException('Состояние объекта изменилось. Обновите список.');
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId(),
          entityType: 'location',
          entityId: id,
          action: status === 'ARCHIVED' ? 'location.archived' : 'location.restored',
          before: { name: row.name, status: row.status },
          after: { name: row.name, status },
        },
      });
      return { id, status };
    });
  }
}
@Controller('branches/locations')
@ScopeAware()
@Access('owner')
export class BranchLifecycleController {
  constructor(@Inject(BranchLifecycleService) private readonly service: BranchLifecycleService) {}
  @Get('archived') archived() {
    return this.service.archived();
  }
  @Post(':id/archive') archive(@Param('id') id: string) {
    return this.service.setStatus(id, 'ARCHIVED');
  }
  @Post(':id/restore') restore(@Param('id') id: string) {
    return this.service.setStatus(id, 'ACTIVE');
  }
}
