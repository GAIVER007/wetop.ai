import { DashboardService } from '../dashboard/dashboard.service';
import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Post,
  Query,
} from '@nestjs/common';
import { createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
import {
  currentOrganizationId,
  currentRole,
  currentUserId,
  hasSignedInActor,
  withReportLocation,
} from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const select = {
  id: true,
  name: true,
  address: true,
  currency: true,
  timezone: true,
  locationId: true,
  location: { select: { businessId: true } },
  _count: { select: { inventoryUnits: true, accommodationTypes: true } },
} as const;

@Injectable()
export class BranchesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private organization() {
    const id = currentOrganizationId();
    if (!hasSignedInActor() || !id) throw new ForbiddenException('Войдите в организацию');
    return id;
  }
  async list() {
    const organizationId = this.organization();
    const organization = await this.prisma.db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true, status: true },
    });
    const items = await this.prisma.db.property.findMany({
      where: {
        organizationId,
        location: { status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      },
      select,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { organization, items, canCreate: currentRole() === 'OWNER' };
  }
  async create(raw: unknown) {
    const organizationId = this.organization();
    if (currentRole() !== 'OWNER')
      throw new ForbiddenException('Филиал добавляет владелец организации');
    const body = (raw ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const id = typeof body.id === 'string' ? body.id : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    if (!UUID.test(id) || !name || name.length > 200 || address.length > 500)
      throw new BadRequestException(
        'Укажите название до 200 символов и корректный идентификатор запроса',
      );
    // Валюта и пояс явно выбираются владельцем, не копируются из первого филиала.
    const currency = typeof body.currency === 'string' ? body.currency : '';
    const timezone = typeof body.timezone === 'string' ? body.timezone : '';
    if (!Intl.supportedValuesOf('currency').includes(currency))
      throw new BadRequestException('Выберите валюту');
    try {
      new Intl.DateTimeFormat('ru', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Укажите часовой пояс IANA');
    }
    if (!timezone) throw new BadRequestException('Укажите часовой пояс');
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.property.findFirst({ where: { id, organizationId }, select });
      if (existing) {
        if (
          existing.name !== name ||
          (existing.address ?? '') !== address ||
          existing.currency !== currency ||
          existing.timezone !== timezone
        )
          throw new ConflictException(
            'Этот запрос уже сохранён с другими данными. Обновите страницу перед повтором.',
          );
        return existing;
      }
      const property = await createPropertyInChain(tx, organizationId, {
        ...NEW_PROPERTY_DEFAULTS,
        id,
        name,
        address: address || null,
        currency,
        timezone,
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId(),
          entityType: 'property',
          entityId: property.id,
          action: 'property.branch_created',
          after: { name, locationId: property.locationId, currency, timezone },
        },
      });
      return tx.property.findFirstOrThrow({ where: { id: property.id, organizationId }, select });
    });
  }
}

@Controller('branches')
export class BranchesController {
  constructor(
    @Inject(BranchesService) private readonly service: BranchesService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}
  @Access('desk') @Get() list() {
    return this.service.list();
  }
  @Access('reports')
  @Get('overview')
  async overview(@Query('from') from: string, @Query('to') to: string) {
    const { items } = await this.service.list();
    const rows = [];
    for (const branch of items) {
      const stats = await withReportLocation(branch.location.businessId, branch.locationId, () =>
        this.dashboard.dashboard(from, to),
      );
      rows.push({ branch, stats: stats.current });
    }
    return { from, to, rows };
  }
  @Access('owner') @Post() create(@Body() body: unknown) {
    return this.service.create(body);
  }
}
