import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';

export type ChargeKind = 'ACCOMMODATION' | 'SERVICE' | 'PENALTY' | 'ADJUSTMENT';
export type PaymentMethod =
  | 'CASH'
  | 'CARD_TERMINAL'
  | 'BANK_TRANSFER_LEGAL'
  | 'EXTERNAL'
  | 'BANK_TRANSFER_PERSON'
  | 'CARD_GUARANTEE'
  | 'DEPOSIT'
  | 'HALYK'
  | 'KASPI';
/** 9 способов оплаты из справочника Exely (DATA_MODEL §6) */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CASH',
  'CARD_TERMINAL',
  'BANK_TRANSFER_LEGAL',
  'EXTERNAL',
  'BANK_TRANSFER_PERSON',
  'CARD_GUARANTEE',
  'DEPOSIT',
  'HALYK',
  'KASPI',
];
/** Начисления, которые стойка делает вручную; ACCOMMODATION ведёт система по проживанию */
export const MANUAL_CHARGE_KINDS: readonly ChargeKind[] = ['SERVICE', 'PENALTY', 'ADJUSTMENT'];

export interface ChargeRecord {
  id: string;
  folioId: string;
  kind: ChargeKind;
  serviceCode: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: bigint;
  amountMinor: bigint;
  serviceDate: string | null;
  createdAt: string;
  voidedAt: string | null;
}
export interface AllocationRecord {
  paymentId: string;
  amountMinor: bigint;
  payment: {
    method: PaymentMethod;
    status: 'COMPLETED' | 'VOIDED';
    amountMinor: bigint;
    paidAt: string;
    note: string | null;
    externalReference: string | null;
  };
}
export interface RefundRecord {
  id: string;
  paymentId: string;
  amountMinor: bigint;
  reason: string | null;
  createdAt: string;
}
/** Ячейка проживания (первое назначение) — для блокировки соседней ночи при раннем заезде / позднем выезде */
export interface StayUnitRef {
  code: string;
}
export interface FolioRecord {
  id: string;
  reservationItemId: string;
  confirmationNumber: string;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  stay: {
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
  };
  charges: ChargeRecord[];
  allocations: AllocationRecord[];
  refunds: RefundRecord[];
}
export interface ServiceRef {
  id: string;
  code: string;
  nameRu: string;
  nameKz: string | null;
  priceMinor: bigint;
  group: string | null;
}
export interface NewCharge {
  kind: ChargeKind;
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: bigint;
  amountMinor: bigint;
  serviceDate: string;
}
export interface NewPayment {
  method: PaymentMethod;
  amountMinor: bigint;
  currency: string;
  paidAt: string | null;
  note: string | null;
  allocations: Array<{ folioId: string; amountMinor: bigint }>;
}
export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  status: 'COMPLETED' | 'VOIDED';
  amountMinor: bigint;
  currency: string;
  allocations: Array<{ folioId: string; amountMinor: bigint }>;
  refunds: Array<{ folioId: string; amountMinor: bigint }>;
}
export interface NewRefund {
  paymentId: string;
  folioId: string;
  amountMinor: bigint;
  reason: string | null;
}

/** Сводка за период (T4): деньги считаются по датам события — начисление по дате услуги, платёж по дате оплаты. */
export interface PeriodReport {
  chargesByKind: Array<{ kind: ChargeKind; count: number; amountMinor: bigint }>;
  paymentsByMethod: Array<{ method: PaymentMethod; count: number; amountMinor: bigint }>;
  refunds: { count: number; amountMinor: bigint };
  accommodationByCategory: Array<{ category: string; count: number; amountMinor: bigint }>;
}

/** Порт финансов: счета читаются целиком (начисления, распределения, возвраты), команды — точечные записи. */
export interface FinanceRepository {
  /** Ячейка проживания по счёту; null — ячейка не назначена */
  stayUnitCode(reservationItemId: string): Promise<StayUnitRef | null>;
  /** null — брони с таким номером нет */
  foliosByReservation(confirmationNumber: string): Promise<FolioRecord[] | null>;
  folioById(id: string): Promise<FolioRecord | null>;
  services(): Promise<ServiceRef[]>;
  /** Сводка за период [from, to] включительно (T4 «финансовый учёт период») */
  periodReport(from: string, to: string): Promise<PeriodReport>;
  addCharge(folioId: string, c: NewCharge): Promise<string>;
  chargeById(id: string): Promise<ChargeRecord | null>;
  voidCharge(id: string): Promise<void>;
  /** Платёж вместе с распределением — атомарно */
  createPayment(p: NewPayment): Promise<string>;
  paymentById(id: string): Promise<PaymentRecord | null>;
  createRefund(r: NewRefund): Promise<string>;
  /** Закрыть счёт вручную (DATA_MODEL §6, Folio.status): гость рассчитался, начислений больше не будет */
  closeFolio(id: string): Promise<void>;
  audit(
    entityType: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ): Promise<void>;
}
export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
/**
 * Границы суток для событий со временем (платежи, возвраты). Объект живёт в Asia/Almaty (UTC+5),
 * стойка работает круглосуточно: платёж в 02:00 по Алматы — это 21:00 предыдущего дня по UTC,
 * и по UTC-границам он ушёл бы в соседний период.
 */
