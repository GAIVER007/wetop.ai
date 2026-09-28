import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pms/database';
import {
  FinanceRuleError,
  LUXX_APARTS_PROPERTY,
  assertRefundWithin,
  folioBalance,
  zonedStartOfDay,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { propertyIdRef, propertyRef, propertyToday } from '../database/property-ref';
import { auditUserId } from '../accounts/actor';

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
/** Поддерживаемые способы оплаты (DATA_MODEL §6). */
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

/**
 * Бронь для списка «Брони с остатком к сбору» (ADR-113): у неё есть действующее начисление с датой услуги в
 * периоде, а суммы — по всем её счетам за всё время, как у остатка на карточке брони.
 */
export interface DebtCandidate {
  confirmationNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  guestLabel: string | null;
  chargedMinor: bigint;
  /** только проведённые платежи (`COMPLETED`) — как `folioBalance` на карточке */
  paidMinor: bigint;
  refundedMinor: bigint;
}

/**
 * Операция денег за период (ADR-113, F2): оплата (проведённая или аннулированная) или возврат. Время — по часам
 * объекта; бронь — через распределение платежа (первая по номеру, `reservations` — сколько их) или счёт возврата.
 */
export interface OperationRecord {
  kind: 'PAYMENT' | 'REFUND';
  id: string;
  at: string;
  /** `YYYY-MM-DD HH:mm` по поясу объекта */
  localAt: string;
  method: PaymentMethod;
  amountMinor: bigint;
  status: 'COMPLETED' | 'VOIDED';
  confirmationNumber: string | null;
  reservations: number;
  guestLabel: string | null;
}
/** Итоги операций периода без отборов — для сумм по отбору и чисел на чипах способов */
export interface OperationsSummaryRow {
  kind: 'PAYMENT' | 'REFUND';
  method: PaymentMethod;
  status: 'COMPLETED' | 'VOIDED';
  count: number;
  amountMinor: bigint;
}

/** Порт финансов: счета читаются целиком (начисления, распределения, возвраты), команды — точечные записи. */
/**
 * Строка журнала, которую операция пишет вместе с деньгами — одной транзакцией (хвост Б6): иначе обрыв
 * связи между двумя запросами оставляет деньги в базе без следа. `entityId` не задан — берётся id только
 * что созданной записи (у платежа и возврата он известен лишь после вставки).
 */
export interface AuditEntry {
  entityType: string;
  entityId?: string;
  action: string;
  before?: unknown;
  after: Record<string, unknown>;
  /** Имя поля в `after`, куда подставить id созданной записи (`chargeId`, `refundId`) */
  idField?: string;
}

export interface FinanceRepository {
  /** Ячейка проживания по счёту; null — ячейка не назначена */
  stayUnitCode(reservationItemId: string): Promise<StayUnitRef | null>;
  /** Блоки доплат за соседнюю ночь с этой причиной («<услуга>, бронь <номер>») — любые ячейки, новые первыми */
  stayExtraBlocks(
    reason: string,
  ): Promise<Array<{ id: string; unitCode: string; dateFrom: string; dateTo: string }>>;
  /** null — брони с таким номером нет */
  foliosByReservation(confirmationNumber: string): Promise<FolioRecord[] | null>;
  folioById(id: string): Promise<FolioRecord | null>;
  services(): Promise<ServiceRef[]>;
  /** Сводка за период [from, to] включительно (T4 «финансовый учёт период») */
  periodReport(from: string, to: string): Promise<PeriodReport>;
  /** Брони с начислением в периоде [from, to] и суммы по всем их счетам (ADR-113) */
  periodDebts(from: string, to: string): Promise<DebtCandidate[]>;
  /** Оплаты и возвраты периода: строки по отбору (новые первыми, не больше `limit`) и итоги без отборов (ADR-113, F2) */
  periodOperations(
    from: string,
    to: string,
    filter: { type?: 'PAYMENT' | 'REFUND'; method?: PaymentMethod; limit: number },
  ): Promise<{ rows: OperationRecord[]; summary: OperationsSummaryRow[] }>;
  /** Сегодня по часам объекта (С-13): дата услуги по умолчанию */
  today(): Promise<string>;
  addCharge(folioId: string, c: NewCharge, audit?: AuditEntry): Promise<string>;
  chargeById(id: string): Promise<ChargeRecord | null>;
  voidCharge(id: string, audit?: AuditEntry): Promise<void>;
  /** Платёж вместе с распределением — атомарно */
  createPayment(p: NewPayment, audit?: AuditEntry): Promise<string>;
  paymentById(id: string): Promise<PaymentRecord | null>;
  createRefund(r: NewRefund, audit?: AuditEntry): Promise<string>;
  /** Закрыть счёт вручную (DATA_MODEL §6, Folio.status): гость рассчитался, начислений больше не будет */
  closeFolio(id: string, audit?: AuditEntry): Promise<void>;
  audit(
    entityType: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ): Promise<void>;
}
export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

/**
 * Клиент внутри транзакции: те же таблицы, что у `PrismaService.db`, но без вложенных транзакций.
 * Тип берём от самого клиента, чтобы он не разошёлся со схемой.
 */
type TxClient = PrismaService['db'];

/** Счёт закрыт или его нет: деньги в него не записываются (аудит 26.09, С-25) */
export class FolioClosedError extends Error {
  constructor(readonly folioId: string) {
    super(`Счёт ${folioId} закрыт`);
  }
}
/** Закрыть можно только счёт с нулевым балансом — пересчитанным под блокировкой */
/** Начисление уже сторнировано или платёж уже аннулирован — проверено под блокировкой, конфликт (409), как в сервисе */
export class FinanceStateError extends Error {}

export class FolioBalanceError extends Error {
  constructor(readonly balanceMinor: bigint) {
    super(`На счёте баланс ${balanceMinor}`);
  }
}

/**
 * Строки счетов под блокировку до конца транзакции и проверка, что они открыты. Порядок id — один для всех, чтобы две
 * записи на те же счета не ждали друг друга по кругу. Раньше «счёт открыт» проверялось до транзакции записи, и
 * одновременное начисление ложилось в только что закрытый счёт (аудит 26.09, С-25).
 */
async function lockOpenFolios(tx: TxClient, folioIds: string[]): Promise<void> {
  for (const id of [...new Set(folioIds)].sort()) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"::text AS status FROM "folios" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (rows[0]?.status !== 'OPEN') throw new FolioClosedError(id);
  }
}

