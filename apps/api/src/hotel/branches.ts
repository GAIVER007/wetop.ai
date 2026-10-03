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
import { createBeautyLocationInChain, createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
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

/** Филиал салона: у него нет объекта, поля те же живут на Location (DATA_MODEL §19, Q-256) */
const beautySelect = {
  id: true,
  name: true,
  address: true,
  currency: true,
  timezone: true,
  businessId: true,
} as const;

/** Что показывает и создаёт этот модуль: гостиница с объектом или салон без него (ADR-140, Q-254) */
export type BranchVertical = 'HOSPITALITY' | 'BEAUTY';

/** Вертикаль из тела запроса. Не указана, значит гостиница, как было до среза B2 (Q-256) */
export function parseBranchVertical(raw: unknown): BranchVertical {
  if (raw === undefined || raw === null || raw === '') return 'HOSPITALITY';
  if (raw === 'HOSPITALITY' || raw === 'BEAUTY') return raw;
  throw new BadRequestException('Выберите направление: гостиница или салон красоты');
}

/** Филиал салона в той же форме, что гостиничный: экран и переключатель филиала читают одно поле */
function beautyBranch(row: {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  businessId: string;
}) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    currency: row.currency,
    timezone: row.timezone,
    vertical: 'BEAUTY' as const,
    locationId: row.id,
    location: { businessId: row.businessId },
    _count: { inventoryUnits: 0, accommodationTypes: 0 },
  };
}

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
    const properties = await this.prisma.db.property.findMany({
      where: {
        organizationId,
        location: { status: 'ACTIVE', business: { organizationId, status: 'ACTIVE' } },
      },
      select,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    // Филиалы салонов: у них объекта нет вовсе (DATA_MODEL §19), поэтому берутся прямо из Location
    const salons = await this.prisma.db.location.findMany({
      where: {
        status: 'ACTIVE',
        business: { organizationId, status: 'ACTIVE', vertical: 'BEAUTY' },
        property: null,
      },
      select: beautySelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const items = [
      ...properties.map((item) => ({ ...item, vertical: 'HOSPITALITY' as const })),
      ...salons.map(beautyBranch),
    ];
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
    const vertical = parseBranchVertical(body.vertical);
    if (vertical === 'BEAUTY') return this.createSalon({ id, name, address, currency, timezone });
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.property.findFirst({ where: { id, organizationId }, select });
      const hospitality = <T>(row: T) => ({ ...row, vertical: 'HOSPITALITY' as const });
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
        return hospitality(existing);
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
      return hospitality(
        await tx.property.findFirstOrThrow({ where: { id: property.id, organizationId }, select }),
      );
    });
  }

  /**
   * Филиал салона (срез B2, Q-256): цепочка Organization → Business (BEAUTY) → Location, объекта нет.
   * Повтор того же запроса возвращает тот же филиал, как у гостиницы: повторное нажатие не плодит салоны.
   */
  private async createSalon(data: {
    id: string;
    name: string;
    address: string;
    currency: string;
    timezone: string;
  }) {
    const organizationId = this.organization();
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.location.findFirst({
        where: { id: data.id, business: { organizationId } },
        select: beautySelect,
      });
      if (existing) {
        if (
          existing.name !== data.name ||
          (existing.address ?? '') !== data.address ||
          existing.currency !== data.currency ||
          existing.timezone !== data.timezone
        )
          throw new ConflictException(
            'Этот запрос уже сохранён с другими данными. Обновите страницу перед повтором.',
          );
        return beautyBranch(existing);
      }
      const location = await createBeautyLocationInChain(tx, organizationId, {
        id: data.id,
        name: data.name,
        address: data.address || null,
        timezone: data.timezone,
        currency: data.currency,
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId(),
          entityType: 'location',
          entityId: location.id,
          action: 'location.salon_created',
          after: {
            name: data.name,
            businessId: location.businessId,
            currency: data.currency,
            timezone: data.timezone,
          },
        },
      });
      return beautyBranch({ ...location, address: location.address ?? null });
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
