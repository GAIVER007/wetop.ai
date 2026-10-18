import {
  Controller,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { PrismaService } from '../database/prisma.provider';
import { beautyScope, mayBeauty } from './scope';

const HISTORY_LIMIT = 100;

export const BEAUTY_APPOINTMENT_HISTORY_ACTIONS = [
  'beauty.appointment.created',
  'beauty.appointment.moved',
  'beauty.appointment.status',
  'beauty.appointment.paid',
  'beauty.appointment.refunded',
] as const;

export type BeautyAppointmentHistoryAction = (typeof BEAUTY_APPOINTMENT_HISTORY_ACTIONS)[number];

export interface BeautyAppointmentHistorySnapshot {
  startsAt?: string;
  endsAt?: string;
  employee?: { id: string; name: string };
  service?: { id: string; name: string };
  priceMinor?: string;
  status?: string;
  method?: string;
  amountMinor?: string;
  paidMinor?: string;
  reason?: string;
  items?: Array<{
    position: number;
    startsAt: string;
    endsAt?: string;
    priceMinor: string;
    employee: { id: string; name: string };
    service: { id: string; name: string };
  }>;
}

export interface BeautyAppointmentHistoryResponse {
  timezone: string;
  currency: string;
  items: Array<{
    id: string;
    at: string;
    action: BeautyAppointmentHistoryAction;
    author: { id: string; name: string } | null;
    before: BeautyAppointmentHistorySnapshot;
    after: BeautyAppointmentHistorySnapshot;
  }>;
  truncated: boolean;
}

type NamedEntity = { id: string; name: string };

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

function collectEntityIds(value: unknown, employeeIds: Set<string>, serviceIds: Set<string>) {
  const snapshot = object(value);
  const employeeId = text(snapshot['employeeId']);
  const serviceId = text(snapshot['serviceId']);
  if (employeeId) employeeIds.add(employeeId);
  if (serviceId) serviceIds.add(serviceId);
  if (Array.isArray(snapshot['items'])) {
    for (const item of snapshot['items']) collectEntityIds(item, employeeIds, serviceIds);
  }
}

function resolved(value: unknown, entities: Map<string, string>): NamedEntity | undefined {
  const id = text(value);
  const name = id ? entities.get(id) : undefined;
  return id && name ? { id, name } : undefined;
}

function sanitizeSnapshot(
  action: BeautyAppointmentHistoryAction,
  side: 'before' | 'after',
  value: unknown,
  employees: Map<string, string>,
  services: Map<string, string>,
): BeautyAppointmentHistorySnapshot {
  const source = object(value);
  const snapshot: BeautyAppointmentHistorySnapshot = {};
  if (action === 'beauty.appointment.created' && side === 'before') return snapshot;
  if (action === 'beauty.appointment.created' || action === 'beauty.appointment.moved') {
    const startsAt = text(source['startsAt']);
    const endsAt = text(source['endsAt']);
    const priceMinor = text(source['priceMinor']);
    const employee = resolved(source['employeeId'], employees);
    const service = resolved(source['serviceId'], services);
    if (startsAt) snapshot.startsAt = startsAt;
    if (endsAt) snapshot.endsAt = endsAt;
    if (priceMinor) snapshot.priceMinor = priceMinor;
    if (employee) snapshot.employee = employee;
    if (service) snapshot.service = service;
  }
  if (
    action === 'beauty.appointment.created' &&
    side === 'after' &&
    Array.isArray(source['items'])
  ) {
    snapshot.items = source['items'].flatMap((raw) => {
      const item = object(raw);
      const position = item['position'];
      const startsAt = text(item['startsAt']);
      const endsAt = text(item['endsAt']);
      const priceMinor = text(item['priceMinor']);
      const employee = resolved(item['employeeId'], employees);
      const service = resolved(item['serviceId'], services);
      if (!Number.isInteger(position) || !startsAt || !priceMinor || !employee || !service)
        return [];
      return [
        {
          position: Number(position),
          startsAt,
          ...(endsAt ? { endsAt } : {}),
          priceMinor,
          employee,
          service,
        },
      ];
    });
  }
  if (action === 'beauty.appointment.status') {
    const status = text(source['status']);
    if (status) snapshot.status = status;
  }
  if (action === 'beauty.appointment.paid' || action === 'beauty.appointment.refunded') {
    const method = text(source['method']);
    const amountMinor = text(source['amountMinor']);
    if (method) snapshot.method = method;
    if (amountMinor) snapshot.amountMinor = amountMinor;
  }
  if (action === 'beauty.appointment.paid') {
    const paidMinor = text(source['paidMinor']);
    if (paidMinor) snapshot.paidMinor = paidMinor;
  }
  if (action === 'beauty.appointment.refunded') {
    const reason = text(source['reason']);
    if (reason) snapshot.reason = reason;
  }
  return snapshot;
}

@Injectable()
export class BeautyAppointmentHistoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async history(id: string): Promise<BeautyAppointmentHistoryResponse> {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma, true);
    const appointment = await this.prisma.db.appointment.findFirst({
      where: { id, locationId: scope.locationId! },
      select: { id: true, currency: true },
    });
    if (!appointment) throw new NotFoundException('Запись не найдена');
    const rows = await this.prisma.db.auditLog.findMany({
      where: {
        organizationId: scope.organizationId,
        entityType: 'appointment',
        entityId: id,
        action: { in: [...BEAUTY_APPOINTMENT_HISTORY_ACTIONS] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_LIMIT + 1,
      select: {
        id: true,
        createdAt: true,
        action: true,
        before: true,
        after: true,
        user: { select: { id: true, name: true } },
      },
    });
    const visible = rows.slice(0, HISTORY_LIMIT);
    const employeeIds = new Set<string>();
    const serviceIds = new Set<string>();
    for (const row of visible) {
      collectEntityIds(row.before, employeeIds, serviceIds);
      collectEntityIds(row.after, employeeIds, serviceIds);
    }
    const [employeeRows, serviceRows] = await Promise.all([
      employeeIds.size
        ? this.prisma.db.employee.findMany({
            where: { id: { in: [...employeeIds] }, businessId: scope.businessId },
            select: { id: true, name: true },
          })
        : [],
      serviceIds.size
        ? this.prisma.db.beautyService.findMany({
            where: { id: { in: [...serviceIds] }, businessId: scope.businessId },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const employees = new Map(employeeRows.map((row) => [row.id, row.name]));
    const services = new Map(serviceRows.map((row) => [row.id, row.name]));
    return {
      timezone: scope.locationTimezone ?? 'UTC',
      currency: appointment.currency,
      items: visible.map((row) => {
        const action = row.action as BeautyAppointmentHistoryAction;
        return {
          id: row.id,
          at: row.createdAt.toISOString(),
          action,
          author: row.user
            ? { id: row.user.id, name: row.user.name ?? 'Пользователь без имени' }
            : null,
          before: sanitizeSnapshot(action, 'before', row.before, employees, services),
          after: sanitizeSnapshot(action, 'after', row.after, employees, services),
        };
      }),
      truncated: rows.length > HISTORY_LIMIT,
    };
  }
}

@RequiresBusinessCapability('beauty.appointments')
@Access('desk')
@Controller('beauty/appointments')
export class BeautyAppointmentHistoryController {
  constructor(
    @Inject(BeautyAppointmentHistoryService)
    private readonly service: BeautyAppointmentHistoryService,
  ) {}

  @BeautyAccess('appointments', 'view')
  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }
}