/** Одна строка журнала. Пишется тем же клиентом, что и деньги, — своим или транзакционным. */
async function writeAudit(tx: TxClient, a: AuditEntry, createdId?: string): Promise<void> {
  const j = (x: unknown) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const after = a.idField && createdId ? { ...a.after, [a.idField]: createdId } : a.after;
  await tx.auditLog.create({
    data: {
      userId: auditUserId(),
      entityType: a.entityType,
      entityId: a.entityId ?? createdId ?? '',
      action: a.action,
      before: j(a.before),
      after: j(after),
    },
  });
}

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
/**
 * Границы суток для событий со временем (платежи, возвраты). Объект живёт в Asia/Almaty (UTC+5),
 * стойка работает круглосуточно: платёж в 02:00 по Алматы — это 21:00 предыдущего дня по UTC,
 * и по UTC-границам он ушёл бы в соседний период.
 */
// С-13 (ТЗ аудита 25.09.2026): границы считаются по Property.timezone, а не по жёсткому смещению
const localStart = (d: string, tz: string) => zonedStartOfDay(d, tz);
const localEndExclusive = (d: string, tz: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return zonedStartOfDay(x.toISOString().slice(0, 10), tz);
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
  private async property(): Promise<{ id: string }> {
    return { id: await propertyIdRef(this.prisma.db, this.propertyName) };
  }
  async today(): Promise<string> {
    return propertyToday(this.prisma.db, this.propertyName);
  }
  private async timezone(): Promise<string> {
    return (await propertyRef(this.prisma.db, this.propertyName)).timezone;
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
  async stayExtraBlocks(
    reason: string,
  ): Promise<Array<{ id: string; unitCode: string; dateFrom: string; dateTo: string }>> {
    const rows = await this.prisma.db.inventoryBlock.findMany({
      where: { type: 'OTHER', reason },
      orderBy: { createdAt: 'desc' },
      select: { id: true, dateFrom: true, dateTo: true, inventoryUnit: { select: { code: true } } },
    });
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return rows.map((b) => ({
      id: b.id,
      unitCode: b.inventoryUnit.code,
      dateFrom: iso(b.dateFrom),
      dateTo: iso(b.dateTo),
    }));
  }
  async stayUnitCode(reservationItemId: string): Promise<StayUnitRef | null> {
    const a = await this.prisma.db.allocation.findFirst({
      where: { reservationItemId },
      orderBy: { startDate: 'asc' },
      select: { inventoryUnit: { select: { code: true } } },
    });
    return a ? { code: a.inventoryUnit.code } : null;
  }
  // Поиск по id — только внутри объекта (замок организаций ADR-061, Q-152): чужой счёт по известному id не найдётся
  async folioById(id: string): Promise<FolioRecord | null> {
    const { id: propertyId } = await this.property();
    const f = await this.prisma.db.folio.findFirst({
      where: { id, reservationItem: { reservation: { propertyId } } },
      include: folioInclude,
    });
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
    const tz = await this.timezone();
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
        paidAt: { gte: localStart(from, tz), lt: localEndExclusive(to, tz) },
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
        createdAt: { gte: localStart(from, tz), lt: localEndExclusive(to, tz) },
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
  /**
   * Один запрос вместо загрузки всех начислений в память: за год это тысячи броней. Бронь попадает в выборку по
   * действующему начислению с датой услуги в периоде — та же база, что у «Начислено» в сводке; суммы берутся по
   * каждому счёту брони подзапросами (три отдельных соединения размножили бы строки) и складываются по брони.
   */
  async periodDebts(from: string, to: string): Promise<DebtCandidate[]> {
    const { id: propertyId } = await this.property();
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        confirmation_number: string;
        status: string;
        arrival_date: Date;
        departure_date: Date;
        first_name: string | null;
        last_name: string | null;
        charged: bigint;
        paid: bigint;
        refunded: bigint;
      }>
    >`
      WITH period_reservations AS (
        SELECT DISTINCT ri.reservation_id
          FROM charges c
          JOIN folios f ON f.id = c.folio_id
          JOIN reservation_items ri ON ri.id = f.reservation_item_id
          JOIN reservations r ON r.id = ri.reservation_id
         WHERE r.property_id = ${propertyId}::uuid
           AND c.voided_at IS NULL
           AND c.service_date >= ${from}::date
           AND c.service_date <= ${to}::date
      ),
      folio_sums AS (
        SELECT ri.reservation_id,
               (SELECT COALESCE(SUM(c.amount), 0) FROM charges c
                 WHERE c.folio_id = f.id AND c.voided_at IS NULL) AS charged,
               (SELECT COALESCE(SUM(a.amount), 0) FROM payment_allocations a
                  JOIN payments p ON p.id = a.payment_id
                 WHERE a.folio_id = f.id AND p.status = 'COMPLETED') AS paid,
               (SELECT COALESCE(SUM(x.amount), 0) FROM refunds x WHERE x.folio_id = f.id) AS refunded
          FROM folios f
          JOIN reservation_items ri ON ri.id = f.reservation_item_id
         WHERE ri.reservation_id IN (SELECT reservation_id FROM period_reservations)
      )
      SELECT r.confirmation_number, r.status::text AS status, r.arrival_date, r.departure_date,
             g.first_name, g.last_name,
             SUM(s.charged)::bigint AS charged, SUM(s.paid)::bigint AS paid,
             SUM(s.refunded)::bigint AS refunded
        FROM folio_sums s
        JOIN reservations r ON r.id = s.reservation_id
        LEFT JOIN guests g ON g.id = r.primary_guest_id
       GROUP BY r.id, g.id`;
    const day = (d: Date) => d.toISOString().slice(0, 10);
    return rows.map((r) => ({
      confirmationNumber: r.confirmation_number,
      status: r.status,
      arrivalDate: day(r.arrival_date),
      departureDate: day(r.departure_date),
      guestLabel:
        r.first_name === null ? null : `${r.first_name} ${r.last_name ?? ''}`.trim() || null,
      chargedMinor: BigInt(r.charged),
      paidMinor: BigInt(r.paid),
      refundedMinor: BigInt(r.refunded),
    }));
  }
  /**
   * Оплаты по `paid_at` и возвраты по `created_at` в границах суток пояса объекта — та же выборка, что у «Оплачено»
   * и «Возвращено» в сводке; аннулированные оплаты тоже здесь, со своим статусом. Возврат отбирается по брони своего
   * счёта, как в сводке. Два запроса: строки с бронью и гостем (с отборами и пределом) и итоги без отборов.
   */
  async periodOperations(
    from: string,
    to: string,
    filter: { type?: 'PAYMENT' | 'REFUND'; method?: PaymentMethod; limit: number },
  ): Promise<{ rows: OperationRecord[]; summary: OperationsSummaryRow[] }> {
    const tz = await this.timezone();
    const { id: propertyId } = await this.property();
    const start = localStart(from, tz);
    const end = localEndExclusive(to, tz);
    const ops = Prisma.sql`
      SELECT 'PAYMENT'::text AS kind, p.id, p.paid_at AS at, p.method::text AS method, p.amount,
             p.status::text AS status, NULL::uuid AS folio_id
        FROM payments p
       WHERE p.property_id = ${propertyId}::uuid AND p.paid_at >= ${start} AND p.paid_at < ${end}
      UNION ALL
      SELECT 'REFUND'::text, x.id, x.created_at, p.method::text, x.amount, 'COMPLETED'::text, x.folio_id
        FROM refunds x
        JOIN payments p ON p.id = x.payment_id
        JOIN folios f ON f.id = x.folio_id
        JOIN reservation_items ri ON ri.id = f.reservation_item_id
        JOIN reservations r ON r.id = ri.reservation_id
       WHERE r.property_id = ${propertyId}::uuid AND x.created_at >= ${start} AND x.created_at < ${end}`;
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        kind: 'PAYMENT' | 'REFUND';
        id: string;
        at: Date;
        local_at: string;
        method: PaymentMethod;
        amount: bigint;
        status: 'COMPLETED' | 'VOIDED';
        confirmation_number: string | null;
        first_name: string | null;
        last_name: string | null;
        reservations: bigint | null;
      }>
    >(Prisma.sql`
      WITH ops AS (${ops})
      SELECT o.kind, o.id, o.at, to_char(o.at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24:MI') AS local_at,
             o.method, o.amount, o.status, b.confirmation_number, b.first_name, b.last_name, b.reservations
        FROM ops o
        LEFT JOIN LATERAL (
          SELECT r.confirmation_number, g.first_name, g.last_name, COUNT(*) OVER () AS reservations
            FROM reservations r
            LEFT JOIN guests g ON g.id = r.primary_guest_id
           WHERE r.id IN (
                   SELECT ri.reservation_id
                     FROM folios f
                     JOIN reservation_items ri ON ri.id = f.reservation_item_id
                    WHERE f.id = o.folio_id
                       OR (o.kind = 'PAYMENT'
                           AND f.id IN (SELECT a.folio_id FROM payment_allocations a WHERE a.payment_id = o.id)))
           ORDER BY r.confirmation_number
           LIMIT 1
        ) b ON true
       WHERE (${filter.type ?? null}::text IS NULL OR o.kind = ${filter.type ?? null}::text)
         AND (${filter.method ?? null}::text IS NULL OR o.method = ${filter.method ?? null}::text)
       ORDER BY o.at DESC, o.id
       LIMIT ${filter.limit}`);
    const summary = await this.prisma.db.$queryRaw<
      Array<{
        kind: 'PAYMENT' | 'REFUND';
        method: PaymentMethod;
        status: 'COMPLETED' | 'VOIDED';
        count: bigint;
        amount: bigint;
      }>
    >(Prisma.sql`
      WITH ops AS (${ops})
      SELECT kind, method, status, COUNT(*)::bigint AS count, SUM(amount)::bigint AS amount
        FROM ops
       GROUP BY kind, method, status`);
    return {
      rows: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        at: r.at.toISOString(),
        localAt: r.local_at,
        method: r.method,
        amountMinor: BigInt(r.amount),
        status: r.status,
        confirmationNumber: r.confirmation_number,
        reservations: Number(r.reservations ?? 0),
        guestLabel:
          r.first_name === null ? null : `${r.first_name} ${r.last_name ?? ''}`.trim() || null,
      })),
      summary: summary.map((x) => ({
        kind: x.kind,
        method: x.method,
        status: x.status,
        count: Number(x.count),
        amountMinor: BigInt(x.amount),
      })),
    };
  }
  /**
   * Запись денег и строка журнала одной транзакцией. Без данных журнала (`audit`) метод работает как
   * прежде — одним запросом: транзакция ради одной вставки только занимает соединение пулера.
   */
  private async withAudit<T extends { id: string } | void>(
    audit: AuditEntry | undefined,
    write: (tx: TxClient) => Promise<T>,
  ): Promise<T> {
    if (!audit) return write(this.prisma.db as unknown as TxClient);
    return this.prisma.db.$transaction(async (tx) => {
      const row = await write(tx as unknown as TxClient);
      await writeAudit(tx as unknown as TxClient, audit, row && 'id' in row ? row.id : undefined);
      return row;
    });
  }

  /** Запись денег под блокировкой: всегда одной транзакцией, даже без журнала — иначе блокировка ничего не держит */
  private async locked<T extends { id: string } | void>(
    audit: AuditEntry | undefined,
    lock: (tx: TxClient) => Promise<void>,
    write: (tx: TxClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.db.$transaction(async (tx) => {
      const client = tx as unknown as TxClient;
      await lock(client);
      const row = await write(client);
      if (audit) await writeAudit(client, audit, row && 'id' in row ? row.id : undefined);
      return row;
    });
  }

  async addCharge(folioId: string, c: NewCharge, audit?: AuditEntry): Promise<string> {
    const row = await this.locked(
      audit,
      (tx) => lockOpenFolios(tx, [folioId]),
      (tx) =>
        tx.charge.create({
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
        }),
    );
    return row.id;
  }
  async chargeById(id: string): Promise<ChargeRecord | null> {
    const { id: propertyId } = await this.property();
    const c = await this.prisma.db.charge.findFirst({
      where: { id, folio: { reservationItem: { reservation: { propertyId } } } },
      include: { service: { select: { code: true } } },
    });
    return c ? toCharge(c) : null;
  }
  async voidCharge(id: string, audit?: AuditEntry): Promise<void> {
    await this.locked(
      audit,
      async (tx) => {
        const charge = await tx.charge.findUniqueOrThrow({
          where: { id },
          select: { folioId: true },
        });
        await lockOpenFolios(tx, [charge.folioId]);
        // Под блокировкой счёта: два одновременных сторно оба проходили проверку сервиса (проверка исправлений 26.09)
        const now = await tx.charge.findUniqueOrThrow({
          where: { id },
          select: { voidedAt: true },
        });
        if (now.voidedAt) throw new FinanceStateError('Начисление уже сторнировано');
      },
      async (tx) => {
        await tx.charge.update({ where: { id }, data: { voidedAt: new Date() } });
      },
    );
  }
  async createPayment(p: NewPayment, audit?: AuditEntry): Promise<string> {
    const { id: propertyId } = await this.property();
    const folioIds = p.allocations.map((a) => a.folioId);
    const row = await this.locked(
      audit,
      (tx) => lockOpenFolios(tx, folioIds),
      (tx) =>
        tx.payment.create({
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
        }),
    );
    return row.id;
  }
  async paymentById(id: string): Promise<PaymentRecord | null> {
    const { id: propertyId } = await this.property();
    const p = await this.prisma.db.payment.findFirst({
      where: { id, propertyId },
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
  /**
   * Возврат: предел «не больше внесённого на этот счёт минус уже возвращённое» пересчитывается под блокировкой платежа.
   * Раньше его считали до транзакции, и два одновременных возврата оба проходили — возвращали больше, чем внесено
   * (аудит 25.09, С-2). Нарушение предела — `FinanceRuleError`, аннулированный платёж — `FinanceStateError`, как в сервисе.
   */
  async createRefund(r: NewRefund, audit?: AuditEntry): Promise<string> {
    const lock = async (tx: TxClient) => {
      // Распределение не меняется после записи платежа — проверка до блокировок: чужой счёт не блокируем
      const allocated = await tx.paymentAllocation.findUnique({
        where: { paymentId_folioId: { paymentId: r.paymentId, folioId: r.folioId } },
        select: { amount: true },
      });
      if (!allocated) throw new FinanceRuleError('Этот платёж на указанный счёт не распределялся');
      await lockOpenFolios(tx, [r.folioId]);
      const payment = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status"::text AS status FROM "payments" WHERE "id" = ${r.paymentId}::uuid FOR UPDATE`;
      if (payment[0]?.status !== 'COMPLETED') throw new FinanceStateError('Платёж аннулирован');
      const refunded = await tx.refund.aggregate({
        where: { paymentId: r.paymentId, folioId: r.folioId },
        _sum: { amount: true },
      });
      assertRefundWithin({
        allocatedMinor: allocated.amount,
        refundedMinor: refunded._sum.amount ?? 0n,
        refundMinor: r.amountMinor,
      });
    };
    const row = await this.locked(audit, lock, (tx) =>
      tx.refund.create({
        data: {
          paymentId: r.paymentId,
          folioId: r.folioId,
          amount: r.amountMinor,
          reason: r.reason,
        },
        select: { id: true },
      }),
    );
    return row.id;
  }
  /**
   * Закрыть счёт: баланс пересчитывается под блокировкой той же строки, что берут начисления и платежи. Раньше сервис
   * считал его до транзакции, и одновременное начисление оставляло долг на закрытом счёте (аудит 26.09, С-25).
   */
  async closeFolio(id: string, audit?: AuditEntry): Promise<void> {
    const lock = async (tx: TxClient) => {
      await lockOpenFolios(tx, [id]);
      const [charged, paid, refunded] = await Promise.all([
        tx.charge.aggregate({ where: { folioId: id, voidedAt: null }, _sum: { amount: true } }),
        tx.paymentAllocation.aggregate({
          where: { folioId: id, payment: { status: 'COMPLETED' } },
          _sum: { amount: true },
        }),
        tx.refund.aggregate({ where: { folioId: id }, _sum: { amount: true } }),
      ]);
      const balance = folioBalance({
        charges: [{ amountMinor: charged._sum.amount ?? 0n, voided: false }],
        allocations: [{ amountMinor: paid._sum.amount ?? 0n }],
        refunds: [{ amountMinor: refunded._sum.amount ?? 0n }],
      }).balanceMinor;
      if (balance !== 0n) throw new FolioBalanceError(balance);
    };
    await this.locked(audit, lock, async (tx) => {
      await tx.folio.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    });
  }
  async audit(
    entityType: string,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) {
    await writeAudit(this.prisma.db as unknown as TxClient, {
      entityType,
      entityId,
      action,
      before,
      // старый путь журнала (ADR-028 и импорт) кладёт произвольную структуру — форму проверяет вызывающий
      after: after as Record<string, unknown>,
    });
  }
}
