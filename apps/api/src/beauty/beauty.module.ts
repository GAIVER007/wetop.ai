import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  effectiveService,
  parseBeautyServiceInput,
  parseEmployeeInput,
  parseLocationServiceInput,
  type Permission,
} from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { BeautyScheduleController, BeautyScheduleService } from './schedule';
import { beautyScope, mayBeauty, UUID, type BeautyScope } from './scope';

/**
 * Каталог салона: услуги сети и мастера (DATA_MODEL §19 и §19.1, срез B3, ADR-140).
 *
 * Права по решению Q-253 (те же 13, подписи по вертикали): каталог услуг и его цены это `rates` (в салоне
 * список услуг и есть прайс), мастера это `property` (в гостинице это право закрывает то, что продаётся).
 * Чтение открыто `desk`: расписание и записи без каталога не нарисовать.
 *
 * Чего здесь нет: записей, расписания и денег. Записи это срез B5, деньги B7 (DATA_MODEL §21.5).
 */

@Injectable()
export class BeautyCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private may(permission: Permission): void {
    mayBeauty(permission);
  }

  private scope(): Promise<BeautyScope> {
    return beautyScope(this.prisma);
  }

  /** Услуги каталога с тем, что про них говорит филиал: действующая цена считается домéном */
  async services() {
    this.may('desk');
    const scope = await this.scope();
    const rows = await this.prisma.db.beautyService.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        durationMinutes: true,
        price: true,
        currency: true,
        active: true,
        locations: scope.locationId
          ? {
              where: { locationId: scope.locationId },
              select: { enabled: true, priceOverride: true, durationOverride: true },
            }
          : false,
      },
    });
    return {
      locationId: scope.locationId,
      locationCurrency: scope.locationCurrency,
      items: rows.map((row) => serviceView(row, scope.locationCurrency)),
    };
  }

  async createService(raw: unknown) {
    this.may('rates');
    const parsed = parseBeautyServiceInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value as Required<NonNullable<typeof parsed.value>>;
    const scope = await this.scope();
    const created = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.beautyService.create({
        data: {
          id: randomUUID(),
          businessId: scope.businessId,
          name: input.name,
          category: input.category,
          durationMinutes: input.durationMinutes,
          price: input.priceMinor,
          currency: input.currency,
          active: input.active,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'beauty_service',
          entityId: row.id,
          action: 'beauty.service.created',
          after: plain(row),
        },
      });
      return row;
    });
    return serviceView({ ...created, locations: [] }, scope.locationCurrency);
  }

  async updateService(id: string, raw: unknown) {
    this.may('rates');
    if (!UUID.test(id)) throw new NotFoundException('Услуга не найдена');
    const parsed = parseBeautyServiceInput(raw, { partial: true });
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    const current = await this.prisma.db.beautyService.findFirst({
      where: { id, businessId: scope.businessId },
    });
    if (!current) throw new NotFoundException('Услуга не найдена');
    const p = parsed.value;
    // данные для Prisma: цена здесь bigint, в журнал она уйдёт строкой через plain()
    const data: {
      name?: string;
      category?: string | null;
      durationMinutes?: number;
      price?: bigint;
      currency?: string;
      active?: boolean;
    } = {};
    if (p.name !== undefined && p.name !== current.name) data.name = p.name;
    if (p.category !== undefined && p.category !== current.category) data.category = p.category;
    if (p.durationMinutes !== undefined && p.durationMinutes !== current.durationMinutes)
      data.durationMinutes = p.durationMinutes;
    if (p.priceMinor !== undefined && p.priceMinor !== current.price) data.price = p.priceMinor;
    if (p.currency !== undefined && p.currency !== current.currency) data.currency = p.currency;
    if (p.active !== undefined && p.active !== current.active) data.active = p.active;
    if (Object.keys(data).length === 0)
      return serviceView({ ...current, locations: [] }, scope.locationCurrency);
    const updated = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.beautyService.update({ where: { id: current.id }, data });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'beauty_service',
          entityId: row.id,
          action: 'beauty.service.updated',
          before: pick(plain(current), Object.keys(data)),
          after: pick(plain(row), Object.keys(data)),
        },
      });
      return row;
    });
    return serviceView({ ...updated, locations: [] }, scope.locationCurrency);
  }

  /** Что филиал делает с услугой каталога: включает и ставит свои цену и длительность */
  async setLocationService(id: string, raw: unknown) {
    this.may('rates');
    if (!UUID.test(id)) throw new NotFoundException('Услуга не найдена');
    const parsed = parseLocationServiceInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    if (!scope.locationId)
      throw new BadRequestException('Выберите филиал: цену и доступность услуги задаёт он');
    const service = await this.prisma.db.beautyService.findFirst({
      where: { id, businessId: scope.businessId },
      select: { id: true },
    });
    if (!service) throw new NotFoundException('Услуга не найдена');
    const input = parsed.value;
    await this.prisma.db.$transaction(async (tx) => {
      await tx.locationService.upsert({
        where: { locationId_serviceId: { locationId: scope.locationId!, serviceId: service.id } },
        create: {
          locationId: scope.locationId!,
          serviceId: service.id,
          enabled: input.enabled,
          priceOverride: input.priceOverrideMinor,
          durationOverride: input.durationOverrideMinutes,
        },
        update: {
          enabled: input.enabled,
          priceOverride: input.priceOverrideMinor,
          durationOverride: input.durationOverrideMinutes,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'location_service',
          entityId: service.id,
          action: 'beauty.location_service.set',
          after: {
            locationId: scope.locationId,
            enabled: input.enabled,
            priceOverrideMinor: input.priceOverrideMinor?.toString() ?? null,
            durationOverrideMinutes: input.durationOverrideMinutes,
          },
        },
      });
    });
    return this.services();
  }

  /** Мастера сети: их филиалы и умения */
  async employees() {
    this.may('desk');
    const scope = await this.scope();
    const rows = await this.prisma.db.employee.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        locations: { select: { locationId: true } },
        services: { select: { serviceId: true } },
      },
    });
    return { locationId: scope.locationId, items: rows.map(employeeView) };
  }

  async createEmployee(raw: unknown) {
    this.may('property');
    const parsed = parseEmployeeInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value as Required<NonNullable<typeof parsed.value>>;
    const scope = await this.scope();
    const created = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.employee.create({
        data: {
          id: randomUUID(),
          businessId: scope.businessId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          status: input.active ? 'ACTIVE' : 'ARCHIVED',
        },
      });
      // новый мастер сразу работает в выбранном филиале: иначе он нигде не работает и не виден в расписании
      if (scope.locationId)
        await tx.employeeLocation.create({
          data: { employeeId: row.id, locationId: scope.locationId },
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: row.id,
          action: 'beauty.employee.created',
          after: { name: row.name, locationId: scope.locationId },
        },
      });
      return row;
    });
    return employeeView({
      ...created,
      locations: scope.locationId ? [{ locationId: scope.locationId }] : [],
      services: [],
    });
  }

  async updateEmployee(id: string, raw: unknown) {
    this.may('property');
    if (!UUID.test(id)) throw new NotFoundException('Мастер не найден');
    const parsed = parseEmployeeInput(raw, { partial: true });
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await this.scope();
    const current = await this.prisma.db.employee.findFirst({
      where: { id, businessId: scope.businessId },
    });
    if (!current) throw new NotFoundException('Мастер не найден');
    const p = parsed.value;
    const data: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      status?: 'ACTIVE' | 'ARCHIVED';
    } = {};
    if (p.name !== undefined && p.name !== current.name) data.name = p.name;
    if (p.phone !== undefined && p.phone !== current.phone) data.phone = p.phone;
    if (p.email !== undefined && p.email !== current.email) data.email = p.email;
    if (p.active !== undefined) {
      const status = p.active ? 'ACTIVE' : 'ARCHIVED';
      if (status !== current.status) data.status = status;
    }
    if (Object.keys(data).length === 0) return this.employee(current.id, scope.businessId);
    await this.prisma.db.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: current.id }, data });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: current.id,
          action: 'beauty.employee.updated',
          before: pick(plain(current), Object.keys(data)),
          after: pick(plain({ ...current, ...data }), Object.keys(data)),
        },
      });
    });
    return this.employee(current.id, scope.businessId);
  }

  /** Что мастер умеет: список услуг каталога целиком, не добавлением по одной */
  async setEmployeeServices(id: string, raw: unknown) {
    this.may('property');
    if (!UUID.test(id)) throw new NotFoundException('Мастер не найден');
    const body = (raw ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(body['serviceIds']) ? body['serviceIds'] : null;
    if (!ids || ids.some((value) => typeof value !== 'string' || !UUID.test(value)))
      throw new BadRequestException('Выберите услуги мастера');
    const wanted = [...new Set(ids as string[])];
    const scope = await this.scope();
    const employee = await this.prisma.db.employee.findFirst({
      where: { id, businessId: scope.businessId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Мастер не найден');
    const own = await this.prisma.db.beautyService.findMany({
      where: { id: { in: wanted }, businessId: scope.businessId },
      select: { id: true },
    });
    if (own.length !== wanted.length)
      throw new BadRequestException('Среди выбранных услуг есть чужая');
    await this.prisma.db.$transaction(async (tx) => {
      await tx.employeeService.deleteMany({ where: { employeeId: employee.id } });
      if (wanted.length)
        await tx.employeeService.createMany({
          data: wanted.map((serviceId) => ({ employeeId: employee.id, serviceId })),
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: employee.id,
          action: 'beauty.employee.services.set',
          after: { serviceIds: wanted },
        },
      });
    });
    return this.employee(employee.id, scope.businessId);
  }

  private async employee(id: string, businessId: string) {
    const row = await this.prisma.db.employee.findFirstOrThrow({
      where: { id, businessId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        locations: { select: { locationId: true } },
        services: { select: { serviceId: true } },
      },
    });
    return employeeView(row);
  }
}

/** Услуга наружу: цена строкой тиынов (деньги не float, ADR-008) и действующая цена филиала словами домена */
function serviceView(
  row: {
    id: string;
    name: string;
    category: string | null;
    durationMinutes: number;
    price: bigint;
    currency: string;
    active: boolean;
    locations?:
      | Array<{ enabled: boolean; priceOverride: bigint | null; durationOverride: number | null }>
      | false;
  },
  locationCurrency: string | null,
) {
  const locationRow = Array.isArray(row.locations) ? (row.locations[0] ?? null) : null;
  const effective = locationCurrency
    ? effectiveService({
        service: {
          active: row.active,
          priceMinor: row.price,
          currency: row.currency,
          durationMinutes: row.durationMinutes,
        },
        locationCurrency,
        locationService: locationRow
          ? {
              enabled: locationRow.enabled,
              priceOverrideMinor: locationRow.priceOverride,
              durationOverrideMinutes: locationRow.durationOverride,
            }
          : null,
      })
    : null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    durationMinutes: row.durationMinutes,
    priceMinor: row.price.toString(),
    currency: row.currency,
    active: row.active,
    location: locationRow
      ? {
          enabled: locationRow.enabled,
          priceOverrideMinor: locationRow.priceOverride?.toString() ?? null,
          durationOverrideMinutes: locationRow.durationOverride,
        }
      : null,
    effective:
      effective === null
        ? null
        : effective.sellable
          ? {
              sellable: true as const,
              priceMinor: effective.priceMinor.toString(),
              currency: effective.currency,
              durationMinutes: effective.durationMinutes,
              overridden: effective.overridden,
            }
          : { sellable: false as const, reason: effective.reason },
  };
}

function employeeView(row: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  locations: Array<{ locationId: string }>;
  services: Array<{ serviceId: string }>;
}) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    active: row.status === 'ACTIVE',
    locationIds: row.locations.map((l) => l.locationId),
    serviceIds: row.services.map((s) => s.serviceId),
  };
}

