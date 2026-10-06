import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY, type TaskInput, type TaskPriority } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import { actsForOrganization, currentOrganizationId } from '../auth/request-context';

/** Задача стойки (DATA_MODEL §22) в том виде, в каком её отдаёт API */
export interface DeskTaskRow {
  id: string;
  title: string;
  note: string | null;
  dueDate: string;
  dueTime: string | null;
  priority: TaskPriority;
  assigneeUserId: string | null;
  assigneeName: string | null;
  reservationNumber: string | null;
  guestId: string | null;
  doneAt: string | null;
  createdAt: string;
}

export interface TasksRepository {
  today(): Promise<string>;
  list(): Promise<DeskTaskRow[]>;
  /** Открытые задачи со сроком не позже даты: число для панели «Сегодня» */
  openDueCount(date: string): Promise<number>;
  /** Участник организации вошедшего: чужого человека исполнителем не назначить */
  isMember(userId: string): Promise<boolean>;
  reservationId(confirmationNumber: string): Promise<string | null>;
  create(input: TaskInput): Promise<DeskTaskRow>;
  update(id: string, input: TaskInput): Promise<DeskTaskRow | null>;
}
export const TASKS_REPOSITORY = Symbol('TASKS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const include = {
  assignee: { select: { name: true, email: true } },
  reservation: { select: { confirmationNumber: true } },
} as const;

@Injectable()
export class PrismaTasksRepository implements TasksRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  today() {
    return propertyToday(this.prisma.db, this.propertyName);
  }
  private propertyId() {
    return propertyIdRef(this.prisma.db, this.propertyName);
  }
  private toRow(t: {
    id: string;
    title: string;
    note: string | null;
    dueDate: Date;
    dueTime: string | null;
    priority: TaskPriority;
    assigneeUserId: string | null;
    guestId: string | null;
    doneAt: Date | null;
    createdAt: Date;
    assignee: { name: string | null; email: string } | null;
    reservation: { confirmationNumber: string } | null;
  }): DeskTaskRow {
    return {
      id: t.id,
      title: t.title,
      note: t.note,
      dueDate: iso(t.dueDate),
      dueTime: t.dueTime,
      priority: t.priority,
      assigneeUserId: t.assigneeUserId,
      assigneeName: t.assignee ? (t.assignee.name ?? t.assignee.email) : null,
      reservationNumber: t.reservation?.confirmationNumber ?? null,
      guestId: t.guestId,
      doneAt: t.doneAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    };
  }

  async list() {
    const rows = await this.prisma.db.deskTask.findMany({
      where: { propertyId: await this.propertyId() },
      include,
      orderBy: [{ dueDate: 'asc' }, { dueTime: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      // ponytail: все задачи объекта разом; при тысячах закрытых — окно по done_at
      take: 500,
    });
    return rows.map((r) => this.toRow(r));
  }
  async openDueCount(date: string) {
    return this.prisma.db.deskTask.count({
      where: { propertyId: await this.propertyId(), doneAt: null, dueDate: { lte: asDate(date) } },
    });
  }
  async isMember(userId: string) {
    // служебный путь без организации (скрипты) проверять не по чему
    if (!actsForOrganization()) return true;
    const organizationId = currentOrganizationId();
    if (!organizationId) return false;
    return (await this.prisma.db.membership.count({ where: { userId, organizationId } })) > 0;
  }
  async reservationId(confirmationNumber: string) {
    const r = await this.prisma.db.reservation.findFirst({
      where: { propertyId: await this.propertyId(), confirmationNumber },
      select: { id: true },
    });
    return r?.id ?? null;
  }
  private data(input: TaskInput, reservationId?: string | null) {
    const { title, note, dueDate, dueTime, priority, assigneeUserId, guestId, done } = input;
    return {
      ...(title !== undefined ? { title } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(dueDate !== undefined ? { dueDate: asDate(dueDate) } : {}),
      ...(dueTime !== undefined ? { dueTime } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
      ...(guestId !== undefined ? { guestId } : {}),
      ...(reservationId !== undefined ? { reservationId } : {}),
      ...(done === undefined ? {} : { doneAt: done ? new Date() : null, doneById: done ? auditUserId() : null }),
    };
  }
  async create(input: TaskInput) {
    const propertyId = await this.propertyId();
    const reservationId = input.reservationNumber ? await this.reservationId(input.reservationNumber) : null;
    const row = await this.prisma.db.deskTask.create({
      data: { propertyId, createdById: auditUserId(), ...this.data(input, reservationId) } as never, // title и dueDate проверены разбором
      include,
    });
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'desk_task',
        entityId: row.id,
        action: 'desk.task.created',
        after: JSON.parse(JSON.stringify({ title: row.title, dueDate: iso(row.dueDate) })),
      },
    });
    return this.toRow(row);
  }
  async update(id: string, input: TaskInput) {
    const propertyId = await this.propertyId();
    const before = await this.prisma.db.deskTask.findFirst({ where: { id, propertyId }, select: { id: true } });
    if (!before) return null;
    const reservationId =
      input.reservationNumber === undefined
        ? undefined
        : input.reservationNumber === null
          ? null
          : await this.reservationId(input.reservationNumber);
    const row = await this.prisma.db.deskTask.update({ where: { id }, data: this.data(input, reservationId), include });
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'desk_task',
        entityId: id,
        action: input.done === undefined ? 'desk.task.updated' : input.done ? 'desk.task.done' : 'desk.task.reopened',
        after: JSON.parse(JSON.stringify(input)),
      },
    });
    return this.toRow(row);
  }
}
