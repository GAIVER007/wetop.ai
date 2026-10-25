import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  canWrite,
  roleAt,
  can,
  parseBeautyPermissions,
  resolveBeautyPositionAccess,
  beautyPermissionScope,
} from '@pms/domain';
import type { DbTx, PaymentMethod } from '@pms/database';
import {
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentRole,
  currentUserId,
  currentVertical,
  actorMay,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { assertBeautyOperation, runWithBeautyWriteAuthorization } from '../beauty/access';
import { readCashShiftSnapshot } from './cash-shift-sources';
import { createHotelCash } from './hotel-cash';
import { cashAmount, cashDelta, closeCashShift } from './cash-shift-rules';

type Scope = {
  organizationId: string;
  propertyId: string | null;
  locationId: string;
  name: string;
  currency: string;
  timezone: string;
};
type Register = { id: string; cashier_ids: string[] };
type Snapshot = {
  balances: Record<string, string>;
  expenses: Record<string, string>;
  received: Record<string, string>;
  refunds: Record<string, string>;
  fingerprint: string;
};
type Shift = {
  id: string;
  responsible_user_id: string;
  opened_at: Date;
  closed_at: Date | null;
  opening: { snapshot: Snapshot; counted: string; note: string };
  closing: Record<string, unknown> | null;
};
export type CashShiftState = {
  registerId: string;
  name: string;
  currency: string;
  timezone: string;
  snapshot: Snapshot;
  active: Shift | null;
  history: Shift[];
  totals: {
    expenses: Record<string, string>;
    received: Record<string, string>;
    refunds: Record<string, string>;
  } | null;
  mayOperate: boolean;
  mayManage: boolean;
  currentUserId: string;
  cashierIds: string[];
  members: Array<{ id: string; name: string }>;
  handovers: Array<{
    id: string;
    recipient_id: string;
    amount: string;
    shift_id: string;
    acknowledged_at: Date | null;
  }>;
};
export type CashCommand = {
  key?: string;
  action?: string;
  amount?: string;
  counted?: string;
  retained?: string;
  method?: string;
  category?: string;
  note?: string;
  fingerprint?: string;
  shiftId?: string;
  recipientId?: string;
  handoverId?: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
];

@Injectable()
export class CashShiftsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async scope(db: DbTx): Promise<Scope> {
    const org = currentOrganizationId(),
      locationId = currentLocationId(),
      businessId = currentBusinessId();
    if (!currentUserId() || !org || !locationId || !businessId || !actorMay('desk'))
      throw new ForbiddenException('Выберите доступный филиал для работы с кассой');
    const location = await db.location.findFirst({
      where: {
        id: locationId,
        businessId,
        status: 'ACTIVE',
        business: { organizationId: org, status: 'ACTIVE', vertical: currentVertical()! },
      },
      select: {
        name: true,
        currency: true,
        timezone: true,
        property: { select: { id: true, currency: true } },
      },
    });
    if (!location) throw new ForbiddenException('Касса этого филиала недоступна');
    const hotel = currentVertical() === 'HOSPITALITY';
    if (hotel && !location.property)
      throw new ConflictException('Гостиничный объект ещё не настроен');
    if (hotel && location.property?.currency !== location.currency)
      throw new ConflictException('Валюты объекта и филиала не совпадают');
    return {
      organizationId: org,
      locationId,
      propertyId: hotel ? location.property!.id : null,
      name: location.name,
      currency: location.currency,
      timezone: location.timezone,
    };
  }
  private manager() {
    return currentRole() === 'OWNER' || currentRole() === 'MANAGER';
  }
  private async writable(db: DbTx, scope: Scope) {
    const org = await db.organization.findUnique({
      where: { id: scope.organizationId },
      select: { status: true, trialEndsAt: true },
    });
    if (!org || !canWrite(org.status, org.trialEndsAt, new Date()))
      throw new ForbiddenException('Организация доступна только для чтения');
  }
  private async register(db: DbTx, scope: Scope): Promise<Register> {
    const locationId = scope.propertyId ? null : scope.locationId;
    await db.$executeRaw`INSERT INTO cash_registers (id,organization_id,property_id,location_id,name,currency)
      VALUES (${randomUUID()}::uuid,${scope.organizationId}::uuid,${scope.propertyId}::uuid,${locationId}::uuid,${scope.name},${scope.currency}) ON CONFLICT DO NOTHING`;
    const rows = await db.$queryRaw<Register[]>`SELECT id,cashier_ids FROM cash_registers WHERE
      property_id = ${scope.propertyId}::uuid OR location_id = ${locationId}::uuid FOR UPDATE`;
    if (!rows[0]) throw new ForbiddenException('Касса недоступна');
    return rows[0];
  }
  private async snapshot(db: DbTx, scope: Scope, register: Register): Promise<Snapshot> {
    return readCashShiftSnapshot(db, scope, register.id);
  }
  private async reconcile(db: DbTx, scope: Scope, expected: bigint, counted: bigint, note: string) {
    const id = randomUUID();
    if (scope.propertyId) {
      await db.$executeRaw`INSERT INTO cash_reconciliations(id,property_id,method,expected,counted,note,created_by_id) VALUES (${id}::uuid,${scope.propertyId}::uuid,'CASH',${expected},${counted},${note},${currentUserId()}::uuid)`;
    } else {
      await db.$executeRaw`INSERT INTO restaurant_cash_reconciliations(id,location_id,method,expected,counted,note,created_by_id) VALUES (${id}::uuid,${scope.locationId}::uuid,'CASH',${expected},${counted},${note},${currentUserId()}::uuid)`;
    }
    return id;
  }
  private async view(db: DbTx, scope: Scope, register: Register): Promise<CashShiftState> {
    const [snapshot, shifts, handovers] = await Promise.all([
      this.snapshot(db, scope, register),
      db.$queryRaw<
        Shift[]
      >`SELECT * FROM cash_shifts WHERE register_id=${register.id}::uuid ORDER BY opened_at DESC,id DESC LIMIT 30`,
      db.$queryRaw<
        Array<{
          id: string;
          recipient_id: string;
          amount: bigint;
          acknowledged_at: Date | null;
          shift_id: string;
        }>
      >`SELECT id,recipient_id,amount,acknowledged_at,shift_id FROM cash_handovers WHERE register_id=${register.id}::uuid AND acknowledged_at IS NULL ORDER BY created_at`,
    ]);
    const active = shifts.find((s) => !s.closed_at) ?? null;
    const members = await db.membership.findMany({
      where: { organizationId: scope.organizationId, status: 'ACTIVE' },
      select: {
        userId: true,
        role: true,
        beautyPositionAssignments: { include: { position: { include: { permissions: true } } } },
        user: {
          select: {
            name: true,
            membershipScopes: { where: { organizationId: scope.organizationId } },
          },
        },
      },
    });
    let mayCreate = true,
      mayManage = this.manager();
    if (currentVertical() === 'BEAUTY') {
      try {
        await assertBeautyOperation(db, 'finance', 'create', { legacy: 'desk' });
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
        mayCreate = false;
      }
      if (mayManage) {
        try {
          await assertBeautyOperation(db, 'settings', 'update', { legacy: 'settings' });
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
          mayManage = false;
        }
      }
    }
    return {
      registerId: register.id,
      name: scope.name,
      currency: scope.currency,
      timezone: scope.timezone,
      snapshot,
      active,
      history: shifts.filter((s) => s.closed_at),
      totals: active
        ? {
            expenses: cashDelta(active.opening.snapshot.expenses, snapshot.expenses),
            received: cashDelta(active.opening.snapshot.received, snapshot.received),
            refunds: cashDelta(active.opening.snapshot.refunds, snapshot.refunds),
          }
        : null,
      mayOperate: mayCreate && (this.manager() || register.cashier_ids.includes(currentUserId()!)),
      mayManage,
      currentUserId: currentUserId()!,
      cashierIds: mayManage ? register.cashier_ids : [],
      members: members
        .filter((m) =>
          can(
            roleAt(
              m.role,
              m.user.membershipScopes
                .filter((a) => a.role !== 'OWNER')
                .map((a) => ({ ...a, role: a.role as 'MANAGER' | 'STAFF' })),
              {
                businessId: currentBusinessId()!,
                locationId: scope.locationId,
              },
            ),
            'desk',
          ),
        )
        .filter((m) => {
          if (currentVertical() !== 'BEAUTY' || m.role === 'OWNER') return true;
          const assignments = m.beautyPositionAssignments.map((row) => {
            const permissions = parseBeautyPermissions(
              row.position.permissions.map(({ section, action, scope }) => ({
                section,
                action,
                scope,
              })),
            );
            return {
              ...row,
              position: { ...row.position, permissions: permissions.ok ? permissions.value : [] },
            };
          });
          const access = resolveBeautyPositionAccess(assignments, {
            businessId: currentBusinessId()!,
            locationId: scope.locationId,
          });
          return (
            access.mode === 'LEGACY' ||
            (access.assigned &&
              beautyPermissionScope(access.permissions, 'finance', 'view') === 'BUSINESS' &&
              beautyPermissionScope(access.permissions, 'finance', 'create') === 'BUSINESS')
          );
        })
        .map((m) => ({ id: m.userId, name: m.user.name || 'Сотрудник' })),
      handovers: handovers.map((h) => ({ ...h, amount: String(h.amount) })),
    };
  }
  state(): Promise<CashShiftState> {
    return this.prisma.db.$transaction(async (db) => {
      if (currentVertical() === 'BEAUTY')
        await assertBeautyOperation(db, 'finance', 'view', { legacy: 'desk' });
      const scope = await this.scope(db);
      const register = await this.register(db, scope);
      return this.view(db, scope, register);
    });
  }
  async command(body: CashCommand): Promise<CashShiftState> {
    if (
      !body ||
      typeof body.key !== 'string' ||
      !UUID.test(body.key) ||
      !['open', 'close', 'expense', 'income', 'acknowledge'].includes(body.action ?? '')
    )
      throw new BadRequestException('Некорректная команда кассы');
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 390) throw new BadRequestException('Комментарий: максимум 390 символов');
    const fingerprint = createHash('sha256')
      .update(
        currentUserId() +
          JSON.stringify(
            Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b))),
          ),
      )
      .digest('hex');
    try {
      return await this.prisma.db.$transaction(
        async (db) =>
          runWithBeautyWriteAuthorization(db, async () => {
            const scope = await this.scope(db);
            await this.writable(db, scope);
            if (currentVertical() === 'BEAUTY')
              await assertBeautyOperation(db, 'finance', 'create', { legacy: 'desk' });
            await db.$queryRaw`SELECT id FROM locations WHERE id=${scope.locationId}::uuid FOR UPDATE`;
            const register = await this.register(db, scope);
            const mayOperate = this.manager() || register.cashier_ids.includes(currentUserId()!);
            if (!mayOperate && body.action !== 'acknowledge')
              throw new ForbiddenException(
                'Владелец или управляющий должен выдать вам права кассира',
              );
            const prior = await db.$queryRaw<
              Array<{ fingerprint: string }>
            >`SELECT fingerprint FROM cash_commands WHERE register_id=${register.id}::uuid AND command_key=${body.key}::uuid`;
            if (prior[0]) {
              if (prior[0].fingerprint !== fingerprint)
                throw new ConflictException('Этот ключ уже использован для другой команды');
              return this.view(db, scope, register);
            }
            const before = await this.view(db, scope, register),
              active = before.active;
            if (body.action === 'open') {
              if (active) throw new ConflictException('Смена уже открыта');
              const counted = cashAmount(body.counted),
                expected = BigInt(before.snapshot.balances.CASH ?? '0');
              if (counted !== expected && !note)
                throw new BadRequestException('Объясните расхождение при открытии');
              const reconciliationId = await this.reconcile(db, scope, expected, counted, note);
              await db.$executeRaw`INSERT INTO cash_shifts(id,register_id,responsible_user_id,opening) VALUES (${randomUUID()}::uuid,${register.id}::uuid,${currentUserId()}::uuid,${JSON.stringify({ snapshot: before.snapshot, counted: String(counted), note, reconciliationId })}::jsonb)`;
            } else if (body.action === 'acknowledge') {
              if (typeof body.handoverId !== 'string' || !UUID.test(body.handoverId))
                throw new BadRequestException('Выберите передачу');
              const requested = before.handovers.find((h) => h.id === body.handoverId);
              if (
                requested &&
                BigInt(requested.amount) > BigInt(before.snapshot.balances.CASH ?? '0')
              )
                throw new ConflictException(
                  'В кассе недостаточно денег для подтверждения передачи',
                );
              const rows = await db.$queryRaw<
                Array<{ id: string }>
              >`UPDATE cash_handovers SET acknowledged_at=now() WHERE id=${body.handoverId}::uuid AND register_id=${register.id}::uuid AND recipient_id=${currentUserId()}::uuid AND acknowledged_at IS NULL RETURNING id`;
              if (!rows[0]) throw new ConflictException('Передача недоступна или уже подтверждена');
            } else {
              if (!active || active.id !== body.shiftId)
                throw new ConflictException('Смена изменилась. Обновите кассу');
              if (active.responsible_user_id !== currentUserId())
                throw new ForbiddenException(
                  'Закрытие и расход выполняет ответственный кассир этой смены',
                );
              if (body.action === 'expense' || body.action === 'income') {
                const kind = body.action === 'expense' ? 'EXPENSE' : 'INCOME';
                const amount = cashAmount(body.amount),
                  method = body.method ?? 'CASH';
                if (amount <= 0n || !METHODS.includes(method))
                  throw new BadRequestException('Проверьте сумму и способ оплаты');
                if (
                  kind === 'EXPENSE' &&
                  method === 'CASH' &&
                  amount > BigInt(before.snapshot.balances.CASH ?? '0')
                )
                  throw new ConflictException('Недостаточно наличных по системе');
                const category = typeof body.category === 'string' ? body.category.trim() : '';
                if (!category || category.length > 100)
                  throw new BadRequestException('Укажите статью расхода до 100 символов');
                const standard =
                  kind === 'INCOME'
                    ? ['Внесение']
                    : ['Такси', 'Закупка материалов', 'Хозяйственные расходы', 'Прочее'];
                if (scope.propertyId) {
                  const existing = await db.cashCategory.findUnique({
                    where: {
                      propertyId_kind_name: { propertyId: scope.propertyId, kind, name: category },
                    },
                  });
                  if (!existing && !standard.includes(category) && !this.manager())
                    throw new ForbiddenException('Новые статьи создаёт владелец или управляющий');
                  const entry =
                    existing ??
                    (await db.cashCategory.create({
                      data: { propertyId: scope.propertyId, kind, name: category },
                    }));
                  if (!entry.active) throw new ConflictException('Статья расхода недоступна');
                  await createHotelCash(db, {
                    propertyId: scope.propertyId,
                    cashShiftId: active.id,
                    kind,
                    method: method as PaymentMethod,
                    amount,
                    categoryId: entry.id,
                    note,
                    createdById: currentUserId(),
                  });
                } else {
                  if (!standard.includes(category) && !this.manager())
                    throw new ForbiddenException('Новые статьи создаёт владелец или управляющий');
                  await db.$executeRaw`INSERT INTO restaurant_cash_operations(id,location_id,cash_shift_id,kind,method,amount,currency,note,created_by_id) VALUES (${randomUUID()}::uuid,${scope.locationId}::uuid,${active.id}::uuid,${kind}::"CashOperationKind",${method}::"PaymentMethod",${amount},${scope.currency},${category + ': ' + note},${currentUserId()}::uuid)`;
                }
              } else {
                if (body.fingerprint !== before.snapshot.fingerprint)
                  throw new ConflictException(
                    'Деньги в кассе изменились. Обновите итоги и повторите пересчёт',
                  );
                const closing = closeCashShift(
                  BigInt(before.snapshot.balances.CASH ?? '0'),
                  cashAmount(body.counted),
                  cashAmount(body.retained),
                  note,
                );
                const reconciliationId = await this.reconcile(
                  db,
                  scope,
                  BigInt(closing.expected),
                  BigInt(closing.counted),
                  note,
                );
                const snapshot = {
                  ...closing,
                  reconciliationId,
                  note,
                  snapshot: before.snapshot,
                  totals: before.totals,
                };
                await db.$executeRaw`UPDATE cash_shifts SET closed_at=now(),closed_by_id=${currentUserId()}::uuid,closing=${JSON.stringify(snapshot)}::jsonb WHERE id=${active.id}::uuid`;
                if (BigInt(closing.plannedHandover) > 0n) {
                  if (
                    typeof body.recipientId !== 'string' ||
                    !UUID.test(body.recipientId) ||
                    body.recipientId === currentUserId()
                  )
                    throw new BadRequestException(
                      'Выберите другого сотрудника, который примет деньги',
                    );
                  if (!before.members.some((member) => member.id === body.recipientId))
                    throw new ForbiddenException('Получатель недоступен в этом филиале');
                  await db.$executeRaw`INSERT INTO cash_handovers(id,register_id,shift_id,amount,recipient_id,requested_by_id) VALUES (${randomUUID()}::uuid,${register.id}::uuid,${active.id}::uuid,${BigInt(closing.plannedHandover)},${body.recipientId}::uuid,${currentUserId()}::uuid)`;
                }
              }
            }
            await db.auditLog.create({
              data: {
                entityType: 'CashRegister',
                entityId: register.id,
                action: `cash.shift.${body.action}`,
                after: { shiftId: active?.id ?? null },
                organizationId: scope.organizationId,
                userId: currentUserId(),
              },
            });
            const response = await this.view(db, scope, register);
            const outcome = {
              action: body.action,
              shiftId: response.active?.id ?? active?.id ?? null,
              handoverId: body.handoverId ?? null,
            };
            await db.$executeRaw`INSERT INTO cash_commands(register_id,command_key,fingerprint,response) VALUES (${register.id}::uuid,${body.key}::uuid,${fingerprint},${JSON.stringify(outcome)}::jsonb)`;
            return response;
          }),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034')
        throw new ConflictException(
          'Касса изменилась одновременно с другой операцией. Обновите итоги и повторите',
        );
      if (error instanceof Error && error.constructor === Error)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
  cashiers(body: { userIds?: string[] }): Promise<CashShiftState> {
    return this.prisma.db.$transaction(async (db) =>
      runWithBeautyWriteAuthorization(db, async () => {
        const scope = await this.scope(db);
        await this.writable(db, scope);
        if (!this.manager())
          throw new ForbiddenException('Кассиров назначает владелец или управляющий');
        if (!Array.isArray(body?.userIds) || body.userIds.some((id) => typeof id !== 'string'))
          throw new BadRequestException('Передайте список сотрудников');
        const ids = [...new Set(body.userIds)];
        if (ids.length > 100 || ids.some((id) => !UUID.test(id)))
          throw new BadRequestException('Проверьте список кассиров');
        if (currentVertical() === 'BEAUTY')
          await assertBeautyOperation(db, 'settings', 'update', { legacy: 'settings' });
        const register = await this.register(db, scope);
        const view = await this.view(db, scope, register);
        if (ids.some((id) => !view.members.some((member) => member.id === id)))
          throw new ForbiddenException('В списке есть недоступные сотрудники');
        await db.$executeRaw`UPDATE cash_registers SET cashier_ids=${ids}::uuid[] WHERE id=${register.id}::uuid`;
        await db.auditLog.create({
          data: {
            entityType: 'CashRegister',
            entityId: register.id,
            action: 'cash.cashiers.update',
            after: { userIds: ids },
            organizationId: scope.organizationId,
            userId: currentUserId(),
          },
        });
        return this.view(db, scope, { ...register, cashier_ids: ids });
      }),
    );
  }
}
