import 'reflect-metadata';
import { assertBranchMethodsOpen } from '../food-service/branch-payment-methods';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
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
  accrualReversal,
  bonusAccrual,
  bonusBalance,
  certificateExpiry,
  certificateRedeem,
  certificateStatus,
  generateCertificateCode,
  isLoyaltyMethod,
  maxRedeem,
  normalizeCertificateCode,
  parseBonusAdjustment,
  parseBonusProgram,
  parseCertificateSale,
  type CertificateStatus,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import { Access } from '../auth/access.decorator';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { BeautyAccess } from './access.decorator';
import { beautyScope, beautyTransaction, mayBeauty, mayBeautyWrite, UUID, type BeautyScope } from './scope';

/**
 * Бонусы и подарочные сертификаты салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §2-3, миграция 141).
 * Движения пишутся в той же транзакции, что операция кассы записи (оплата, возврат, аннулирование).
 */

export interface BonusProgramView {
  businessId: string;
  configured: boolean;
  revision: number;
  enabled: boolean;
  accrualPercent: number;
  maxRedeemPercent: number;
  expiresDays: number | null;
}

const DEFAULT_PROGRAM = { enabled: false, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null as number | null, revision: 0 };

export async function bonusProgramOf(db: Pick<DbTx, 'bonusProgram'>, businessId: string) {
  return (await db.bonusProgram.findUnique({ where: { businessId } })) ?? DEFAULT_PROGRAM;
}

/** Движения клиента по бизнесу и валюте филиала; баланс считает домен */
async function customerBalance(db: Pick<DbTx, 'customerBonusEntry'>, businessId: string, customerId: string, currency: string, now = new Date()) {
  const entries = await db.customerBonusEntry.findMany({
    where: { businessId, customerId, currency },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { amountMinor: true, createdAt: true, expiresAt: true },
  });
  return bonusBalance(entries, now);
}

