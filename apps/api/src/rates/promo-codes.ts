import 'reflect-metadata';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY, MAX_DISCOUNT_PERCENT, normalizePromoCode } from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef } from '../database/property-ref';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Промокоды объекта (DATA_MODEL §20, ADR-123, срез D4). Право `rates` — на контроллере. Процент после создания не
 * меняется: скидка пересчитывается в проживаниях брони при продлении и переселении, и молчаливая правка процента
 * поменяла бы цену чужих броней. Код не удаляется, а выключается. Использования — число броней с этой ссылкой.
 */
@Injectable()
export class PromoCodesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private property() {
    return propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
  }

  private view(row: {
    code: string;
    discountPercent: number;
    stayFrom: Date | null;
    stayTo: Date | null;
    maxUses: number | null;
    active: boolean;
    _count: { reservations: number };
  }) {
    return {
      code: row.code,
      discountPercent: row.discountPercent,
      stayFrom: isoOf(row.stayFrom),
      stayTo: isoOf(row.stayTo),
      maxUses: row.maxUses,
      active: row.active,
      uses: row._count.reservations,
    };
  }

  async list() {
    const propertyId = await this.property();
    const rows = await this.prisma.db.promoCode.findMany({
      where: { propertyId },
      include: { _count: { select: { reservations: true } } },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
    return rows.map((r) => this.view(r));
  }

  private optDate(body: Record<string, unknown>, key: string): { has: boolean; value: string | null } {
    if (!(key in body)) return { has: false, value: null };
    const v = body[key];
    if (v === null || v === '') return { has: true, value: null };
    if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v)))
      throw new BadRequestException(`${key}: дата вида 2026-12-31`);
    return { has: true, value: v };
  }

  private optUses(body: Record<string, unknown>): { has: boolean; value: number | null } {
    if (!('maxUses' in body)) return { has: false, value: null };
    const v = body.maxUses;
    if (v === null || v === '') return { has: true, value: null };
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1)
      throw new BadRequestException('maxUses: целое число от 1 или пусто');
    return { has: true, value: v };
  }

  async create(raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const extra = Object.keys(body).find(
      (k) => !['code', 'discountPercent', 'stayFrom', 'stayTo', 'maxUses'].includes(k),
    );
    if (extra) throw new BadRequestException(`Неизвестное поле: ${extra}`);
    const code = typeof body.code === 'string' ? normalizePromoCode(body.code) : null;
    if (!code) throw new BadRequestException('Код: от 3 до 32 знаков — латинские буквы, цифры, «-» и «_»');
    const percent = body.discountPercent;
    if (typeof percent !== 'number' || !Number.isInteger(percent) || percent < 1 || percent > MAX_DISCOUNT_PERCENT)
      throw new BadRequestException(`Скидка — целое число от 1 до ${MAX_DISCOUNT_PERCENT} процентов`);
    const from = this.optDate(body, 'stayFrom').value;
    const to = this.optDate(body, 'stayTo').value;
    if (from && to && from > to) throw new BadRequestException('Период: первая ночь позже последней');
    const maxUses = this.optUses(body).value;
    const propertyId = await this.property();
    if (await this.prisma.db.promoCode.findUnique({ where: { propertyId_code: { propertyId, code } }, select: { id: true } }))
      throw new ConflictException(`Промокод ${code} уже есть`);
    const created = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.promoCode.create({
        data: {
          propertyId,
          code,
          discountPercent: percent,
          stayFrom: from ? asDate(from) : null,
          stayTo: to ? asDate(to) : null,
          maxUses,
        },
        include: { _count: { select: { reservations: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'PromoCode',
          entityId: row.id,
          action: 'promo_code.created',
          after: { code, discountPercent: percent, stayFrom: from, stayTo: to, maxUses },
        },
      });
      return row;
    });
    return this.view(created);
  }

  async update(codeRaw: string, raw: unknown) {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if ('discountPercent' in body)
      throw new BadRequestException('Процент скидки после создания не меняется: заведите новый промокод');
    const extra = Object.keys(body).find((k) => !['active', 'stayFrom', 'stayTo', 'maxUses'].includes(k));
    if (extra) throw new BadRequestException(`Неизвестное поле: ${extra}`);
    const code = normalizePromoCode(codeRaw);
    const propertyId = await this.property();
    const row = code
      ? await this.prisma.db.promoCode.findUnique({
          where: { propertyId_code: { propertyId, code } },
          include: { _count: { select: { reservations: true } } },
        })
      : null;
    if (!row) throw new NotFoundException('Промокод не найден');
    const from = this.optDate(body, 'stayFrom');
    const to = this.optDate(body, 'stayTo');
    const uses = this.optUses(body);
    if ('active' in body && typeof body.active !== 'boolean') throw new BadRequestException('active: да или нет');
    const nextFrom = from.has ? from.value : isoOf(row.stayFrom);
    const nextTo = to.has ? to.value : isoOf(row.stayTo);
    if (nextFrom && nextTo && nextFrom > nextTo) throw new BadRequestException('Период: первая ночь позже последней');
    const nextMax = uses.has ? uses.value : row.maxUses;
    if (nextMax !== null && nextMax < row._count.reservations)
      throw new BadRequestException(`Предел меньше, чем уже использовано (${row._count.reservations})`);
    const active = 'active' in body ? (body.active as boolean) : row.active;
    const updated = await this.prisma.db.$transaction(async (tx) => {
      const next = await tx.promoCode.update({
        where: { id: row.id },
        data: {
          active,
          stayFrom: nextFrom ? asDate(nextFrom) : null,
          stayTo: nextTo ? asDate(nextTo) : null,
          maxUses: nextMax,
        },
        include: { _count: { select: { reservations: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: auditUserId(),
          entityType: 'PromoCode',
          entityId: row.id,
          action: 'promo_code.updated',
          before: { active: row.active, stayFrom: isoOf(row.stayFrom), stayTo: isoOf(row.stayTo), maxUses: row.maxUses },
          after: { active, stayFrom: nextFrom, stayTo: nextTo, maxUses: nextMax },
        },
      });
      return next;
    });
    return this.view(updated);
  }
}
