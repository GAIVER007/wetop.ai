import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { LUXX_APARTS_PROPERTY, type PaymentRequestMethod } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyRef } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';
import {
  FinanceStateError,
  lockOpenFolios,
  writeAudit,
  type AuditEntry,
  type TxClient,
} from './finance.repository';

export type PaymentRequestStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface PaymentRequestRecord {
  id: string;
  folioId: string;
  amountMinor: bigint;
  currency: string;
  method: PaymentRequestMethod;
  link: string | null;
  status: PaymentRequestStatus;
  paymentId: string | null;
  note: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface NewPaymentRequest {
  folioId: string;
  amountMinor: bigint;
  currency: string;
  method: PaymentRequestMethod;
  link: string | null;
  note: string | null;
}

/** Запросы оплаты (DATA_MODEL §24, ADR-144). Поиск — только внутри объекта: чужой запрос по известному id не найдётся */
export interface PaymentRequestsRepository {
  propertyName(): Promise<string>;
  /** null — брони нет */
  byReservation(confirmationNumber: string): Promise<PaymentRequestRecord[] | null>;
  byId(id: string): Promise<(PaymentRequestRecord & { confirmationNumber: string }) | null>;
  create(r: NewPaymentRequest, audit: AuditEntry): Promise<string>;
  /**
   * Платёж и закрытие запроса — одной транзакцией под блокировкой строки запроса и счёта: повтор нажатия
   * «Оплачено» видит PAID и отказывает (`FinanceStateError`), второго платежа нет.
   */
  markPaid(id: string, paidAt: string | null, audit: AuditEntry): Promise<string>;
  cancel(id: string, audit: AuditEntry): Promise<void>;
}
export const PAYMENT_REQUESTS_REPOSITORY = Symbol('PAYMENT_REQUESTS_REPOSITORY');

type Row = {
  id: string;
  folioId: string;
  amount: bigint;
  currency: string;
  method: string;
  link: string | null;
  status: string;
  paymentId: string | null;
  note: string | null;
  createdAt: Date;
  closedAt: Date | null;
};
const toRecord = (r: Row): PaymentRequestRecord => ({
  id: r.id,
  folioId: r.folioId,
  amountMinor: r.amount,
  currency: r.currency.trim(),
  method: r.method as PaymentRequestMethod,
  link: r.link,
  status: r.status as PaymentRequestStatus,
  paymentId: r.paymentId,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
  closedAt: r.closedAt ? r.closedAt.toISOString() : null,
});

@Injectable()
export class PrismaPaymentRequestsRepository implements PaymentRequestsRepository {
  private readonly name = LUXX_APARTS_PROPERTY.name;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async propertyId(): Promise<string> {
    return propertyIdRef(this.prisma.db, this.name);
  }
  async propertyName(): Promise<string> {
    return (await propertyRef(this.prisma.db, this.name)).name;
  }

  async byReservation(confirmationNumber: string): Promise<PaymentRequestRecord[] | null> {
    const propertyId = await this.propertyId();
    const r = await this.prisma.db.reservation.findUnique({
      where: { propertyId_confirmationNumber: { propertyId, confirmationNumber } },
      select: { id: true },
    });
    if (!r) return null;
    const rows = await this.prisma.db.paymentRequest.findMany({
      where: { propertyId, folio: { reservationItem: { reservationId: r.id } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async byId(id: string): Promise<(PaymentRequestRecord & { confirmationNumber: string }) | null> {
    const propertyId = await this.propertyId();
    const row = await this.prisma.db.paymentRequest.findFirst({
      where: { id, propertyId },
      include: {
        folio: {
          select: {
            reservationItem: { select: { reservation: { select: { confirmationNumber: true } } } },
          },
        },
      },
    });
    return row
      ? {
          ...toRecord(row),
          confirmationNumber: row.folio.reservationItem.reservation.confirmationNumber,
        }
      : null;
  }

  async create(r: NewPaymentRequest, audit: AuditEntry): Promise<string> {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (t) => {
      const tx = t as unknown as TxClient;
      await lockOpenFolios(tx, [r.folioId]);
      const row = await tx.paymentRequest.create({
        data: {
          propertyId,
          folioId: r.folioId,
          amount: r.amountMinor,
          currency: r.currency,
          method: r.method,
          link: r.link,
          note: r.note,
          createdById: auditUserId() ?? null,
        },
        select: { id: true },
      });
      await writeAudit(tx, { ...audit, entityId: row.id }, row.id);
      return row.id;
    });
  }

  async markPaid(id: string, paidAt: string | null, audit: AuditEntry): Promise<string> {
    const propertyId = await this.propertyId();
    return this.prisma.db.$transaction(async (t) => {
      const tx = t as unknown as TxClient;
      const rows = await tx.$queryRaw<
        Array<{
          status: string;
          folio_id: string;
          amount: bigint;
          currency: string;
          method: string;
        }>
      >`SELECT "status"::text AS status, "folio_id", "amount", "currency", "method"::text AS method
          FROM "payment_requests" WHERE "id" = ${id}::uuid AND "property_id" = ${propertyId}::uuid FOR UPDATE`;
      const req = rows[0];
      if (!req) throw new FinanceStateError('Запрос оплаты не найден');
      if (req.status !== 'PENDING')
        throw new FinanceStateError(
          req.status === 'PAID' ? 'Запрос уже оплачен' : 'Запрос отменён',
        );
      await lockOpenFolios(tx, [req.folio_id]);
      const payment = await tx.payment.create({
        data: {
          propertyId,
          method: req.method as PaymentRequestMethod,
          amount: req.amount,
          currency: req.currency.trim(),
          note: 'Оплата по запросу',
          ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
          allocations: { create: [{ folioId: req.folio_id, amount: req.amount }] },
        },
        select: { id: true },
      });
      await tx.paymentRequest.update({
        where: { id },
        data: { status: 'PAID', paymentId: payment.id, closedAt: new Date() },
      });
      await writeAudit(tx, {
        ...audit,
        entityId: id,
        after: { ...audit.after, paymentId: payment.id },
      });
      return payment.id;
    });
  }

  async cancel(id: string, audit: AuditEntry): Promise<void> {
    const propertyId = await this.propertyId();
    await this.prisma.db.$transaction(async (t) => {
      const tx = t as unknown as TxClient;
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status"::text AS status FROM "payment_requests"
         WHERE "id" = ${id}::uuid AND "property_id" = ${propertyId}::uuid FOR UPDATE`;
      if (!rows[0]) throw new FinanceStateError('Запрос оплаты не найден');
      if (rows[0].status !== 'PENDING')
        throw new FinanceStateError(
          rows[0].status === 'PAID'
            ? 'Оплаченный запрос не отменяется: верните деньги возвратом платежа'
            : 'Запрос уже отменён',
        );
      await tx.paymentRequest.update({
        where: { id },
        data: { status: 'CANCELLED', closedAt: new Date() },
      });
      await writeAudit(tx, { ...audit, entityId: id });
    });
  }
}
