import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY, parseCancellationPenalty } from '@pms/domain';
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
          types: {
            select: { accommodationType: { select: { name: true } } },
            orderBy: { accommodationType: { name: 'asc' } },
          },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.upcoming(this.prisma.db, propertyId),
    ]);
    return plans.map(({ id, types, ...plan }) => ({
      ...plan,
      categories: types.map((t) => t.accommodationType.name),
      upcomingReservations: upcoming.get(id) ?? 0,
    }));
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
}
