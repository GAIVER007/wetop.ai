import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type Db } from '@pms/database';
import {
  LUXX_APARTS_PROPERTY,
  parseCancellationPenalty,
  validateDerivedRule,
  type DerivedRule,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyToday } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';

const PENALTY_MESSAGE = 'Правило отмены: без штрафа, первая ночь или всё проживание';

/**
 * «Тарифные планы» (SET4, `plans/property-settings-set4-2026-09-29.md`; дополнение 29.09 к ADR-115). Правило отмены —
 * свойство тарифа; штраф берётся из тарифа в момент отмены или незаезда (Q-103), поэтому правка правила действует и
 * для уже принятых броней — так решил владелец 29.09. Список показывает, сколько броней правка заденет: разные брони
 * по тарифу, ещё не заехавшие и не отменённые, с выездом сегодня или позже по часам объекта — по ним ещё возможны
 * отмена или незаезд. Право `rates` (владелец и управляющий) — на контроллере.
 */
@Injectable()
export class RatePlansService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private property() {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  /** Брони, которые правило ещё может задеть, по тарифам объекта */
  private async upcoming(db: Db, propertyId: string): Promise<Map<string, number>> {
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const rows = await db.$queryRaw<Array<{ id: string; upcoming: number }>>(Prisma.sql`
      SELECT i."rate_plan_id"::text AS "id", COUNT(DISTINCT i."reservation_id")::int AS "upcoming"
      FROM "reservation_items" i
      JOIN "reservations" r ON r."id" = i."reservation_id"
      WHERE r."property_id" = ${propertyId}::uuid
        AND i."rate_plan_id" IS NOT NULL
        AND i."status" IN ('TENTATIVE', 'CONFIRMED')
        AND i."departure_date" >= ${today}::date
      GROUP BY i."rate_plan_id"`);
    return new Map(rows.map((r) => [r.id, r.upcoming]));
  }

  async list() {
    const propertyId = await this.property();
    const [plans, upcoming] = await Promise.all([
      this.prisma.db.ratePlan.findMany({
        where: { propertyId },
        select: {
          id: true,
          code: true,
          name: true,
          currency: true,
          active: true,
          cancellationPenalty: true,
          parentRatePlanId: true,
          discountPercent: true,
          minDaysBeforeArrival: true,
          maxDaysBeforeArrival: true,
          minNights: true,
          parent: { select: { name: true } },
          types: {
            select: { accommodationType: { select: { name: true } } },
            orderBy: { accommodationType: { name: 'asc' } },
          },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.upcoming(this.prisma.db, propertyId),
    ]);
    return plans.map(
      ({
        id,
        types,
        parentRatePlanId,
        discountPercent,
        minDaysBeforeArrival,
        maxDaysBeforeArrival,
        minNights,
        parent,
        ...plan
      }) => ({
        ...plan,
        categories: types.map((t) => t.accommodationType.name),
        upcomingReservations: upcoming.get(id) ?? 0,
        // производный тариф (DATA_MODEL §20): родитель и правило; у обычного — null
        derived:
          parentRatePlanId != null && discountPercent != null
            ? {
                parentName: parent?.name ?? '',
                discountPercent,
                minDaysBeforeArrival: minDaysBeforeArrival ?? null,
                maxDaysBeforeArrival: maxDaysBeforeArrival ?? null,
                minNights: minNights ?? null,
              }
            : null,
      }),
    );
  }

  async updatePenalty(code: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const extra = Object.keys(body).find((k) => k !== 'cancellationPenalty');
    if (extra) throw new BadRequestException(`Неизвестное поле: ${extra}`);
    const next = parseCancellationPenalty(body.cancellationPenalty);
    if (!next) throw new BadRequestException(PENALTY_MESSAGE);
    const propertyId = await this.property();
    const plan = await this.prisma.db.ratePlan.findFirst({
      where: { propertyId, code },
      select: { id: true, cancellationPenalty: true },
    });
    if (!plan) throw new NotFoundException('Тариф не найден');
    const was = plan.cancellationPenalty;
    if (was !== next) {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.ratePlan.update({
          where: { id: plan.id },
          data: { cancellationPenalty: next },
        });
        const affected = (await this.upcoming(tx as unknown as Db, propertyId)).get(plan.id) ?? 0;
        await tx.auditLog.create({
          data: {
            userId: auditUserId(),
            entityType: 'RatePlan',
            entityId: plan.id,
            action: 'rate_plan.cancellation_penalty.updated',
            before: { cancellationPenalty: was },
            after: { cancellationPenalty: next, upcomingReservations: affected },
          },
        });
      });
    }
    const saved = (await this.list()).find((p) => p.code === code);
    if (!saved) throw new NotFoundException('Тариф не найден');
    return saved;
  }

  /** Правило производного тарифа из тела запроса; ошибка — словами (`BadRequestException`) */
  private parseRule(body: Record<string, unknown>, current?: DerivedRule): DerivedRule {
    const int = (key: string, fallback: number | null): number | null => {
      if (!(key in body)) return fallback;
      const v = body[key];
      if (v === null || v === '') return null;
      return typeof v === 'number' ? v : Number.NaN;
    };
    const rule: DerivedRule = {
      discountPercent: (int('discountPercent', current?.discountPercent ?? null) ??
        Number.NaN) as number,
      minDaysBeforeArrival: int('minDaysBeforeArrival', current?.minDaysBeforeArrival ?? null),
      maxDaysBeforeArrival: int('maxDaysBeforeArrival', current?.maxDaysBeforeArrival ?? null),
      minNights: int('minNights', current?.minNights ?? null),
    };
    const problem = validateDerivedRule(rule);
    if (problem) throw new BadRequestException(problem);
    return rule;
  }

  /** Новый производный тариф: код даёт система, валюта и штраф при отмене — от родителя (DATA_MODEL §20) */
  async createDerived(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const allowed = [
      'name',
      'parentCode',
      'discountPercent',
      'minDaysBeforeArrival',
      'maxDaysBeforeArrival',
      'minNights',
    ];
    const extra = Object.keys(body).find((k) => !allowed.includes(k));
    if (extra) throw new BadRequestException(`Неизвестное поле: ${extra}`);
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 120)
      throw new BadRequestException('Название тарифа: от 1 до 120 знаков');
    const rule = this.parseRule(body);
    const propertyId = await this.property();
    const parentCode = typeof body.parentCode === 'string' ? body.parentCode : '';
    const parent = await this.prisma.db.ratePlan.findFirst({
      where: { propertyId, code: parentCode },
      select: {
        id: true,
        currency: true,
        cancellationPenalty: true,
        parentRatePlanId: true,
        active: true,
      },
    });
    if (!parent) throw new NotFoundException('Родительский тариф не найден');
    if (parent.parentRatePlanId)
      throw new BadRequestException('Родитель не может сам быть производным тарифом');
    const code = `rate-${randomUUID().slice(0, 8)}`;
    await this.prisma.db.$transaction(async (tx) => {
      const plan = await tx.ratePlan.create({
        data: {
          propertyId,
          code,
          name,
          currency: parent.currency,
          cancellationPenalty: parent.cancellationPenalty,
          parentRatePlanId: parent.id,
          discountPercent: rule.discountPercent,
          minDaysBeforeArrival: rule.minDaysBeforeArrival,
          maxDaysBeforeArrival: rule.maxDaysBeforeArrival,
          minNights: rule.minNights,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'RatePlan',
          entityId: plan.id,
          action: 'rate_plan.derived.created',
          after: { name, parentCode, ...rule },
        },
      });
    });
    const saved = (await this.list()).find((p) => p.code === code);
    if (!saved) throw new NotFoundException('Тариф не найден');
    return saved;
  }

