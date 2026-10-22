import type { Prisma } from '@pms/database';
import { BusinessCardsService } from './business-cards';
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
import {
  createBeautyLocationInChain,
  createPropertyInChain,
  NEW_PROPERTY_DEFAULTS,
} from '@pms/database';
import { can, canAt, visibleLocations } from '@pms/domain';
import { filterBeautyLocations } from '../beauty/access';
import {
  currentAssignments,
  currentOrganizationId,
  currentRole,
  currentUserId,
  hasSignedInActor,
  withReportLocation,
} from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { ScopeAware } from '../auth/scope-aware.decorator';
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

/** Current metadata for selectable Beauty/Food Locations without Property. */
const locationSelect = {
  id: true,
  name: true,
  address: true,
  currency: true,
  timezone: true,
  businessId: true,
} as const;

/** Все направления используют один аккаунт и проверенные права организации. */
export type BranchVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';

/** Вертикаль из тела запроса. Не указана, значит гостиница, как было до среза B2 (Q-256) */
export function parseBranchVertical(raw: unknown): BranchVertical {
  if (raw === undefined || raw === null || raw === '') return 'HOSPITALITY';
  if (raw === 'HOSPITALITY' || raw === 'BEAUTY' || raw === 'FOOD_SERVICE') return raw;
  throw new BadRequestException('Выберите направление: гостиница, салон красоты или ресторан');
}

