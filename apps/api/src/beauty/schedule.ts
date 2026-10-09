import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
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
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  parseTimeOffInput,
  parseWorkingHoursWeek,
  timeOffWindow,
  weekTemplate,
  type WorkingInterval,
} from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Access } from '../auth/access.decorator';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID, type BeautyScope } from './scope';

/**
 * График мастера и отсутствия (DATA_MODEL §19.1, Q-251, срез B4).
 *
 * График недельным шаблоном и на филиал: одна и та же мастерская рука в двух салонах работает в разные
 * часы. Отсутствие на всю сеть: мастер уехал целиком, у таблицы филиала нет.
 *
 * Отсутствие уже созданные записи не отменяет: отмена записи это деньги, а Q-252 открыт. Поэтому
 * наложение только считается и показывается человеку словами.
 *
 * Права по Q-253: смотреть график это `desk` (без него не работает стойка смены), менять график,
 * отсутствия и филиалы мастера это `property`, как сам мастер в срезе B3.
 */

/** Записи этих состояний место мастера не занимают: так же считает exclusion constraint в §19.1 */
const BUSY_STATUSES = ['BOOKED', 'CONFIRMED', 'DONE'] as const;

@Injectable()
export class BeautyScheduleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Экран графика: мастера бизнеса, неделя выбранного в этом филиале, его отсутствия и филиалы */
  async overview(employeeId?: string) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);

    const employees = await this.prisma.db.employee.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, status: true, locations: { select: { locationId: true } } },
    });
    const locations = await this.prisma.db.location.findMany({
      where: { businessId: scope.businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });

    const wanted = employeeId?.trim() ? employeeId.trim() : null;
    if (wanted && (!UUID.test(wanted) || !employees.some((e) => e.id === wanted)))
      throw new NotFoundException('Мастер не найден');
    const chosen = wanted
      ? (employees.find((e) => e.id === wanted) ?? null)
      : (employees.find(
          (e) =>
            e.status === 'ACTIVE' &&
            (scope.locationId === null || e.locations.some((l) => l.locationId === scope.locationId)),
        ) ??
        employees.find((e) => e.status === 'ACTIVE') ??
        employees[0] ??
        null);

    const list = employees.map((e) => ({
      id: e.id,
      name: e.name,
      active: e.status === 'ACTIVE',
      worksHere: scope.locationId !== null && e.locations.some((l) => l.locationId === scope.locationId),
    }));

    return {
      location:
        scope.locationId === null
          ? null
          : { id: scope.locationId, name: scope.locationName, timezone: scope.locationTimezone },
      employees: list,
      employee: chosen
        ? {
            id: chosen.id,
            name: chosen.name,
            active: chosen.status === 'ACTIVE',
            worksHere:
              scope.locationId !== null &&
              chosen.locations.some((l) => l.locationId === scope.locationId),
            locationIds: chosen.locations.map((l) => l.locationId),
          }
        : null,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        assigned: chosen ? chosen.locations.some((x) => x.locationId === l.id) : false,
      })),
      week: weekTemplate(chosen && scope.locationId ? await this.hours(chosen.id, scope.locationId) : []),
      timeOffs: chosen ? await this.timeOffs(chosen.id, scope) : [],
    };
  }

  /** Неделя целиком: список заменяет прежний график мастера в этом филиале */
  async setWorkingHours(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    const scope = await this.employeeScope(id);
    if (!scope.locationId) throw new ConflictException('Сначала выберите филиал');
    const parsed = parseWorkingHoursWeek(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);

    const assigned = await this.prisma.db.employeeLocation.findFirst({
      where: { employeeId: id, locationId: scope.locationId },
      select: { employeeId: true },
    });
    if (!assigned)
      throw new ConflictException('Мастер в этом филиале не работает: сначала поставьте его в филиал');

    const locationId = scope.locationId;
    await beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.workingHours.deleteMany({ where: { employeeId: id, locationId } });
      if (parsed.value.length)
        await tx.workingHours.createMany({
          data: parsed.value.map((i) => ({
            id: randomUUID(),
            employeeId: id,
            locationId,
            weekday: i.weekday,
            timeFrom: clockToDate(i.timeFrom),
            timeTo: clockToDate(i.timeTo),
          })),
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: id,
          action: 'beauty.employee.working_hours.set',
          after: { locationId, intervals: parsed.value.map((i) => `${i.weekday} ${i.timeFrom}-${i.timeTo}`) },
        },
      });
    });
    return { week: weekTemplate(await this.hours(id, locationId)) };
  }

  /** Отсутствие мастера. Записи в эти дни не отменяются, их число возвращается словами для человека */
  async addTimeOff(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    const scope = await this.employeeScope(id);
    const parsed = parseTimeOffInput(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const timezone = scope.locationTimezone ?? 'UTC';

    const window = timeOffWindow({ ...parsed.value, timezone });
    const affected = await this.prisma.db.appointment.count({
      where: {
        employeeId: id,
        status: { in: [...BUSY_STATUSES] },
        startsAt: { gte: window.fromUtc, lt: window.toUtcExclusive },
      },
    });

    const timeOffId = randomUUID();
    await beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.timeOff.create({
        data: {
          id: timeOffId,
          employeeId: id,
          dateFrom: dateToUtc(parsed.value.dateFrom),
          dateTo: dateToUtc(parsed.value.dateTo),
          reason: parsed.value.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: id,
          action: 'beauty.employee.time_off.added',
          after: {
            timeOffId,
            dateFrom: parsed.value.dateFrom,
            dateTo: parsed.value.dateTo,
            reason: parsed.value.reason,
            appointments: affected,
          },
        },
      });
    });
    return { timeOffs: await this.timeOffs(id, scope), affected };
  }

  async removeTimeOff(id: string, timeOffId: string) {
    await mayBeautyWrite(this.prisma, 'property');
    const scope = await this.employeeScope(id);
    if (!UUID.test(timeOffId)) throw new NotFoundException('Отсутствие не найдено');
    const row = await this.prisma.db.timeOff.findFirst({
      where: { id: timeOffId, employeeId: id },
      select: { id: true, dateFrom: true, dateTo: true, reason: true },
    });
    if (!row) throw new NotFoundException('Отсутствие не найдено');

    await beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.timeOff.delete({ where: { id: row.id } });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: id,
          action: 'beauty.employee.time_off.removed',
          before: {
            timeOffId: row.id,
            dateFrom: utcToDate(row.dateFrom),
            dateTo: utcToDate(row.dateTo),
            reason: row.reason,
          },
        },
      });
    });
    return { timeOffs: await this.timeOffs(id, scope) };
  }

  /**
   * Филиалы мастера списком целиком. Снять филиал, где у мастера есть будущие записи, нельзя: запись
   * осталась бы у мастера, который в этом филиале больше не работает, а отменять её не наше решение
   * (Q-252). График снятого филиала уходит вместе с ним, иначе он остался бы висеть ничьим.
   */
  async setLocations(id: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'property');
    const scope = await this.employeeScope(id);
    const body = (raw ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(body['locationIds']) ? body['locationIds'] : null;
    if (!ids || ids.some((v) => typeof v !== 'string' || !UUID.test(v)))
      throw new BadRequestException('Выберите филиалы мастера');
    const wanted = [...new Set(ids as string[])];

    const own = await this.prisma.db.location.findMany({
      where: { id: { in: wanted }, businessId: scope.businessId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (own.length !== wanted.length) throw new BadRequestException('Среди выбранных филиалов есть чужой');

    const current = await this.prisma.db.employeeLocation.findMany({
      where: { employeeId: id },
      select: { locationId: true, location: { select: { name: true } } },
    });
    const removed = current.filter((row) => !wanted.includes(row.locationId));
    for (const row of removed) {
      const booked = await this.prisma.db.appointment.count({
        where: {
          employeeId: id,
          locationId: row.locationId,
          status: { in: [...BUSY_STATUSES] },
          startsAt: { gte: new Date() },
        },
      });
      if (booked)
        throw new ConflictException(
          `В филиале «${row.location.name}» у мастера ${booked} будущих записей: сначала разберитесь с ними`,
        );
    }

    const added = wanted.filter((locationId) => !current.some((row) => row.locationId === locationId));
    await beautyTransaction(this.prisma, scope, async (tx) => {
      if (removed.length) {
        const locationIds = removed.map((row) => row.locationId);
        await tx.workingHours.deleteMany({ where: { employeeId: id, locationId: { in: locationIds } } });
        await tx.employeeLocation.deleteMany({ where: { employeeId: id, locationId: { in: locationIds } } });
      }
      if (added.length)
        await tx.employeeLocation.createMany({
          data: added.map((locationId) => ({ employeeId: id, locationId })),
        });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'employee',
          entityId: id,
          action: 'beauty.employee.locations.set',
          before: { locationIds: current.map((row) => row.locationId) },
          after: { locationIds: wanted },
        },
      });
    });
    return this.overview(id);
  }

  // ───────────── выборки ─────────────

  /** Мастер своего бизнеса. Чужой или несуществующий одинаково не найден: лишнего наружу не говорим */
  private async employeeScope(id: string): Promise<BeautyScope> {
    if (!UUID.test(id)) throw new NotFoundException('Мастер не найден');
    const scope = await beautyScope(this.prisma, true);
    const employee = await this.prisma.db.employee.findFirst({
      where: { id, businessId: scope.businessId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Мастер не найден');
    return scope;
  }

  private async hours(employeeId: string, locationId: string): Promise<WorkingInterval[]> {
    const rows = await this.prisma.db.workingHours.findMany({
      where: { employeeId, locationId },
      orderBy: [{ weekday: 'asc' }, { timeFrom: 'asc' }],
      select: { weekday: true, timeFrom: true, timeTo: true },
    });
    return rows.map((r) => ({
      weekday: r.weekday,
      timeFrom: dateToClock(r.timeFrom),
      timeTo: dateToClock(r.timeTo),
    }));
  }

  /** Отсутствия, которые ещё не кончились: прошлые графику не мешают и экран не засоряют */
  private async timeOffs(employeeId: string, scope: BeautyScope) {
    const timezone = scope.locationTimezone ?? 'UTC';
    const today = todayIn(timezone);
    const rows = await this.prisma.db.timeOff.findMany({
      where: { employeeId, dateTo: { gte: dateToUtc(today) } },
      orderBy: { dateFrom: 'asc' },
      select: { id: true, dateFrom: true, dateTo: true, reason: true },
    });
    if (!rows.length) return [];

    // одна выборка на все отсутствия: записи считаются по окну каждого уже в памяти
    const windows = rows.map((row) => ({
      row,
      window: timeOffWindow({
        dateFrom: utcToDate(row.dateFrom),
        dateTo: utcToDate(row.dateTo),
        timezone,
      }),
    }));
    const appointments = await this.prisma.db.appointment.findMany({
      where: {
        employeeId,
        status: { in: [...BUSY_STATUSES] },
        startsAt: {
          gte: windows.reduce((min, w) => (w.window.fromUtc < min ? w.window.fromUtc : min), windows[0]!.window.fromUtc),
          lt: windows.reduce(
            (max, w) => (w.window.toUtcExclusive > max ? w.window.toUtcExclusive : max),
            windows[0]!.window.toUtcExclusive,
          ),
        },
      },
      select: { startsAt: true },
    });

    return windows.map(({ row, window }) => ({
      id: row.id,
      dateFrom: utcToDate(row.dateFrom),
      dateTo: utcToDate(row.dateTo),
      reason: row.reason,
      appointments: appointments.filter((a) => a.startsAt >= window.fromUtc && a.startsAt < window.toUtcExclusive)
        .length,
    }));
  }
}

// ───────────── DATE и TIME базы наружу строками ─────────────

/** `time` Prisma отдаёт как момент 1970-01-01: наружу уходит «ЧЧ:ММ» */
function dateToClock(at: Date): string {
  return at.toISOString().slice(11, 16);
}

function clockToDate(clock: string): Date {
  return new Date(`1970-01-01T${clock}:00Z`);
}

/** `date` Prisma отдаёт как полночь UTC: наружу уходит «ГГГГ-ММ-ДД» */
function utcToDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function dateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Сегодня в поясе филиала: отсутствие «ещё не кончилось» считается по его календарю (AGENTS.md §13) */
function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@RequiresBusinessCapability('beauty.employees')
@Access('desk')
@Controller('beauty')
export class BeautyScheduleController {
  constructor(@Inject(BeautyScheduleService) private readonly service: BeautyScheduleService) {}

  @Get('schedule') schedule(@Query('employee') employee?: string) {
    return this.service.overview(employee);
  }
  @Access('property') @Put('employees/:id/working-hours') setWorkingHours(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.setWorkingHours(id, body);
  }
  @Access('property') @Post('employees/:id/time-offs') addTimeOff(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.addTimeOff(id, body);
  }
  @Access('property') @Delete('employees/:id/time-offs/:timeOffId') removeTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
  ) {
    return this.service.removeTimeOff(id, timeOffId);
  }
  @Access('property') @Put('employees/:id/locations') setLocations(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.setLocations(id, body);
  }
}