/** Строка в журнал: деньги строкой, даты и прочее без объектов Prisma (поле Json принимает только простое) */
type LogRow = Record<string, string | number | boolean | null>;

function plain(row: Record<string, unknown>): LogRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, v]) => typeof v !== 'object' || v === null)
      .map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : (v as string | number | boolean | null)]),
  );
}

function pick(row: LogRow, keys: string[]): LogRow {
  const map: Record<string, string> = { priceMinor: 'price', durationMinutes: 'durationMinutes' };
  return Object.fromEntries(keys.map((k) => [k, row[map[k] ?? k] ?? null]));
}

@Access('desk')
@Controller('beauty')
export class BeautyCatalogController {
  constructor(@Inject(BeautyCatalogService) private readonly service: BeautyCatalogService) {}

  @Get('services') services() {
    return this.service.services();
  }
  // Каталог услуг это прайс салона: цены по решению Q-253 меняет право `rates`
  @Access('rates') @Post('services') createService(@Body() body: unknown) {
    return this.service.createService(body);
  }
  @Access('rates') @Patch('services/:id') updateService(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateService(id, body);
  }
  @Access('rates') @Put('services/:id/location') setLocationService(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.setLocationService(id, body);
  }

  @Get('employees') employees() {
    return this.service.employees();
  }
  // Мастера это то, чем салон работает: право `property`, как номерной фонд в гостинице (Q-253)
  @Access('property') @Post('employees') createEmployee(@Body() body: unknown) {
    return this.service.createEmployee(body);
  }
  @Access('property') @Patch('employees/:id') updateEmployee(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateEmployee(id, body);
  }
  @Access('property') @Put('employees/:id/services') setEmployeeServices(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.setEmployeeServices(id, body);
  }
}

@Module({
  controllers: [BeautyCatalogController, BeautyScheduleController],
  providers: [BeautyCatalogService, BeautyScheduleService, PrismaService],
})
export class BeautyModule {}