/** Canonical read shape for Beauty/Food Locations, without Hospitality inventory. */
function locationBranch(
  row: {
    id: string;
    name: string;
    address: string | null;
    currency: string;
    timezone: string;
    businessId: string;
  },
  vertical: 'BEAUTY' | 'FOOD_SERVICE' = 'BEAUTY',
) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    currency: row.currency,
    timezone: row.timezone,
    vertical,
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
    // Beauty/Food selectable Locations have no Property; keep current Location metadata authoritative.
    const locations = await this.prisma.db.location.findMany({
      where: {
        status: 'ACTIVE',
        business: {
          organizationId,
          status: 'ACTIVE',
          vertical: { in: ['BEAUTY', 'FOOD_SERVICE'] },
        },
        property: null,
      },
      select: { ...locationSelect, business: { select: { vertical: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const all = [
      ...properties.map((item) => ({ ...item, vertical: 'HOSPITALITY' as const })),
      ...locations.map((row) =>
        locationBranch(row, row.business.vertical === 'FOOD_SERVICE' ? 'FOOD_SERVICE' : 'BEAUTY'),
      ),
    ];
    // человек с областью доступа видит только свои бизнесы и филиалы (DATA_MODEL §31.1): остальных нет и в списке
    const role = currentRole() ?? 'STAFF';
    const assignments = currentAssignments();
    const visible = new Set(
      visibleLocations(
        role,
        assignments,
        all.map((item) => ({ id: item.locationId, businessId: item.location.businessId })),
      ).map((l) => l.id),
    );
    const permitted = new Set((await filterBeautyLocations(this.prisma.db, all.map(item => ({ id:item.locationId,businessId:item.location.businessId,vertical:item.vertical })))).map(row=>row.id));
    const items = all.filter((item) => visible.has(item.locationId) && permitted.has(item.locationId));
    // `personal`: «Личный кабинет», стойка сама выбирает его филиал и ведёт в «Мою работу» (`/scope/resolve`)
    return { organization, items, canCreate: currentRole() === 'OWNER', personal: currentRole() === 'EMPLOYEE' };
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
    const businessId = typeof body.businessId === 'string' ? body.businessId : undefined;
    const newBusinessId = typeof body.newBusinessId === 'string' ? body.newBusinessId : undefined;
    const businessName =
      typeof body.businessName === 'string' ? body.businessName.trim() : undefined;
    if (
      (businessId && (!UUID.test(businessId) || newBusinessId || businessName)) ||
      (newBusinessId && (!UUID.test(newBusinessId) || !businessName)) ||
      (businessName && (!newBusinessId || businessName.length > 200))
    )
      throw new BadRequestException(
        'Выберите бизнес или укажите название нового бизнеса до 200 символов',
      );
    const ownership = {
      ...(businessId ? { businessId } : {}),
      ...(newBusinessId ? { newBusinessId, businessName: businessName! } : {}),
    };
    const vertical = parseBranchVertical(body.vertical);
    if (vertical !== 'HOSPITALITY')
      return this.createServiceBranch(
        { id, name, address, currency, timezone },
        vertical,
        ownership,
      );
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.property.findFirst({ where: { id, organizationId }, select });
      const hospitality = <T>(row: T) => ({ ...row, vertical: 'HOSPITALITY' as const });
      if (existing) {
        if (
          ((businessId || newBusinessId) &&
            existing.location.businessId !== (businessId || newBusinessId)) ||
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
      const chosenBusiness = await this.creationBusiness(tx, vertical, ownership);
      const property = await createPropertyInChain(
        tx,
        organizationId,
        {
          ...NEW_PROPERTY_DEFAULTS,
          id,
          name,
          address: address || null,
          currency,
          timezone,
        },
        chosenBusiness,
      );
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

  private async creationBusiness(
    tx: Prisma.TransactionClient,
    vertical: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE',
    ownership: { businessId?: string; newBusinessId?: string; businessName?: string },
  ) {
    const organizationId = this.organization();
    if (ownership.businessId) {
      const business = await tx.business.findFirst({
        where: { id: ownership.businessId, organizationId, vertical, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!business)
        throw new BadRequestException('Выбранный бизнес недоступен или имеет другое направление');
      return business.id;
    }
    if (ownership.newBusinessId && ownership.businessName) {
      const business = await tx.business.create({
        data: {
          id: ownership.newBusinessId,
          organizationId,
          name: ownership.businessName,
          vertical,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId(),
          entityType: 'business',
          entityId: business.id,
          action: 'business.created',
          after: { name: ownership.businessName, vertical },
        },
      });
      return business.id;
    }
    return undefined;
  }

  /**
   * Филиал салона (срез B2, Q-256): цепочка Organization → Business (BEAUTY) → Location, объекта нет.
   * Повтор того же запроса возвращает тот же филиал, как у гостиницы: повторное нажатие не плодит салоны.
   */
  private async createServiceBranch(
    data: {
      id: string;
      name: string;
      address: string;
      currency: string;
      timezone: string;
    },
    vertical: 'BEAUTY' | 'FOOD_SERVICE' = 'BEAUTY',
    ownership: { businessId?: string; newBusinessId?: string; businessName?: string } = {},
  ) {
    const organizationId = this.organization();
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const existing = await tx.location.findFirst({
        where: { id: data.id, business: { organizationId } },
        select: locationSelect,
      });
      if (existing) {
        const business = await tx.business.findFirst({
          where: { id: existing.businessId, organizationId, vertical, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!business)
          throw new ConflictException('Этот филиал другого направления. Обновите форму.');
        if (
          ((ownership.businessId || ownership.newBusinessId) &&
            existing.businessId !== (ownership.businessId || ownership.newBusinessId)) ||
          existing.name !== data.name ||
          (existing.address ?? '') !== data.address ||
          existing.currency !== data.currency ||
          existing.timezone !== data.timezone
        )
          throw new ConflictException(
            'Этот запрос уже сохранён с другими данными. Обновите страницу перед повтором.',
          );
        return locationBranch(existing, vertical);
      }
      const chosenBusiness = await this.creationBusiness(tx, vertical, ownership);
      const location = await createBeautyLocationInChain(
        tx,
        organizationId,
        {
          id: data.id,
          name: data.name,
          address: data.address || null,
          timezone: data.timezone,
          currency: data.currency,
        },
        vertical,
        chosenBusiness,
      );
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: currentUserId(),
          entityType: 'location',
          entityId: location.id,
          action:
            vertical === 'FOOD_SERVICE' ? 'location.restaurant_created' : 'location.salon_created',
          after: {
            name: data.name,
            businessId: location.businessId,
            currency: data.currency,
            timezone: data.timezone,
          },
        },
      });
      return locationBranch({ ...location, address: location.address ?? null }, vertical);
    });
  }
}

@Controller('branches')
export class BranchesController {
  constructor(
    @Inject(BranchesService) private readonly service: BranchesService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(BusinessCardsService) private readonly cards: BusinessCardsService,
  ) {}
  // Список своих филиалов нужен каждому вошедшему: по нему стойка выбирает рабочий филиал (`/scope/resolve`). С
  // правом `desk` «Личный кабинет» (EMPLOYEE) получал 403 и не попадал в свой кабинет (живой аудит 21.10.2026). Список
  // уже сужен назначениями (`visibleLocations`, `filterBeautyLocations`); карточки бизнесов отдаются только с `desk`.
  @Access('self') @ScopeAware() @Get() async list() {
    const result = await this.service.list();
    return {
      ...result,
      businesses: can(currentRole() ?? 'EMPLOYEE', 'desk')
        ? await this.cards.list(
            result.items.map((item) => item.location.businessId),
            currentRole() === 'OWNER',
          )
        : [],
    };
  }
  @Access('reports')
  @ScopeAware()
  @Get('overview')
  async overview(@Query('from') from: string, @Query('to') to: string) {
    const { items } = await this.service.list();
    const rows = [];
    // Сводка гостиничная (решение владельца 06.10.2026, вариант A): показатели DashboardService есть только у филиала с
    // объектом. Салон и ресторан сюда не входят и нулями не показываются: их метрики относятся к MV9.
    const role = currentRole() ?? 'STAFF';
    const assignments = currentAssignments();
    for (const branch of items.filter(
      (item) =>
        item.vertical === 'HOSPITALITY' &&
        // отчёты по месту: роль в этом филиале должна их открывать (DATA_MODEL §31.1)
        canAt(role, assignments, 'reports', {
          businessId: item.location.businessId,
          locationId: item.locationId,
        }),
    )) {
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
