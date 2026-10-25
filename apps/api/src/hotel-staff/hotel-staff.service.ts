import 'reflect-metadata';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Db, DbTx } from '@pms/database';
import {
  hotelTaskOrder,
  hotelUnitOrder,
  localDate,
  monthBounds,
  monthShiftDays,
  timeOffWindow,
  weekTemplate,
  type HotelStaffCabinetDto,
  type HotelStaffTask,
  type HotelStaffUnit,
} from '@pms/domain';
import { actorMay, currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { monthPayrollRows } from '../food-service/month-payroll';
import { foodMay, foodScope, foodTransaction, foodWritable, type FoodScope } from '../food-service/scope';

const HOTEL = ['HOSPITALITY'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clock = (d: Date) => d.toISOString().slice(11, 16);
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Кабинет горничной и ресепшена гостиницы (решение владельца 22.10.2026, docs/decisions/2026-10-22-hotel-staff-cabinet.md,
 * DATA_MODEL §4.1). «Личный кабинет» (EMPLOYEE, право `self`) работает только от своего сотрудника бизнеса
 * (`employees.user_id`), как официант через `waiterSelf()`: свои номера («Кто убирает» = я), свои задачи
 * (`assignee_user_id` = я). Шахматка, брони, гости и финансы ему закрыты правом `desk`.
 */
@Injectable()
export class HotelStaffService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async scope(db: Db | DbTx) {
    const s = await foodScope(db, HOTEL);
    const property = await db.property.findFirst({ where: { locationId: s.locationId }, select: { id: true, name: true, timezone: true } });
    if (!property) throw new ForbiddenException('У филиала нет объекта гостиницы');
    return { s, property };
  }

  /** Свой сотрудник гостиницы: без привязки входа к сотруднику кабинета нет */
  private async me(db: Db | DbTx, s: Pick<FoodScope, 'businessId'>) {
    foodMay('self');
    const userId = currentUserId();
    const me = userId
      ? await db.employee.findFirst({ where: { userId, businessId: s.businessId, status: 'ACTIVE' }, select: { id: true, name: true } })
      : null;
    if (!me || !userId) throw new ForbiddenException('Ваш вход не привязан к сотруднику этой гостиницы: обратитесь к руководителю');
    return { ...me, userId };
  }

  async cabinet(query: Record<string, unknown> = {}): Promise<HotelStaffCabinetDto> {
    const db = this.prisma.db;
    const { s, property } = await this.scope(db);
    const me = await this.me(db, s);
    const today = localDate(new Date(), property.timezone);
    const month = query.month === undefined ? today.slice(0, 7) : query.month;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Месяц в формате ГГГГ-ММ');
    const todayWindow = timeOffWindow({ dateFrom: today, dateTo: today, timezone: property.timezone });
    const mb = monthBounds(month);
    const monthWindow = timeOffWindow({ dateFrom: mb.from, dateTo: mb.to, timezone: property.timezone });
    const cleaned = { employeeId: me.id, fromStatus: 'DIRTY' as const, toStatus: 'CLEAN' as const };
    const [units, cleanedToday, tasks, hours, timeOffs, cleanings, tasksDone, payroll] = await Promise.all([
      db.inventoryUnit.findMany({
        where: { propertyId: property.id, housekeepingAssigneeId: me.id, active: true },
        include: { accommodationType: { select: { name: true } }, physicalRoom: { select: { roomNumber: true, floor: { select: { name: true, building: { select: { name: true } } } } } } },
      }),
      db.housekeepingEvent.findMany({
        where: { ...cleaned, inventoryUnit: { propertyId: property.id }, createdAt: { gte: todayWindow.fromUtc, lt: todayWindow.toUtcExclusive } },
        select: { inventoryUnitId: true },
      }),
      db.deskTask.findMany({
        where: {
          propertyId: property.id,
          assigneeUserId: me.userId,
          OR: [
            { doneAt: null, dueDate: { lte: new Date(`${today}T00:00:00Z`) } },
            { doneAt: { gte: todayWindow.fromUtc, lt: todayWindow.toUtcExclusive } },
          ],
        },
        take: 200,
      }),
      db.workingHours.findMany({ where: { employeeId: me.id, locationId: s.locationId }, orderBy: [{ weekday: 'asc' }, { timeFrom: 'asc' }] }),
      db.timeOff.findMany({ where: { employeeId: me.id } }),
      db.housekeepingEvent.count({ where: { ...cleaned, createdAt: { gte: monthWindow.fromUtc, lt: monthWindow.toUtcExclusive } } }),
      db.deskTask.count({ where: { propertyId: property.id, assigneeUserId: me.userId, doneAt: { gte: monthWindow.fromUtc, lt: monthWindow.toUtcExclusive } } }),
      monthPayrollRows(db, { businessId: s.businessId, timezone: s.timezone, vertical: 'HOSPITALITY' }, mb, me.id),
    ]);
    const doneToday = new Set(cleanedToday.map((e) => e.inventoryUnitId));
    const row = payroll.rows[0];
    if (!row) throw new NotFoundException('Сотрудник не найден');
    const shifts = monthShiftDays({
      month,
      workingWeekdays: [...new Set(hours.map((h) => h.weekday))],
      timeOffs: timeOffs.map((t) => ({ dateFrom: day(t.dateFrom), dateTo: day(t.dateTo) })),
    });
    return {
      me: { id: me.id, name: me.name },
      property: { name: property.name, timezone: property.timezone },
      today,
      units: units
        .map((u): HotelStaffUnit => ({
          code: u.code,
          roomNumber: u.physicalRoom.roomNumber,
          place: [u.physicalRoom.floor.building.name, u.physicalRoom.floor.name ? `этаж ${u.physicalRoom.floor.name}` : ''].filter(Boolean).join(', '),
          categoryName: u.accommodationType.name,
          status: u.housekeepingStatus,
          cleanedToday: doneToday.has(u.id),
        }))
        .sort(hotelUnitOrder),
      tasks: tasks
        .map((t): HotelStaffTask => ({
          id: t.id,
          title: t.title,
          note: t.note,
          dueDate: day(t.dueDate),
          dueTime: t.dueTime,
          priority: t.priority,
          done: t.doneAt !== null,
          overdue: t.doneAt === null && day(t.dueDate) < today,
        }))
        .sort(hotelTaskOrder),
      week: weekTemplate(hours.map((h) => ({ weekday: h.weekday, timeFrom: clock(h.timeFrom), timeTo: clock(h.timeTo) }))),
      month: { month, cleanings, tasksDone, shifts: shifts.shifts, daysOff: shifts.daysOff },
      pay: {
        month,
        currency: s.currency,
        fixedMinor: row.t.base.toString(),
        perCleaningMinor: row.perCleaningMinor.toString(),
        cleanings: row.cleanings,
        pieceMinor: row.t.piece.toString(),
        bonusMinor: row.t.bonus.toString(),
        penaltyMinor: row.t.penalty.toString(),
        totalMinor: row.t.total.toString(),
      },
    };
  }

  /** «Убрано» своему номеру: Грязно → Убрано, автор и сотрудник в журнале; повтор того же нажатия ничего не пишет */
  async clean(code: string) {
    if (typeof code !== 'string' || code.length > 100 || [...code].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127))
      throw new NotFoundException('Номер не найден');
    await foodWritable(this.prisma.db);
    const { s } = await this.scope(this.prisma.db);
    await foodTransaction(this.prisma, s, async (tx) => {
      const { property } = await this.scope(tx);
      const me = await this.me(tx, s);
      const unit = await tx.inventoryUnit.findUnique({ where: { propertyId_code: { propertyId: property.id, code } }, select: { id: true } });
      if (!unit) throw new NotFoundException('Номер не найден');
      const [locked] = await tx.$queryRaw<Array<{ status: string; assignee: string | null }>>`SELECT housekeeping_status::text AS status, housekeeping_assignee_id AS assignee FROM inventory_units WHERE id=${unit.id}::uuid FOR UPDATE`;
      if (!locked || locked.assignee !== me.id) throw new ForbiddenException('Этот номер убирает другой сотрудник: отметку ставит стойка');
      if (locked.status !== 'DIRTY') return;
      await tx.inventoryUnit.update({ where: { id: unit.id }, data: { housekeepingStatus: 'CLEAN' } });
      await tx.housekeepingEvent.create({ data: { inventoryUnitId: unit.id, fromStatus: 'DIRTY', toStatus: 'CLEAN', userId: me.userId, employeeId: me.id } });
      await tx.auditLog.create({
        data: { organizationId: s.organizationId, userId: me.userId, entityType: 'InventoryUnit', entityId: unit.id, action: 'unit.housekeeping', before: { status: 'DIRTY' }, after: { status: 'CLEAN', employeeId: me.id } },
      });
    }, HOTEL);
    return this.cabinet();
  }

  /** «Сделано» своей задаче */
  async taskDone(id: string) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new NotFoundException('Задача не найдена');
    await foodWritable(this.prisma.db);
    const { s } = await this.scope(this.prisma.db);
    await foodTransaction(this.prisma, s, async (tx) => {
      const { property } = await this.scope(tx);
      const me = await this.me(tx, s);
      const task = await tx.deskTask.findFirst({ where: { id, propertyId: property.id }, select: { id: true, assigneeUserId: true, doneAt: true } });
      if (!task) throw new NotFoundException('Задача не найдена');
      if (task.assigneeUserId !== me.userId) throw new ForbiddenException('Это задача другого сотрудника');
      if (task.doneAt) return;
      await tx.deskTask.update({ where: { id }, data: { doneAt: new Date(), doneById: me.userId } });
      await tx.auditLog.create({ data: { organizationId: s.organizationId, userId: me.userId, entityType: 'desk_task', entityId: id, action: 'desk.task.done', after: { done: true } } });
    }, HOTEL);
    return this.cabinet();
  }

  /** Сотрудники гостиницы этого филиала: для «Кто убирает», графика и зарплаты (право `desk`) */
  async employees() {
    foodMay('desk');
    const db = this.prisma.db;
    const { s, property } = await this.scope(db);
    const rows = await db.employee.findMany({
      where: { businessId: s.businessId, locations: { some: { locationId: s.locationId } } },
      select: {
        id: true,
        name: true,
        status: true,
        personnelKind: true,
        userId: true,
        _count: { select: { housekeepingUnits: { where: { propertyId: property.id } } } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return {
      canManage: actorMay('staff'),
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        active: r.status === 'ACTIVE',
        personnelKind: r.personnelKind,
        hasLogin: r.userId !== null,
        unitsAssigned: r._count.housekeepingUnits,
      })),
    };
  }


  /**
   * Сотрудники гостиницы приглашаются входом (администратор, руководитель, «Личный кабинет»), без карточки сотрудника,
   * и «График работы» их не видел (владелец 23.10.2026). Каждому, у кого есть доступ к этому филиалу (владелец и
   * руководитель всей организации, назначение на бизнес или на этот филиал), заводится карточка, привязанная ко входу,
   * и место работы в филиале. Уже привязанная карточка не дублируется; архивная не возвращается.
   */
  async syncMemberEmployees() {
    foodMay('desk');
    if (!actorMay('staff')) return;
    const s = await foodScope(this.prisma.db, HOTEL);
    await foodTransaction(
      this.prisma,
      s,
      async (tx, scope) => {
        const members = await tx.membership.findMany({
          where: { organizationId: scope.organizationId, status: 'ACTIVE' },
          select: { userId: true, role: true, user: { select: { name: true, email: true } } },
        });
        const scopes = await tx.membershipScope.findMany({
          where: { organizationId: scope.organizationId, userId: { in: members.map((m) => m.userId) } },
          select: { userId: true, businessId: true, locationId: true },
        });
        const here = members.filter((m) => {
          const own = scopes.filter((r) => r.userId === m.userId);
          if (own.length === 0) return m.role === 'OWNER' || m.role === 'MANAGER';
          return own.some(
            (r) => r.businessId === scope.businessId && (r.locationId === null || r.locationId === scope.locationId),
          );
        });
        if (!here.length) return;
        const existing = await tx.employee.findMany({
          where: { businessId: scope.businessId, userId: { in: here.map((m) => m.userId) } },
          select: { id: true, userId: true, status: true, locations: { select: { locationId: true } } },
        });
        for (const m of here) {
          const card = existing.find((e) => e.userId === m.userId);
          if (card) {
            if (card.status === 'ACTIVE' && !card.locations.some((l) => l.locationId === scope.locationId))
              await tx.employeeLocation.create({ data: { employeeId: card.id, locationId: scope.locationId } });
            continue;
          }
          const created = await tx.employee.create({
            data: {
              businessId: scope.businessId,
              userId: m.userId,
              name: (m.user.name?.trim() || m.user.email).slice(0, 200),
              email: m.user.email,
              personnelKind: 'OTHER_EMPLOYEE',
            },
          });
          await tx.employeeLocation.create({ data: { employeeId: created.id, locationId: scope.locationId } });
        }
      },
      HOTEL,
    );
  }
}