const ALMATY_OFFSET = '+05:00';
const localStart = (d: string) => new Date(`${d}T00:00:00${ALMATY_OFFSET}`);
const localEndExclusive = (d: string) => {
  const x = new Date(`${d}T00:00:00${ALMATY_OFFSET}`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x;
};
const iso = (x: Date) => x.toISOString().slice(0, 10);
const folioInclude = {
  reservationItem: {
    select: {
      status: true,
      arrivalDate: true,
      departureDate: true,
      accommodationType: { select: { name: true } },
      reservation: { select: { confirmationNumber: true } },
    },
  },
  charges: {
    orderBy: { createdAt: 'asc' as const },
    include: { service: { select: { code: true } } },
  },
  allocations: { orderBy: { payment: { paidAt: 'asc' as const } }, include: { payment: true } },
  refunds: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.FolioInclude;
type FolioRow = Prisma.FolioGetPayload<{ include: typeof folioInclude }>;
type ChargeRow = Prisma.ChargeGetPayload<{ include: { service: { select: { code: true } } } }>;

const toCharge = (c: ChargeRow): ChargeRecord => ({
  id: c.id,
  folioId: c.folioId,
  kind: c.kind,
  serviceCode: c.service?.code ?? null,
  description: c.description,
  quantity: c.quantity,
  unitPriceMinor: c.unitPrice,
  amountMinor: c.amount,
  serviceDate: c.serviceDate ? iso(c.serviceDate) : null,
  createdAt: c.createdAt.toISOString(),
  voidedAt: c.voidedAt?.toISOString() ?? null,
});
const toFolio = (f: FolioRow): FolioRecord => ({
  id: f.id,
  reservationItemId: f.reservationItemId,
  confirmationNumber: f.reservationItem.reservation.confirmationNumber,
  status: f.status,
  currency: f.currency,
  stay: {
    accommodationTypeName: f.reservationItem.accommodationType.name,
    arrivalDate: iso(f.reservationItem.arrivalDate),
    departureDate: iso(f.reservationItem.departureDate),
    status: f.reservationItem.status,
  },
  charges: f.charges.map(toCharge),
  allocations: f.allocations.map((a) => ({
    paymentId: a.paymentId,
    amountMinor: a.amount,
    payment: {
      method: a.payment.method,
      status: a.payment.status,
      amountMinor: a.payment.amount,
      paidAt: a.payment.paidAt.toISOString(),
      note: a.payment.note,
      externalReference: a.payment.externalReference,
    },
  })),
  refunds: f.refunds.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    amountMinor: r.amount,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  })),
});

