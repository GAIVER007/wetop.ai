import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { foodId, parseItemModifierGroups, parseModifierGroupInput, type Permission } from '@pms/domain';
import type { DbTx, Prisma } from '@pms/database';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope } from './scope';

/**
 * Модификаторы блюд (DATA_MODEL §33.7, миграция 144): группы бизнеса («Размер», «Добавки») с модификаторами и привязка
 * групп к блюду. Читает всё, у кого есть меню (`orders`), меняет право меню (`property`). Модификаторы не удаляются:
 * пропавший из списка выключается (строки заказов держат на него ссылку).
 */
const groupInclude = { modifiers: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] as Prisma.MenuModifierOrderByWithRelationInput[] } } as const;
type GroupRow = Prisma.MenuModifierGroupGetPayload<{ include: typeof groupInclude }>;

export function modifierGroupView(g: GroupRow) {
  return {
    id: g.id,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    required: g.minSelect >= 1,
    sortOrder: g.sortOrder,
    active: g.active,
    updatedAt: g.updatedAt,
    modifiers: g.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      priceDeltaMinor: m.priceDelta.toString(),
      sortOrder: m.sortOrder,
      active: m.active,
    })),
  };
}

function parsed<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw new BadRequestException(e instanceof Error ? e.message : 'Некорректный запрос');
  }
}

@Injectable()
export class MenuModifiersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async write<T>(permission: Permission, fn: (tx: DbTx, s: FoodScope) => Promise<T>): Promise<T> {
    foodMay(permission);
    await foodWritable(this.prisma.db);
    const s = await foodScope(this.prisma.db);
    return foodTransaction(this.prisma, s, fn);
  }

  private async audit(tx: DbTx, s: FoodScope, id: string, action: string, after: Prisma.InputJsonObject) {
    await tx.auditLog.create({
      data: { organizationId: s.organizationId, userId: currentUserId(), entityType: 'menu_modifier_group', entityId: id, action, after },
    });
  }

  async groups() {
    foodMay('orders');
    const s = await foodScope(this.prisma.db);
    const rows = await this.prisma.db.menuModifierGroup.findMany({
      where: { businessId: s.businessId },
      include: groupInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { items: rows.map(modifierGroupView) };
  }

  private async nameFree(tx: DbTx, s: FoodScope, name: string, except?: string) {
    const same = await tx.menuModifierGroup.findFirst({
      where: { businessId: s.businessId, name: { equals: name, mode: 'insensitive' }, ...(except ? { id: { not: except } } : {}) },
      select: { id: true },
    });
    if (same) throw new ConflictException('Группа с таким названием уже есть');
  }

  async createGroup(raw: unknown) {
    return this.write('property', async (tx, s) => {
      const b = parsed(() => parseModifierGroupInput(raw));
      await this.nameFree(tx, s, b.name!);
      const row = await tx.menuModifierGroup.create({
        data: {
          businessId: s.businessId,
          name: b.name!,
          minSelect: b.minSelect!,
          maxSelect: b.maxSelect!,
          sortOrder: b.sortOrder ?? 0,
          active: b.active ?? true,
          modifiers: {
            create: b.modifiers!.map((m) => ({ name: m.name, priceDelta: m.priceDelta, sortOrder: m.sortOrder, active: m.active })),
          },
        },
        include: groupInclude,
      });
      await this.audit(tx, s, row.id, 'food.modifier_group.created', {
        name: row.name,
        minSelect: row.minSelect,
        maxSelect: row.maxSelect,
        modifiers: row.modifiers.map((m) => `${m.name} ${m.priceDelta}`),
      });
      return modifierGroupView(row);
    });
  }

  async updateGroup(idRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const id = parsed(() => foodId(idRaw));
      const b = parsed(() => parseModifierGroupInput(raw, true));
      const old = await tx.menuModifierGroup.findFirst({ where: { id, businessId: s.businessId }, include: groupInclude });
      if (!old) throw new NotFoundException('Группа добавок не найдена');
      if (b.name !== undefined) await this.nameFree(tx, s, b.name, id);
      const minSelect = b.minSelect ?? old.minSelect,
        maxSelect = b.maxSelect ?? old.maxSelect;
      if (minSelect > maxSelect) throw new BadRequestException('Минимум выбора больше максимума');
      if (b.modifiers) {
        const own = new Map(old.modifiers.map((m) => [m.id, m]));
        for (const m of b.modifiers) if (m.id && !own.has(m.id)) throw new BadRequestException('Добавка не из этой группы');
        const listed = new Set(b.modifiers.map((m) => m.id).filter(Boolean));
        // пропавшие из списка не удаляются, а выключаются (снимки строк заказов ссылаются на них)
        await tx.menuModifier.updateMany({ where: { groupId: id, id: { notIn: [...listed] as string[] } }, data: { active: false } });
        for (const m of b.modifiers) {
          const data = { name: m.name, priceDelta: m.priceDelta, sortOrder: m.sortOrder, active: m.active };
          if (m.id) await tx.menuModifier.update({ where: { id: m.id }, data });
          else await tx.menuModifier.create({ data: { ...data, groupId: id } });
        }
      }
      const activeCount = await tx.menuModifier.count({ where: { groupId: id, active: true } });
      if (activeCount < minSelect) throw new BadRequestException('В группе меньше добавок, чем минимум выбора');
      const row = await tx.menuModifierGroup.update({
        where: { id },
        data: {
          ...(b.name !== undefined ? { name: b.name } : {}),
          minSelect,
          maxSelect,
          ...(b.sortOrder !== undefined ? { sortOrder: b.sortOrder } : {}),
          ...(b.active !== undefined ? { active: b.active } : {}),
        },
        include: groupInclude,
      });
      await this.audit(tx, s, id, 'food.modifier_group.updated', {
        name: row.name,
        minSelect: row.minSelect,
        maxSelect: row.maxSelect,
        active: row.active,
        modifiers: row.modifiers.map((m) => `${m.name} ${m.priceDelta}${m.active ? '' : ' (выкл.)'}`),
      });
      return modifierGroupView(row);
    });
  }

  /** Группы блюда целиком в нужном порядке */
  async setItemGroups(itemIdRaw: string, raw: unknown) {
    return this.write('property', async (tx, s) => {
      const menuItemId = parsed(() => foodId(itemIdRaw));
      const groupIds = parsed(() => parseItemModifierGroups(raw));
      const item = await tx.menuItem.findFirst({ where: { id: menuItemId, businessId: s.businessId }, select: { id: true, name: true } });
      if (!item) throw new NotFoundException('Блюдо не найдено');
      const found = await tx.menuModifierGroup.count({ where: { id: { in: groupIds }, businessId: s.businessId } });
      if (found !== groupIds.length) throw new NotFoundException('Группа добавок не найдена');
      await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId } });
      if (groupIds.length)
        await tx.menuItemModifierGroup.createMany({ data: groupIds.map((groupId, sortOrder) => ({ menuItemId, groupId, sortOrder })) });
      await tx.auditLog.create({
        data: {
          organizationId: s.organizationId,
          userId: currentUserId(),
          entityType: 'menu_item',
          entityId: menuItemId,
          action: 'food.menu_item.modifier_groups',
          after: { groupIds },
        },
      });
      return { menuItemId, modifierGroupIds: groupIds };
    });
  }
}