  /** Правка производного: название, процент, окно продаж, минимум ночей, действует ли. Родитель не меняется */
  async updateDerived(code: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const allowed = [
      'name',
      'discountPercent',
      'minDaysBeforeArrival',
      'maxDaysBeforeArrival',
      'minNights',
      'active',
    ];
    const extra = Object.keys(body).find((k) => !allowed.includes(k));
    if (extra) throw new BadRequestException(`Неизвестное поле: ${extra}`);
    const propertyId = await this.property();
    const plan = await this.prisma.db.ratePlan.findFirst({
      where: { propertyId, code },
      select: {
        id: true,
        name: true,
        active: true,
        parentRatePlanId: true,
        discountPercent: true,
        minDaysBeforeArrival: true,
        maxDaysBeforeArrival: true,
        minNights: true,
      },
    });
    if (!plan) throw new NotFoundException('Тариф не найден');
    if (!plan.parentRatePlanId || plan.discountPercent === null)
      throw new BadRequestException('Это не производный тариф: правило скидки у него не задаётся');
    const current: DerivedRule = {
      discountPercent: plan.discountPercent,
      minDaysBeforeArrival: plan.minDaysBeforeArrival,
      maxDaysBeforeArrival: plan.maxDaysBeforeArrival,
      minNights: plan.minNights,
    };
    const rule = this.parseRule(body, current);
    let name = plan.name;
    if ('name' in body) {
      name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
      if (!name || name.length > 120)
        throw new BadRequestException('Название тарифа: от 1 до 120 знаков');
    }
    let active = plan.active;
    if ('active' in body) {
      if (typeof body.active !== 'boolean') throw new BadRequestException('active: да или нет');
      active = body.active;
    }
    await this.prisma.db.$transaction(async (tx) => {
      if (plan.active && !active) {
        // Тот же порядок и ключи, что у ручной продажи группы: проверка связей не обгоняет создание брони.
        const types = await tx.accommodationType.findMany({
          where: { propertyId },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        for (const type of types) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.category:${type.id}`}, 0))`;
        }
        const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
        const [bookings, mappings] = await Promise.all([
          tx.reservationItem.count({
            where: {
              ratePlanId: plan.id,
              reservation: { propertyId },
              status: { in: ['TENTATIVE', 'CONFIRMED', 'CHECKED_IN'] },
              departureDate: { gte: new Date(today + 'T00:00:00Z') },
            },
          }),
          tx.channelMapping.count({ where: { propertyId, localRatePlanId: plan.id } }),
        ]);
        if (bookings || mappings)
          throw new ConflictException(
            `Нельзя отключить тариф: действующих броней ${bookings}, сопоставлений каналов ${mappings}. Сначала разберите эти связи.`,
          );
      }
      await tx.ratePlan.update({
        where: { id: plan.id },
        data: { name, active, ...rule },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'RatePlan',
          entityId: plan.id,
          action: 'rate_plan.derived.updated',
          before: { name: plan.name, active: plan.active, ...current },
          after: { name, active, ...rule },
        },
      });
    });
    const saved = (await this.list()).find((p) => p.code === code);
    if (!saved) throw new NotFoundException('Тариф не найден');
    return saved;
  }
}