@Injectable()
export class PrismaFinanceRepository implements FinanceRepository {
  private readonly propertyName = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private property() {
    return this.prisma.db.property.findFirstOrThrow({
      where: { name: this.propertyName },
      select: { id: true },
    });
  }
  async foliosByReservation(confirmationNumber: string): Promise<FolioRecord[] | null> {
    const { id: propertyId } = await this.property();
    const r = await this.prisma.db.reservation.findUnique({
      where: { propertyId_confirmationNumber: { propertyId, confirmationNumber } },
      select: {
        items: { orderBy: { createdAt: 'asc' }, select: { folio: { include: folioInclude } } },
      },
    });
    if (!r) return null;
    return r.items.flatMap((i) => (i.folio ? [toFolio(i.folio)] : []));
  }
  async stayUnitCode(reservationItemId: string): Promise<StayUnitRef | null> {
    const a = await this.prisma.db.allocation.findFirst({
      where: { reservationItemId },
      orderBy: { startDate: 'asc' },
      select: { inventoryUnit: { select: { code: true } } },
    });
    return a ? { code: a.inventoryUnit.code } : null;
  }
  async folioById(id: string): Promise<FolioRecord | null> {
    const f = await this.prisma.db.folio.findUnique({ where: { id }, include: folioInclude });
    return f ? toFolio(f) : null;
  }
  async services(): Promise<ServiceRef[]> {
    const { id: propertyId } = await this.property();
    const rows = await this.prisma.db.service.findMany({
      where: { propertyId, active: true },
      orderBy: [{ group: 'asc' }, { nameRu: 'asc' }],
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      nameRu: s.nameRu,
      nameKz: s.nameKz,
      priceMinor: s.price,
      group: s.group,
    }));
  }
  async periodReport(from: string, to: string): Promise<PeriodReport> {
    const { id: propertyId } = await this.property();
    const dateRange = { gte: asDate(from), lte: asDate(to) };
    const charges = await this.prisma.db.charge.findMany({
      where: {
        voidedAt: null,
        serviceDate: dateRange,
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: {
        kind: true,
        amount: true,
        folio: {
          select: {
            reservationItem: { select: { accommodationType: { select: { name: true } } } },
          },
        },
      },
    });
    const byKind = new Map<ChargeKind, { count: number; amountMinor: bigint }>();
    const byCategory = new Map<string, { count: number; amountMinor: bigint }>();
    for (const c of charges) {
      const k = byKind.get(c.kind) ?? { count: 0, amountMinor: 0n };
      byKind.set(c.kind, { count: k.count + 1, amountMinor: k.amountMinor + c.amount });
      if (c.kind === 'ACCOMMODATION') {
        const name = c.folio.reservationItem.accommodationType.name;
        const v = byCategory.get(name) ?? { count: 0, amountMinor: 0n };
        byCategory.set(name, { count: v.count + 1, amountMinor: v.amountMinor + c.amount });
      }
    }
    const payments = await this.prisma.db.payment.findMany({
      where: {
        propertyId,
        status: 'COMPLETED',
        paidAt: { gte: localStart(from), lt: localEndExclusive(to) },
      },
      select: { method: true, amount: true },
    });
    const byMethod = new Map<PaymentMethod, { count: number; amountMinor: bigint }>();
    for (const p of payments) {
      const v = byMethod.get(p.method) ?? { count: 0, amountMinor: 0n };
      byMethod.set(p.method, { count: v.count + 1, amountMinor: v.amountMinor + p.amount });
    }
    const refunds = await this.prisma.db.refund.findMany({
      where: {
        createdAt: { gte: localStart(from), lt: localEndExclusive(to) },
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: { amount: true },
    });
    return {
      chargesByKind: [...byKind].map(([kind, v]) => ({ kind, ...v })),
      paymentsByMethod: [...byMethod].map(([method, v]) => ({ method, ...v })),
      refunds: {
        count: refunds.length,
        amountMinor: refunds.reduce((s, r) => s + r.amount, 0n),
      },
      accommodationByCategory: [...byCategory].map(([category, v]) => ({ category, ...v })),
    };
  }
  async addCharge(folioId: string, c: NewCharge): Promise<string> {
    const row = await this.prisma.db.charge.create({
      data: {
        folioId,
        kind: c.kind,
        serviceId: c.serviceId,
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPriceMinor,
        amount: c.amountMinor,
        serviceDate: asDate(c.serviceDate),
      },
      select: { id: true },
    });
    return row.id;
  }
  async chargeById(id: string): Promise<ChargeRecord | null> {
    const c = await this.prisma.db.charge.findUnique({
      where: { id },
      include: { service: { select: { code: true } } },
    });
    return c ? toCharge(c) : null;
  }
  async voidCharge(id: string): Promise<void> {
    await this.prisma.db.charge.update({ where: { id }, data: { voidedAt: new Date() } });
  }
  async createPayment(p: NewPayment): Promise<string> {
    const { id: propertyId } = await this.property();
    const row = await this.prisma.db.payment.create({
      data: {
        propertyId,
        method: p.method,
        amount: p.amountMinor,
        currency: p.currency,
        note: p.note,
        ...(p.paidAt ? { paidAt: new Date(p.paidAt) } : {}),
        allocations: {
          create: p.allocations.map((a) => ({ folioId: a.folioId, amount: a.amountMinor })),
        },
      },
      select: { id: true },
    });
    return row.id;
  }
  async paymentById(id: string): Promise<PaymentRecord | null> {
    const p = await this.prisma.db.payment.findUnique({
      where: { id },
      include: { allocations: true, refunds: true },
    });
    return p
      ? {
          id: p.id,
          method: p.method,
          status: p.status,
          amountMinor: p.amount,
          currency: p.currency,
          allocations: p.allocations.map((a) => ({ folioId: a.folioId, amountMinor: a.amount })),
          refunds: p.refunds.map((r) => ({ folioId: r.folioId, amountMinor: r.amount })),
        }
      : null;
  }
  async createRefund(r: NewRefund): Promise<string> {
    const row = await this.prisma.db.refund.create({
      data: {
        paymentId: r.paymentId,
        folioId: r.folioId,
        amount: r.amountMinor,
        reason: r.reason,
      },
      select: { id: true },
    });
    return row.id;
  }
  async closeFolio(id: string): Promise<void> {
    await this.prisma.db.folio.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
  async audit(
    entityType: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    const j = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
    await this.prisma.db.auditLog.create({
      data: { entityType, entityId, action, before: j(before), after: j(after) },
    });
  }
}
