import 'reflect-metadata';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DbTx } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import { INVENTORY_REPOSITORY, type InventoryRepository } from './inventory.repository';
import {
  categoryInput,
  inventoryText,
  ratePlanChoice,
  roomInput,
  type RatePlanChoice,
} from './inventory-input';
import { Access } from '../auth/access.decorator';

@Injectable()
export class InventoryEditor {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INVENTORY_REPOSITORY) private readonly reader: InventoryRepository,
  ) {}
  private property() {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }
  /** Список для стойки: действующие тарифы категории — числом и по именам (ТЗ «Категории v2», ADR-109). */
  async categories() {
    const propertyId = await this.property();
    const rows = await this.prisma.db.accommodationType.findMany({
      where: { propertyId },
      select: {
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
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ ratePlanLinks, ...row }) => ({
      ...row,
      ratePlans: ratePlanLinks.length,
      ratePlanNames: ratePlanLinks.map((link) => link.ratePlan.name),
    }));
  }
  /** Существующий тариф объекта или новый с названием человека; «позже» — без тарифа (ADR-118) */
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
  async createCategory(body: Record<string, unknown>) {
    const data = categoryInput(body),
      choice = ratePlanChoice(body, true),
      propertyId = await this.property();
    const result = await this.prisma.db.$transaction(async (tx) => {
      const rate = await this.resolvePlan(tx, propertyId, choice);
      const category = await tx.accommodationType.create({
        data: { ...data, propertyId, code: `category-${randomUUID()}` },
      });
      if (rate)
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
            createdRate: choice.kind === 'new',
          },
        },
      });
      return { code: category.code };
    });
    this.reader.invalidate?.(propertyId);
    return result;
  }
  /** «Настроить тариф» (ADR-118): привязать тариф к категории; повтор той же пары — без дубля и без записи */
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
  async renameCategory(code: string, body: Record<string, unknown>) {
    const name = inventoryText(body.name, 'Название'),
      propertyId = await this.property();
    const result = await this.prisma.db.$transaction(async (tx) => {
      const found = await tx.accommodationType.findFirst({ where: { propertyId, code } });
      if (!found) throw new NotFoundException('Категория не найдена');
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
      return { code };
    });
    this.reader.invalidate?.(propertyId);
    return result;
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
