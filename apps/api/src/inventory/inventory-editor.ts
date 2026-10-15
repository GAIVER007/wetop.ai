import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type DbTx } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import { INVENTORY_REPOSITORY, type InventoryRepository } from './inventory.repository';
import {
  categoryInput,
  categoryPrice,
  categoryRemoval,
  inventoryText,
  ratePlanChoice,
  roomInput,
  type RatePlanChoice,
} from './inventory-input';
import { Access } from '../auth/access.decorator';
import { ARI_PUBLISHER, publishAfterCommit, type AriPublisher } from '../channels/ari-publisher';
import { RatesService } from '../rates/rates.service';

/** Глубина остатков, которую держит канал: как у полной выгрузки (сертификация Channex) */
const ARI_HORIZON_DAYS = 500;
/** Цена категории ставится на год вперёд: предел одной строки массовой правки цен (rates.service.ts) */
const PRICE_HORIZON_DAYS = 366;
const BASE_PLAN_NAME = 'Базовый тариф';

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class InventoryEditor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INVENTORY_REPOSITORY) private readonly reader: InventoryRepository,
    @Inject(ARI_PUBLISHER) private readonly ari: AriPublisher,
    @Inject(RatesService) private readonly rates: RatesService,
  ) {}
  private property() {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }
  /**
   * Список для стойки: действующие тарифы категории — числом и по именам (ТЗ «Категории v2», ADR-109) и что её
   * использует (C4, ТЗ §17): брони в истории — разные брони, а не проживания; брони впереди — не отменённые
   * и не закрытые, с выездом сегодня или позже по часам объекта; сопоставление с Channex.
   */
  async categories() {
    const propertyId = await this.property();
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const [rows, bookings, prices] = await Promise.all([
      this.prisma.db.accommodationType.findMany({
        where: { propertyId },
        select: {
          id: true,
          code: true,
          name: true,
          kind: true,
          capacityAdults: true,
          active: true,
          ratePlanLinks: {
            where: { ratePlan: { active: true } },
            select: { ratePlan: { select: { name: true } } },
            orderBy: { ratePlan: { name: 'asc' } },
          },
          _count: { select: { channelMappings: { where: { providerRoomTypeId: { not: null } } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.$queryRaw<Array<{ id: string; total: number; upcoming: number }>>(Prisma.sql`
        SELECT i."accommodation_type_id"::text AS "id",
          COUNT(DISTINCT i."reservation_id")::int AS "total",
          (COUNT(DISTINCT i."reservation_id") FILTER (
            WHERE i."status" IN ('TENTATIVE', 'CONFIRMED', 'CHECKED_IN')
              AND i."departure_date" >= ${today}::date
          ))::int AS "upcoming"
        FROM "reservation_items" i
        JOIN "reservations" r ON r."id" = i."reservation_id"
        WHERE r."property_id" = ${propertyId}::uuid
        GROUP BY i."accommodation_type_id"`),
      // Цена категории — цена сегодняшней ночи основного тарифа (без родителя), на самую большую вместимость
      this.prisma.db.dailyRate.findMany({
        where: {
          date: new Date(`${today}T00:00:00Z`),
          ratePlan: { propertyId, active: true, parentRatePlanId: null },
        },
        select: {
          accommodationTypeId: true,
          price: true,
          ratePlan: { select: { currency: true } },
        },
        orderBy: [{ ratePlan: { createdAt: 'asc' } }, { occupancy: 'desc' }],
      }),
    ]);
    const byType = new Map(bookings.map((b) => [b.id, b]));
    const priceByType = new Map<string, { priceMinor: string; currency: string }>();
    for (const p of prices)
      if (!priceByType.has(p.accommodationTypeId))
        priceByType.set(p.accommodationTypeId, {
          priceMinor: p.price.toString(),
          currency: p.ratePlan.currency,
        });
    return rows.map(({ id, ratePlanLinks, _count, ...row }) => ({
      ...row,
      priceMinor: priceByType.get(id)?.priceMinor ?? null,
      currency: priceByType.get(id)?.currency ?? null,
      ratePlans: ratePlanLinks.length,
      ratePlanNames: ratePlanLinks.map((link) => link.ratePlan.name),
      reservations: byType.get(id)?.total ?? 0,
      upcomingReservations: byType.get(id)?.upcoming ?? 0,
      channexMapped: _count.channelMappings > 0,
    }));
  }
  /** Существующий тариф объекта или новый с названием человека; «позже» — без тарифа (ADR-119) */
  private async resolvePlan(tx: DbTx, propertyId: string, choice: RatePlanChoice) {
    if (choice.kind === 'later') return null;
    if (choice.kind === 'existing') {
      const found = await tx.ratePlan.findFirst({
        where: { propertyId, code: choice.code, active: true },
      });
      if (!found) throw new NotFoundException('Тариф не найден');
      return found;
    }
    const property = await tx.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { currency: true },
    });
    return tx.ratePlan.create({
      data: {
        propertyId,
        code: `rate-${randomUUID()}`,
        name: choice.name,
        currency: property.currency,
      },
    });
  }
  /**
   * Основные тарифы категории (без родителя, действующие). Нет ни одного — привязывается основной тариф объекта,
   * а если и его нет — создаётся «Базовый тариф» (план categories-price-2026-10-06: тарифы стойка больше не показывает)
   */
  private async ensureBasePlans(tx: DbTx, propertyId: string, categoryId: string) {
    const linked = await tx.ratePlan.findMany({
      where: {
        propertyId,
        active: true,
        parentRatePlanId: null,
        types: { some: { accommodationTypeId: categoryId } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (linked.length) return linked;
    const base =
      (await tx.ratePlan.findFirst({
        where: { propertyId, active: true, parentRatePlanId: null },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await this.resolvePlan(tx, propertyId, { kind: 'new', name: BASE_PLAN_NAME }))!;
    await tx.ratePlanAccommodationType.create({
      data: { ratePlanId: base.id, accommodationTypeId: categoryId },
    });
    return [base];
  }
  /** Одна цена на все дни года вперёд и на все вместимости — через массовую правку цен (журнал и каналы там же) */
  private async setPrice(categoryCode: string, planCodes: string[], price: string) {
    const from = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    return this.rates.bulk({
      changes: planCodes.map((ratePlanCode) => ({
        accommodationTypeCode: categoryCode,
        ratePlanCode,
        dateFrom: from,
        dateTo: addDays(from, PRICE_HORIZON_DAYS - 1),
        price,
      })),
    });
  }
  async createCategory(body: Record<string, unknown>) {
    const data = categoryInput(body),
      price = categoryPrice(body),
      // с ценой выбор тарифа не нужен: цена ложится на основной тариф объекта
      choice = price ? null : ratePlanChoice(body, true),
      propertyId = await this.property();
    const result = await this.prisma.db.$transaction(async (tx) => {
      const category = await tx.accommodationType.create({
        data: { ...data, propertyId, code: `category-${randomUUID()}` },
      });
      const plans = choice ? null : await this.ensureBasePlans(tx, propertyId, category.id);
      const rate = choice ? await this.resolvePlan(tx, propertyId, choice) : plans![0]!;
      if (rate && choice)
        await tx.ratePlanAccommodationType.create({
          data: { ratePlanId: rate.id, accommodationTypeId: category.id },
        });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          action: 'inventory.category.created',
          entityType: 'accommodation_type',
          entityId: category.id,
          after: {
            ...data,
            propertyId,
            ratePlanCode: rate?.code ?? null,
            createdRate: choice?.kind === 'new',
          },
        },
      });
      return { code: category.code, planCodes: plans?.map((p) => p.code) ?? [] };
    });
    this.reader.invalidate?.(propertyId);
    if (price) await this.setPrice(result.code, result.planCodes, price);
    return { code: result.code };
  }
  /** «Настроить тариф» (ADR-119): привязать тариф к категории; повтор той же пары — без дубля и без записи */
  async linkRatePlan(code: string, body: Record<string, unknown>) {
    const choice = ratePlanChoice(body, false),
      propertyId = await this.property();
    const result = await this.prisma.db.$transaction(async (tx) => {
      const category = await tx.accommodationType.findFirst({ where: { propertyId, code } });
      if (!category) throw new NotFoundException('Категория не найдена');
      const rate = (await this.resolvePlan(tx, propertyId, choice))!;
      const exists = await tx.ratePlanAccommodationType.findUnique({
        where: {
          ratePlanId_accommodationTypeId: { ratePlanId: rate.id, accommodationTypeId: category.id },
        },
      });
      if (exists) return { code, ratePlanCode: rate.code, linked: false };
      await tx.ratePlanAccommodationType.create({
        data: { ratePlanId: rate.id, accommodationTypeId: category.id },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          action: 'inventory.category.rate_plan_linked',
          entityType: 'accommodation_type',
          entityId: category.id,
          after: { propertyId, ratePlanCode: rate.code, createdRate: choice.kind === 'new' },
        },
      });
      return { code, ratePlanCode: rate.code, linked: true };
    });
    this.reader.invalidate?.(propertyId);
    return result;
  }
  /** Правка категории: название и/или цена (одна на все дни и вместимости; журнал цен пишет массовая правка) */
  async renameCategory(code: string, body: Record<string, unknown>) {
    const name = body.name === undefined ? undefined : inventoryText(body.name, 'Название'),
      price = categoryPrice(body),
      propertyId = await this.property();
    if (name === undefined && price === undefined)
      throw new BadRequestException('Укажите название или цену');
    const planCodes = await this.prisma.db.$transaction(async (tx) => {
      const found = await tx.accommodationType.findFirst({ where: { propertyId, code } });
      if (!found) throw new NotFoundException('Категория не найдена');
      if (price !== undefined && !found.active)
        throw new ConflictException('Категория в архиве: цену у неё не меняют');
      if (name !== undefined && name !== found.name) {
        await tx.accommodationType.update({ where: { id: found.id }, data: { name } });
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            action: 'inventory.category.updated',
            entityType: 'accommodation_type',
            entityId: found.id,
            before: { name: found.name },
            after: { name, propertyId },
          },
        });
      }
      return price === undefined
        ? []
        : (await this.ensureBasePlans(tx, propertyId, found.id)).map((p) => p.code);
    });
    this.reader.invalidate?.(propertyId);
    if (price !== undefined) await this.setPrice(code, planCodes, price);
    return { code };
  }
  /**
   * «Удалить» (решение владельца 06.10.2026): категория без мест, броней и сопоставления с каналом удаляется
   * насовсем вместе со своими ценами и ограничениями; с историей — в архив вместе с местами (не продаётся,
   * брони и отчёты целы); с бронями впереди — отказ словами.
   */
  async removeCategory(code: string) {
    const propertyId = await this.property();
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const outcome = await this.prisma.db.$transaction(async (tx) => {
      const found = await tx.accommodationType.findFirst({ where: { propertyId, code } });
      if (!found) throw new NotFoundException('Категория не найдена');
      const [units, reservations, upcomingReservations, mapped, intents] = await Promise.all([
        tx.inventoryUnit.count({ where: { accommodationTypeId: found.id } }),
        tx.reservationItem.count({ where: { accommodationTypeId: found.id } }),
        tx.reservationItem.count({
          where: {
            accommodationTypeId: found.id,
            status: { in: ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'] },
            departureDate: { gte: new Date(`${today}T00:00:00Z`) },
          },
        }),
        tx.channelMapping.count({
          where: { localAccommodationTypeId: found.id, providerRoomTypeId: { not: null } },
        }),
        tx.sellerBookingIntent.count({ where: { accommodationTypeId: found.id } }),
      ]);
      const decision = categoryRemoval({
        units,
        // заявки ИИ-продавца держат ссылку на категорию так же, как брони
        reservations: reservations + intents,
        upcomingReservations,
        channexMapped: mapped > 0,
      });
      if (decision === 'blocked')
        throw new ConflictException(
          `У категории ${upcomingReservations} ${upcomingReservations === 1 ? 'бронь' : 'броней'} впереди. ` +
            'Дождитесь выезда или переселите гостей, затем удалите категорию.',
        );
      if (decision === 'delete') {
        await tx.dailyRate.deleteMany({ where: { accommodationTypeId: found.id } });
        await tx.restriction.deleteMany({ where: { accommodationTypeId: found.id } });
        await tx.ratePlanAccommodationType.deleteMany({ where: { accommodationTypeId: found.id } });
        await tx.channelMapping.deleteMany({ where: { localAccommodationTypeId: found.id } });
        await tx.accommodationType.delete({ where: { id: found.id } });
      } else {
        await tx.accommodationType.update({ where: { id: found.id }, data: { active: false } });
        await tx.inventoryUnit.updateMany({
          where: { accommodationTypeId: found.id },
          data: { active: false },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          action: decision === 'delete' ? 'inventory.category.deleted' : 'inventory.category.archived',
          entityType: 'accommodation_type',
          entityId: found.id,
          before: { name: found.name, kind: found.kind, capacityAdults: found.capacityAdults, units },
          after: { propertyId, active: false },
        },
      });
      return { decision, units };
    });
    this.reader.invalidate?.(propertyId);
    // Места архива ушли из продажи: каналы узнают об этом дельтой остатка, а не ночной выгрузкой
    if (outcome.decision === 'archive' && outcome.units)
      await publishAfterCommit(this.ari, {
        categoryCodes: [code],
        from: today,
        toExclusive: addDays(today, ARI_HORIZON_DAYS),
      });
    return { code, result: outcome.decision === 'delete' ? 'deleted' : 'archived' };
  }
  async createRoom(body: Record<string, unknown>) {
    const input = roomInput(body),
      propertyId = await this.property();
    try {
      const result = await this.prisma.db.$transaction(async (tx) => {
        const category = await tx.accommodationType.findFirst({
          where: { propertyId, code: input.categoryCode, active: true },
        });
        if (!category) throw new NotFoundException('Категория не найдена');
        const dorm = category.kind === 'DORM_BED';
        if (!dorm && input.codes.length !== 1)
          throw new ConflictException('Для отдельного номера укажите одно обозначение');
        const building = await tx.building.upsert({
          where: { propertyId_name: { propertyId, name: input.building } },
          create: { propertyId, name: input.building },
          update: {},
        });
        const floor = await tx.floor.upsert({
          where: { buildingId_name: { buildingId: building.id, name: input.floor } },
          create: { buildingId: building.id, name: input.floor },
          update: {},
        });
        const room = await tx.physicalRoom.create({
          data: {
            floorId: floor.id,
            roomNumber: input.roomNumber,
            capacity: dorm ? input.codes.length : category.capacityAdults,
            isDorm: dorm,
          },
        });
        await tx.inventoryUnit.createMany({
          data: input.codes.map((code) => ({
            propertyId,
            code,
            physicalRoomId: room.id,
            accommodationTypeId: category.id,
            kind: dorm ? ('BED' as const) : ('ROOM' as const),
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            action: 'inventory.room.created',
            entityType: 'physical_room',
            entityId: room.id,
            after: { ...input, propertyId },
          },
        });
        return { codes: input.codes };
      });
      this.reader.invalidate?.(propertyId);
      // Новые места меняют остаток категории: без дельты канал узнал бы о них только ночной выгрузкой
      const from = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name),
        end = new Date(`${from}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + ARI_HORIZON_DAYS);
      await publishAfterCommit(this.ari, {
        categoryCodes: [input.categoryCode],
        from,
        toExclusive: end.toISOString().slice(0, 10),
      });
      return result;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002')
        throw new ConflictException(
          'Комната или обозначение места уже существует. Выберите другое обозначение.',
        );
      throw e;
    }
  }
  async renameRoom(code: string, body: Record<string, unknown>) {
    const roomNumber = inventoryText(body.roomNumber, 'Комната'),
      propertyId = await this.property();
    try {
      const result = await this.prisma.db.$transaction(async (tx) => {
        const unit = await tx.inventoryUnit.findFirst({
          where: { code, accommodationType: { propertyId } },
          include: { physicalRoom: true },
        });
        if (!unit) throw new NotFoundException('Место не найдено');
        await tx.physicalRoom.update({ where: { id: unit.physicalRoomId }, data: { roomNumber } });
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            action: 'inventory.room.updated',
            entityType: 'physical_room',
            entityId: unit.physicalRoomId,
            before: { roomNumber: unit.physicalRoom.roomNumber },
            after: { roomNumber, propertyId },
          },
        });
        return { code };
      });
      this.reader.invalidate?.(propertyId);
      return result;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2002')
        throw new ConflictException('На этом этаже уже есть комната с таким обозначением');
      throw e;
    }
  }
}
@Access('property')
@Controller('inventory')
export class InventoryEditorController {
  constructor(@Inject(InventoryEditor) private readonly editor: InventoryEditor) {}
  @Get('categories') categories() {
    return this.editor.categories();
  }
  @Post('categories') createCategory(@Body() body: Record<string, unknown>) {
    return this.editor.createCategory(body ?? {});
  }
  @Patch('categories/:code') renameCategory(
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.editor.renameCategory(code, body ?? {});
  }
  @Delete('categories/:code') removeCategory(@Param('code') code: string) {
    return this.editor.removeCategory(code);
  }
  @Post('categories/:code/rate-plan') linkRatePlan(
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.editor.linkRatePlan(code, body ?? {});
  }
  @Post('rooms') createRoom(@Body() body: Record<string, unknown>) {
    return this.editor.createRoom(body ?? {});
  }
  @Patch('rooms/:code') renameRoom(
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.editor.renameRoom(code, body ?? {});
  }
}