/** Очередь движений бонусов одного клиента: две оплаты бонусами не тратят один баланс дважды */
async function lockCustomerBonuses(tx: DbTx, businessId: string, customerId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`bonus:${businessId}:${customerId}`}, 0))::text`;
}

type CashOp = { id: string; kind: 'INCOME' | 'EXPENSE' | 'TRANSFER'; method: string; amount: bigint; currency: string; appointmentId: string | null };
type LoyaltyScope = Pick<BeautyScope, 'organizationId' | 'businessId'>;

/**
 * Оплата записи бонусами или сертификатом: проверка и списание до создания операции кассы.
 * Возвращает сумму, которую можно провести (у сертификата частично: остаток сертификата).
 */
export async function prepareLoyaltyPayment(
  tx: DbTx,
  scope: LoyaltyScope,
  input: { method: string; amount: bigint; certificateCode: string | null },
  appointment: { id: string; customerId: string; price: bigint; currency: string },
  now = new Date(),
): Promise<{ amount: bigint; certificateId: string | null }> {
  if (input.method === 'BONUS') {
    const program = await bonusProgramOf(tx, scope.businessId);
    if (!program.enabled) throw new ConflictException('Бонусная программа выключена');
    await lockCustomerBonuses(tx, scope.businessId, appointment.customerId);
    const balance = await customerBalance(tx, scope.businessId, appointment.customerId, appointment.currency, now);
    const paidByBonus = await netByMethod(tx, appointment.id, 'BONUS');
    const cap = maxRedeem(appointment.price, balance, program.maxRedeemPercent);
    const checkCap = (appointment.price * BigInt(program.maxRedeemPercent)) / 100n - paidByBonus;
    const allowed = cap < checkCap ? cap : checkCap;
    if (input.amount > (allowed > 0n ? allowed : 0n))
      throw new ConflictException(`Бонусами можно оплатить не больше ${allowed > 0n ? allowed : 0n}`);
    return { amount: input.amount, certificateId: null };
  }
  if (input.method === 'GIFT_CERTIFICATE') {
    const rows = await tx.$queryRaw<Array<{ id: string; status: CertificateStatus; balance: bigint; expiresAt: Date; currency: string }>>`
      SELECT id::text, status::text AS status, balance_minor AS balance, expires_at AS "expiresAt", currency
      FROM gift_certificates WHERE business_id = ${scope.businessId}::uuid AND code = ${input.certificateCode ?? ''} FOR UPDATE`;
    const cert = rows[0];
    if (!cert) throw new NotFoundException('Сертификат не найден');
    const result = certificateRedeem(
      { businessId: scope.businessId, status: cert.status, balanceMinor: cert.balance, expiresAt: cert.expiresAt, currency: cert.currency.trim() },
      { businessId: scope.businessId, now, amountMinor: input.amount, currency: appointment.currency },
    );
    if (!result.ok) throw new ConflictException(result.reason);
    return { amount: result.redeemMinor, certificateId: cert.id };
  }
  return { amount: input.amount, certificateId: null };
}

/** После операции кассы оплаты: списание бонусов, погашение сертификата или начисление с живых денег */
export async function recordLoyaltyPayment(
  tx: DbTx,
  scope: LoyaltyScope,
  op: CashOp,
  appointment: { id: string; customerId: string },
  certificateId: string | null,
  now = new Date(),
): Promise<{ accruedMinor: bigint }> {
  const base = {
    organizationId: scope.organizationId,
    businessId: scope.businessId,
    customerId: appointment.customerId,
    currency: op.currency,
    appointmentId: appointment.id,
    paymentId: op.id,
    createdById: currentUserId(),
  };
  if (op.method === 'BONUS') {
    await tx.customerBonusEntry.create({ data: { ...base, kind: 'REDEEM', amountMinor: -op.amount } });
    return { accruedMinor: 0n };
  }
  if (op.method === 'GIFT_CERTIFICATE') {
    const cert = await tx.giftCertificate.update({
      where: { id: certificateId! },
      data: { balanceMinor: { decrement: op.amount } },
      select: { balanceMinor: true },
    });
    if (cert.balanceMinor === 0n) await tx.giftCertificate.update({ where: { id: certificateId! }, data: { status: 'USED' } });
    await tx.giftCertificateEntry.create({
      data: {
        organizationId: scope.organizationId, certificateId: certificateId!, kind: 'REDEEM', amountMinor: -op.amount,
        appointmentId: appointment.id, paymentId: op.id, createdById: currentUserId(),
      },
    });
    return { accruedMinor: 0n };
  }
  const program = await bonusProgramOf(tx, scope.businessId);
  if (!program.enabled) return { accruedMinor: 0n };
  const accrued = bonusAccrual(op.amount, program.accrualPercent);
  if (accrued <= 0n) return { accruedMinor: 0n };
  await tx.customerBonusEntry.create({
    data: {
      ...base,
      kind: 'ACCRUAL',
      amountMinor: accrued,
      expiresAt: program.expiresDays ? new Date(now.getTime() + program.expiresDays * 86_400_000) : null,
    },
  });
  return { accruedMinor: accrued };
}

/** Чистая сумма записи по способу: приходы минус возвраты, аннулированное не считается */
export async function netByMethod(tx: Pick<DbTx, 'restaurantCashOperation'>, appointmentId: string, method: 'BONUS' | 'GIFT_CERTIFICATE' | 'MONEY') {
  const rows = await tx.restaurantCashOperation.groupBy({
    by: ['kind', 'method'],
    where: { appointmentId, status: 'COMPLETED' },
    _sum: { amount: true },
  });
  return rows
    .filter((r) => (method === 'MONEY' ? !isLoyaltyMethod(r.method) : r.method === method))
    .reduce((net, r) => (r.kind === 'INCOME' ? net + (r._sum.amount ?? 0n) : net - (r._sum.amount ?? 0n)), 0n);
}

/**
 * Возврат по записи (§54): возврат бонусами возвращает бонусы, сертификатом возвращает остаток сертификата
 * (последнему погашенному по этой записи), живыми деньгами снимает начисленное пропорционально.
 * `checkLoyaltyRefund` до создания операции возврата, `recordLoyaltyRefund` после.
 */
export async function checkLoyaltyRefund(tx: DbTx, appointmentId: string, method: string, amount: bigint) {
  if (!isLoyaltyMethod(method)) return;
  const net = await netByMethod(tx, appointmentId, method);
  if (amount > net) throw new ConflictException(method === 'BONUS' ? 'Бонусами по записи оплачено меньше' : 'Сертификатом по записи оплачено меньше');
}

export async function recordLoyaltyRefund(
  tx: DbTx,
  scope: LoyaltyScope,
  op: CashOp,
  appointment: { id: string; customerId: string },
  moneyPaidBefore: bigint,
) {
  if (op.method === 'BONUS') {
    await tx.customerBonusEntry.create({
      data: {
        organizationId: scope.organizationId, businessId: scope.businessId, customerId: appointment.customerId,
        kind: 'REVERSAL', amountMinor: op.amount, currency: op.currency, appointmentId: appointment.id, paymentId: op.id,
        reason: 'Возврат оплаты бонусами', createdById: currentUserId(),
      },
    });
    return;
  }
  if (op.method === 'GIFT_CERTIFICATE') {
    await returnToCertificate(tx, scope, appointment.id, op, op.amount);
    return;
  }
  await reverseAccrual(tx, scope, appointment, op, op.amount, moneyPaidBefore);
}

async function returnToCertificate(tx: DbTx, scope: LoyaltyScope, appointmentId: string, op: CashOp, amount: bigint) {
  const redeemed = await tx.giftCertificateEntry.findMany({
    where: { appointmentId, kind: { in: ['REDEEM', 'REVERSAL'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { certificateId: true, kind: true, amountMinor: true },
  });
  const byCert = new Map<string, bigint>();
  for (const e of redeemed) byCert.set(e.certificateId, (byCert.get(e.certificateId) ?? 0n) - e.amountMinor);
  const target = redeemed.find((e) => e.kind === 'REDEEM' && (byCert.get(e.certificateId) ?? 0n) >= amount);
  if (!target) throw new ConflictException('Нет погашения сертификата на эту сумму');
  await tx.$queryRaw`SELECT id FROM gift_certificates WHERE id = ${target.certificateId}::uuid FOR UPDATE`;
  const cert = await tx.giftCertificate.findUniqueOrThrow({ where: { id: target.certificateId }, select: { status: true } });
  await tx.giftCertificate.update({
    where: { id: target.certificateId },
    data: { balanceMinor: { increment: amount }, ...(cert.status === 'USED' ? { status: 'ACTIVE' as const } : {}) },
  });
  await tx.giftCertificateEntry.create({
    data: {
      organizationId: scope.organizationId, certificateId: target.certificateId, kind: 'REVERSAL', amountMinor: amount,
      appointmentId, paymentId: op.id, createdById: currentUserId(),
    },
  });
}

async function reverseAccrual(
  tx: DbTx,
  scope: LoyaltyScope,
  appointment: { id: string; customerId: string },
  op: CashOp,
  amount: bigint,
  moneyPaidBefore: bigint,
) {
  const entries = await tx.customerBonusEntry.findMany({
    where: { appointmentId: appointment.id, kind: { in: ['ACCRUAL', 'REVERSAL'] }, payment: { method: { notIn: ['BONUS', 'GIFT_CERTIFICATE'] } } },
    select: { kind: true, amountMinor: true },
  });
  const accrued = entries.filter((e) => e.kind === 'ACCRUAL').reduce((s, e) => s + e.amountMinor, 0n);
  const reversed = entries.filter((e) => e.kind === 'REVERSAL').reduce((s, e) => s - e.amountMinor, 0n);
  const take = accrualReversal(amount, moneyPaidBefore, accrued, reversed);
  if (take <= 0n) return;
  await lockCustomerBonuses(tx, scope.businessId, appointment.customerId);
  await tx.customerBonusEntry.create({
    data: {
      organizationId: scope.organizationId, businessId: scope.businessId, customerId: appointment.customerId,
      kind: 'REVERSAL', amountMinor: -take, currency: op.currency, appointmentId: appointment.id, paymentId: op.id,
      reason: 'Возврат оплаты: начисленные бонусы сняты', createdById: currentUserId(),
    },
  });
}

/** Аннулирование операции кассы записи (до «Выполнено»): движения бонусов и сертификата возвращаются целиком */
export async function reverseLoyaltyForVoid(tx: DbTx, op: CashOp & { locationId: string }) {
  if (!op.appointmentId) return;
  const owner = await tx.location.findUniqueOrThrow({
    where: { id: op.locationId },
    select: { businessId: true, business: { select: { organizationId: true, vertical: true } } },
  });
  if (owner.business.vertical !== 'BEAUTY') return;
  const scope = { organizationId: owner.business.organizationId, businessId: owner.businessId };
  const appointment = await tx.appointment.findUniqueOrThrow({ where: { id: op.appointmentId }, select: { id: true, customerId: true } });
  if (op.method === 'GIFT_CERTIFICATE') {
    const entry = await tx.giftCertificateEntry.findFirst({ where: { paymentId: op.id }, select: { certificateId: true, amountMinor: true } });
    if (!entry) return;
    await tx.$queryRaw`SELECT id FROM gift_certificates WHERE id = ${entry.certificateId}::uuid FOR UPDATE`;
    const back = -entry.amountMinor; // погашение было минусом, возврат плюсом
    const cert = await tx.giftCertificate.findUniqueOrThrow({ where: { id: entry.certificateId }, select: { balanceMinor: true, initialMinor: true, status: true } });
    const balance = cert.balanceMinor + back;
    if (balance < 0n || balance > cert.initialMinor) throw new ConflictException('Остаток сертификата уже изменился, аннулировать нельзя');
    await tx.giftCertificate.update({
      where: { id: entry.certificateId },
      data: { balanceMinor: balance, status: balance === 0n ? 'USED' : cert.status === 'USED' ? 'ACTIVE' : cert.status },
    });
    // журнал только дописывается: аннулированное погашение гасится возвратом, аннулированный возврат погашением
    await tx.giftCertificateEntry.create({
      data: {
        organizationId: scope.organizationId, certificateId: entry.certificateId, kind: entry.amountMinor < 0n ? 'REVERSAL' : 'REDEEM',
        amountMinor: back, appointmentId: appointment.id, paymentId: op.id, createdById: currentUserId(),
      },
    });
    return;
  }
  const entries = await tx.customerBonusEntry.findMany({ where: { paymentId: op.id }, select: { kind: true, amountMinor: true, currency: true } });
  const net = entries.reduce((s, e) => s + e.amountMinor, 0n);
  if (net === 0n) return;
  await lockCustomerBonuses(tx, scope.businessId, appointment.customerId);
  await tx.customerBonusEntry.create({
    data: {
      organizationId: scope.organizationId, businessId: scope.businessId, customerId: appointment.customerId,
      kind: 'ADJUSTMENT', amountMinor: -net, currency: entries[0]!.currency, appointmentId: appointment.id,
      reason: 'Операция кассы аннулирована', createdById: currentUserId(),
    },
  });
}

// ───────────── API ─────────────

const certificateView = (row: {
  id: string; code: string; initialMinor: bigint; balanceMinor: bigint; currency: string; expiresAt: Date; status: CertificateStatus;
  createdAt: Date; buyer?: { id: string; firstName: string; lastName: string | null } | null;
}, now = new Date()) => ({
  id: row.id,
  code: row.code,
  initialMinor: row.initialMinor.toString(),
  balanceMinor: row.balanceMinor.toString(),
  currency: row.currency.trim(),
  expiresAt: row.expiresAt.toISOString(),
  status: certificateStatus(row, now),
  createdAt: row.createdAt.toISOString(),
  buyer: row.buyer ? { id: row.buyer.id, name: [row.buyer.firstName, row.buyer.lastName].filter(Boolean).join(' ') } : null,
});

@Injectable()
export class BeautyLoyaltyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async program(): Promise<BonusProgramView> {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma);
    const row = await this.prisma.db.bonusProgram.findUnique({ where: { businessId: scope.businessId } });
    const p = row ?? DEFAULT_PROGRAM;
    return {
      businessId: scope.businessId, configured: row !== null, revision: p.revision, enabled: p.enabled,
      accrualPercent: p.accrualPercent, maxRedeemPercent: p.maxRedeemPercent, expiresDays: p.expiresDays,
    };
  }

  async saveProgram(raw: unknown): Promise<BonusProgramView> {
    await mayBeautyWrite(this.prisma, 'property');
    const parsed = parseBonusProgram(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    const scope = await beautyScope(this.prisma);
    await withServiceDatabase(() => beautyTransaction(this.prisma, scope, async (tx) => {
      const old = await tx.bonusProgram.findUnique({ where: { businessId: scope.businessId } });
      if ((old?.revision ?? 0) !== input.expectedRevision) throw new ConflictException('Настройки бонусов изменены. Обновите страницу.');
      const data = { enabled: input.enabled, accrualPercent: input.accrualPercent, maxRedeemPercent: input.maxRedeemPercent, expiresDays: input.expiresDays };
      if (old) {
        const saved = await tx.bonusProgram.updateMany({ where: { businessId: scope.businessId, revision: input.expectedRevision }, data: { ...data, revision: { increment: 1 } } });
        if (saved.count !== 1) throw new ConflictException('Настройки бонусов изменены. Обновите страницу.');
      } else await tx.bonusProgram.create({ data: { businessId: scope.businessId, ...data, revision: 1 } });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId, userId: currentUserId(), entityType: 'business', entityId: scope.businessId,
          action: 'beauty.bonus_program.updated',
          before: old ? { ...data, enabled: old.enabled, accrualPercent: old.accrualPercent, maxRedeemPercent: old.maxRedeemPercent, expiresDays: old.expiresDays, revision: old.revision } : { revision: 0 },
          after: { ...data, revision: input.expectedRevision + 1 },
        },
      });
    }));
    return this.program();
  }

  /** Баланс и история бонусов клиента в валюте филиала; сколько можно списать в чек считает экран оплаты */
  async customerBonuses(customerId: string) {
    mayBeauty('desk');
    if (!UUID.test(customerId)) throw new NotFoundException('Клиент не найден');
    const scope = await beautyScope(this.prisma);
    const visible = await this.prisma.db.customer.findFirst({
      where: { id: customerId, organizationId: scope.organizationId, businesses: { some: { businessId: scope.businessId } } },
      select: { id: true },
    });
    if (!visible) throw new NotFoundException('Клиент не найден');
    const currency = scope.locationCurrency ?? (await this.prisma.db.location.findFirst({ where: { businessId: scope.businessId }, select: { currency: true } }))?.currency ?? 'KZT';
    const program = await bonusProgramOf(this.prisma.db, scope.businessId);
    const entries = await this.prisma.db.customerBonusEntry.findMany({
      where: { businessId: scope.businessId, customerId, currency },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
      select: {
        id: true, kind: true, amountMinor: true, currency: true, expiresAt: true, appointmentId: true, reason: true, createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    });
    return {
      customerId,
      currency,
      program: { enabled: program.enabled, accrualPercent: program.accrualPercent, maxRedeemPercent: program.maxRedeemPercent, expiresDays: program.expiresDays },
      balanceMinor: (await customerBalance(this.prisma.db, scope.businessId, customerId, currency)).toString(),
      entries: entries.map((e) => ({
        id: e.id, kind: e.kind, amountMinor: e.amountMinor.toString(), currency: e.currency.trim(),
        expiresAt: e.expiresAt?.toISOString() ?? null, appointmentId: e.appointmentId, reason: e.reason,
        createdAt: e.createdAt.toISOString(), createdByName: e.createdBy ? (e.createdBy.name ?? e.createdBy.email) : null,
      })),
    };
  }

  /** Ручная правка бонусов: руководитель, с причиной; в минус баланс не уводит */
  async adjust(customerId: string, raw: unknown) {
    await mayBeautyWrite(this.prisma, 'staff');
    if (!UUID.test(customerId)) throw new NotFoundException('Клиент не найден');
    const parsed = parseBonusAdjustment(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const scope = await beautyScope(this.prisma, true);
    const currency = scope.locationCurrency!;
    await beautyTransaction(this.prisma, scope, async (tx) => {
      const visible = await tx.customer.findFirst({
        where: { id: customerId, organizationId: scope.organizationId, businesses: { some: { businessId: scope.businessId } } },
        select: { id: true },
      });
      if (!visible) throw new NotFoundException('Клиент не найден');
      await lockCustomerBonuses(tx, scope.businessId, customerId);
      const balance = await customerBalance(tx, scope.businessId, customerId, currency);
      if (balance + parsed.value.amountMinor < 0n) throw new ConflictException('Списать можно не больше баланса');
      const program = await bonusProgramOf(tx, scope.businessId);
      const entry = await tx.customerBonusEntry.create({
        data: {
          organizationId: scope.organizationId, businessId: scope.businessId, customerId, kind: 'ADJUSTMENT',
          amountMinor: parsed.value.amountMinor, currency, reason: parsed.value.reason, createdById: currentUserId(),
          expiresAt: parsed.value.amountMinor > 0n && program.expiresDays ? new Date(Date.now() + program.expiresDays * 86_400_000) : null,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId, userId: currentUserId(), entityType: 'customer', entityId: customerId,
          action: 'beauty.bonus.adjusted', after: { entryId: entry.id, amountMinor: parsed.value.amountMinor.toString(), reason: parsed.value.reason },
        },
      });
    });
    return this.customerBonuses(customerId);
  }

  async certificates(rawStatus?: string) {
    mayBeauty('desk');
    const scope = await beautyScope(this.prisma);
    const rows = await this.prisma.db.giftCertificate.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        id: true, code: true, initialMinor: true, balanceMinor: true, currency: true, expiresAt: true, status: true, createdAt: true,
        buyer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const now = new Date();
    const items = rows.map((r) => certificateView(r, now)).filter((r) => !rawStatus || r.status === rawStatus);
    return { currency: scope.locationCurrency, items };
  }

  async lookup(rawCode?: string) {
    mayBeauty('desk');
    const code = normalizeCertificateCode(rawCode);
    if (!code) throw new BadRequestException('Введите код сертификата: 8 знаков');
    const scope = await beautyScope(this.prisma);
    const row = await this.prisma.db.giftCertificate.findFirst({
      where: { businessId: scope.businessId, code },
      select: {
        id: true, code: true, initialMinor: true, balanceMinor: true, currency: true, expiresAt: true, status: true, createdAt: true,
        buyer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!row) throw new NotFoundException('Сертификат не найден');
    return certificateView(row);
  }

  /** Продажа: сертификат, движение SALE и приход кассы филиала живыми деньгами, одна транзакция; повтор по ключу */
  async sell(raw: unknown) {
    await mayBeautyWrite(this.prisma, 'desk');
    const parsed = parseCertificateSale(raw);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const input = parsed.value;
    const scope = await beautyScope(this.prisma, true);
    const locationId = scope.locationId!;
    const id = await beautyTransaction(this.prisma, scope, async (tx) => {
      const replay = await tx.restaurantCashOperation.findFirst({
        where: { locationId, idempotencyKey: input.idempotencyKey },
        select: { id: true, giftCertificateEntries: { where: { kind: 'SALE' }, select: { certificateId: true } } },
      });
      if (replay) {
        const certificateId = replay.giftCertificateEntries[0]?.certificateId;
        if (!certificateId) throw new ConflictException('Этот ключ оплаты уже использован');
        return certificateId;
      }
      // §21.7: сертификат продаётся только включённым в филиале способом
      await assertBranchMethodsOpen(tx, locationId, input.method);
      if (input.buyerCustomerId) {
        const buyer = await tx.customer.findFirst({
          where: { id: input.buyerCustomerId, organizationId: scope.organizationId, businesses: { some: { businessId: scope.businessId } } },
          select: { id: true },
        });
        if (!buyer) throw new NotFoundException('Покупатель не найден');
      }
      const now = new Date();
      let code = generateCertificateCode();
      for (let i = 0; i < 5; i++) {
        const taken = await tx.giftCertificate.findFirst({ where: { businessId: scope.businessId, code }, select: { id: true } });
        if (!taken) break;
        code = generateCertificateCode();
      }
      const cert = await tx.giftCertificate.create({
        data: {
          organizationId: scope.organizationId, businessId: scope.businessId, code,
          initialMinor: input.amountMinor, balanceMinor: input.amountMinor, currency: scope.locationCurrency!,
          expiresAt: certificateExpiry(now, input.months), buyerCustomerId: input.buyerCustomerId, createdById: currentUserId(),
        },
      });
      const op = await tx.restaurantCashOperation.create({
        data: {
          locationId, kind: 'INCOME', method: input.method, amount: input.amountMinor, currency: scope.locationCurrency!,
          note: `Продажа подарочного сертификата ${code}`, idempotencyKey: input.idempotencyKey, createdById: currentUserId(),
        },
      });
      await tx.giftCertificateEntry.create({
        data: { organizationId: scope.organizationId, certificateId: cert.id, kind: 'SALE', amountMinor: input.amountMinor, paymentId: op.id, createdById: currentUserId() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId, userId: currentUserId(), entityType: 'gift_certificate', entityId: cert.id,
          action: 'beauty.gift_certificate.sold',
          after: { cashOperationId: op.id, method: input.method, amountMinor: input.amountMinor.toString(), expiresAt: cert.expiresAt.toISOString() },
        },
      });
      return cert.id;
    });
    const row = await this.prisma.db.giftCertificate.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, code: true, initialMinor: true, balanceMinor: true, currency: true, expiresAt: true, status: true, createdAt: true,
        buyer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return certificateView(row);
  }
}

/** Баланс и сколько можно списать в эту запись: для формы оплаты */
export async function appointmentBonusQuote(db: DbTx | PrismaService['db'], scope: LoyaltyScope, appointment: { id: string; customerId: string; price: bigint; currency: string }) {
  const program = await bonusProgramOf(db, scope.businessId);
  if (!program.enabled) return null;
  const balance = await customerBalance(db, scope.businessId, appointment.customerId, appointment.currency);
  const paidByBonus = await netByMethod(db, appointment.id, 'BONUS');
  const cap = maxRedeem(appointment.price, balance, program.maxRedeemPercent);
  const checkCap = (appointment.price * BigInt(program.maxRedeemPercent)) / 100n - paidByBonus;
  const allowed = cap < checkCap ? cap : checkCap;
  return { balanceMinor: balance.toString(), maxRedeemMinor: (allowed > 0n ? allowed : 0n).toString() };
}


@RequiresBusinessCapability('beauty.customers')
@Controller('beauty')
export class BeautyLoyaltyController {
  constructor(@Inject(BeautyLoyaltyService) private readonly service: BeautyLoyaltyService) {}

  @BeautyAccess('settings', 'view')
  @Get('bonus-program') @Access('desk') program() {
    return this.service.program();
  }
  @BeautyAccess('settings', 'update')
  @Put('bonus-program') @Access('property') saveProgram(@Body() body: unknown) {
    return this.service.saveProgram(body);
  }
  @BeautyAccess('customers', 'view')
  @Get('customers/:id/bonuses') @Access('desk') customerBonuses(@Param('id') id: string) {
    return this.service.customerBonuses(id);
  }
  @BeautyAccess('customers', 'update', { managerOnly: true })
  @Post('customers/:id/bonuses/adjustments') @Access('staff') adjust(@Param('id') id: string, @Body() body: unknown) {
    return this.service.adjust(id, body);
  }
  @BeautyAccess('finance', 'view')
  @Get('gift-certificates') @Access('desk') certificates(@Query('status') status?: string) {
    return this.service.certificates(status);
  }
  @BeautyAccess('finance', 'view')
  @Get('gift-certificates/lookup') @Access('desk') lookup(@Query('code') code?: string) {
    return this.service.lookup(code);
  }
  @BeautyAccess('finance', 'create')
  @Post('gift-certificates') @Access('desk') sell(@Body() body: unknown) {
    return this.service.sell(body);
  }
}
