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
    /** DATA_MODEL §26: чек, выданный по запросу гостя; null — не выдавали */
    receipt: { number: string; issuedAt: string } | null;
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

/** Одно начисление-услуга периода (REP2): услуга справочника или начисление вручную (`service*` — null) */
export interface ServiceChargeRecord {
  serviceCode: string | null;
  serviceName: string | null;
  serviceGroup: string | null;
  quantity: number;
  amountMinor: bigint;
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
  /**
   * Q-207: время выезда уже прошло — гость выехал (`CHECKED_OUT`) или наступили дата выезда и час выезда объекта по
   * его поясу. Отменённые и незаезды не просрочиваются: срока оплаты у них нет, пока нет политики оплаты.
   */
  overdue: boolean;
}

/**
 * Операция денег за период (ADR-113, F2): оплата (проведённая или аннулированная) или возврат. Время — по часам
 * объекта; бронь — через распределение платежа (первая по номеру, `reservations` — сколько их) или счёт возврата.
 */
export interface OperationRecord {
  kind: 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';
  id: string;
  at: string;
  /** `YYYY-MM-DD HH:mm` по поясу объекта */
  localAt: string;
  method: PaymentMethod;
  /** только у перевода кассы — способ «куда» */
  methodTo: PaymentMethod | null;
  amountMinor: bigint;
  status: 'COMPLETED' | 'VOIDED';
  confirmationNumber: string | null;
  reservations: number;
  guestLabel: string | null;
  /** статья кассы словом; у денег броней — null */
  category: string | null;
  note: string | null;
}
/** Итоги операций периода без отборов — для сумм по отбору и чисел на чипах способов */
export interface OperationsSummaryRow {
  kind: 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';
  method: PaymentMethod;
  status: 'COMPLETED' | 'VOIDED';
  count: number;
  amountMinor: bigint;
}

// ── Касса (DATA_MODEL §21): операции мимо счетов гостей, статьи, остатки по способам ─────────────
export type CashKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';
/** Пять видов строки общей ленты операций: деньги броней + касса */
export type OperationKind = 'PAYMENT' | 'REFUND' | CashKind;
export interface CashCategoryRecord {
  id: string;
  kind: 'INCOME' | 'EXPENSE';
  name: string;
  active: boolean;
}
export interface NewCashOperation {
  kind: CashKind;
  method: PaymentMethod;
  methodTo: PaymentMethod | null;
  amountMinor: bigint;
  categoryId: string | null;
  note: string | null;
  occurredAt: string | null;
  /** связанный расход той же транзакцией (related_id → основная операция) */
  commission: { amountMinor: bigint; categoryId: string | null } | null;
}
export interface CashOperationRecord {
  id: string;
  kind: CashKind;
  method: PaymentMethod;
  methodTo: PaymentMethod | null;
  amountMinor: bigint;
  status: 'COMPLETED' | 'VOIDED';
  /** эта операция — комиссия другой: аннулируется только вместе с основной */
  relatedId: string | null;
  /** id строки-комиссии этой операции, если есть */
  commissionId: string | null;
}
/** Сверка кассы (§21.4): последняя запись по способу */
export interface CashReconciliationRecord {
  method: PaymentMethod;
  at: string;
  /** `YYYY-MM-DD HH:mm` по поясу объекта */
  localAt: string;
  expectedMinor: bigint;
  countedMinor: bigint;
  note: string | null;
}
export interface NewCashReconciliation {
  method: PaymentMethod;
  expectedMinor: bigint;
  countedMinor: bigint;
  note: string | null;
  /** поправка той же транзакцией; статья находится или заводится по имени */
  adjustment: { kind: 'INCOME' | 'EXPENSE'; amountMinor: bigint; categoryName: string } | null;
}
/** Слагаемые остатков по способам — суммы за всё время, считает база */
export interface CashBalanceSources {
  payments: Array<{ method: string; amountMinor: bigint }>;
  refunds: Array<{ method: string; amountMinor: bigint }>;
  operations: Array<{
    kind: CashKind;
    method: string;
    methodTo: string | null;
    amountMinor: bigint;
  }>;
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
  /** Начисления-услуги периода по дате услуги, без аннулированных — сырьё отчёта по услугам (REP2); сводит сервис */
  periodServiceCharges(from: string, to: string): Promise<ServiceChargeRecord[]>;
  /** Брони с начислением в периоде [from, to] и суммы по всем их счетам (ADR-113) */
  periodDebts(from: string, to: string): Promise<DebtCandidate[]>;
  /** Общая лента денег за период: оплаты и возвраты броней + операции кассы; итоги без отборов (ADR-113, F2; §21) */
  periodOperations(
    from: string,
    to: string,
    filter: {
      type?: OperationKind;
      method?: PaymentMethod;
      source?: 'RESERVATIONS' | 'CASH';
      limit: number;
    },
  ): Promise<{ rows: OperationRecord[]; summary: OperationsSummaryRow[] }>;
  /** Слагаемые остатков кассы по способам — за всё время (§21) */
  cashBalanceSources(): Promise<CashBalanceSources>;
  /** Статьи кассы; пустой справочник заполняется стартовым набором (Q-236) */
  cashCategories(): Promise<CashCategoryRecord[]>;
  createCashCategory(
    c: { kind: 'INCOME' | 'EXPENSE'; name: string },
    audit?: AuditEntry,
  ): Promise<string>;
  /** false — статьи нет у этого объекта */
  updateCashCategory(
    id: string,
    patch: { name?: string; active?: boolean },
    audit?: AuditEntry,
  ): Promise<boolean>;
  /** Операция кассы вместе с комиссией — одной транзакцией; возвращает id основной */
  createCashOperation(op: NewCashOperation, audit?: AuditEntry): Promise<string>;
  cashOperationById(id: string): Promise<CashOperationRecord | null>;
  /** Аннулирование под блокировкой строки; комиссия аннулируется вместе с основной */
  voidCashOperation(id: string, audit?: AuditEntry): Promise<void>;
  /** Последняя сверка по каждому способу (§21.4) */
  latestCashReconciliations(): Promise<CashReconciliationRecord[]>;
  /** Запись сверки вместе с поправкой — одной транзакцией */
  createCashReconciliation(r: NewCashReconciliation, audit?: AuditEntry): Promise<string>;
  /** Сегодня по часам объекта (С-13): дата услуги по умолчанию */
  today(): Promise<string>;
  addCharge(folioId: string, c: NewCharge, audit?: AuditEntry): Promise<string>;
  chargeById(id: string): Promise<ChargeRecord | null>;
  voidCharge(id: string, audit?: AuditEntry): Promise<void>;
  /** Платёж вместе с распределением — атомарно */
  createPayment(p: NewPayment, audit?: AuditEntry): Promise<string>;
  paymentById(id: string): Promise<PaymentRecord | null>;
  createRefund(r: NewRefund, audit?: AuditEntry): Promise<string>;
  /**
   * Отметка «чек выдан» по запросу гостя (DATA_MODEL §26): только у проведённого платежа объекта, один чек на платёж.
   * Под блокировкой строки платежа; аннулированный — `FinanceStateError`, повтор — `FinanceStateError` («уже выдан»).
   */
  issueReceipt(paymentId: string, number: string, audit: AuditEntry): Promise<void>;
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
export type TxClient = PrismaService['db'];

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
export async function lockOpenFolios(tx: TxClient, folioIds: string[]): Promise<void> {
  for (const id of [...new Set(folioIds)].sort()) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"::text AS status FROM "folios" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (rows[0]?.status !== 'OPEN') throw new FolioClosedError(id);
  }
}

/** Одна строка журнала. Пишется тем же клиентом, что и деньги, — своим или транзакционным. */
export async function writeAudit(tx: TxClient, a: AuditEntry, createdId?: string): Promise<void> {
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
  allocations: {
    orderBy: { payment: { paidAt: 'asc' as const } },
    include: { payment: { include: { receipt: { select: { number: true, issuedAt: true } } } } },
  },
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
      receipt: a.payment.receipt
        ? { number: a.payment.receipt.number, issuedAt: a.payment.receipt.issuedAt.toISOString() }
        : null,
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
  // Зеркало выборки periodReport, суженное до услуг: те же правила окна и аннулирования —
  // «Итого» отчёта по услугам всегда равно строке SERVICE сводки (REP2)
  async periodServiceCharges(from: string, to: string): Promise<ServiceChargeRecord[]> {
    const { id: propertyId } = await this.property();
    const rows = await this.prisma.db.charge.findMany({
      where: {
        voidedAt: null,
        kind: 'SERVICE',
        serviceDate: { gte: asDate(from), lte: asDate(to) },
        folio: { reservationItem: { reservation: { propertyId } } },
      },
      select: {
        quantity: true,
        amount: true,
        service: { select: { code: true, nameRu: true, group: true } },
      },
    });
    return rows.map((c) => ({
      serviceCode: c.service?.code ?? null,
      serviceName: c.service?.nameRu ?? null,
      serviceGroup: c.service?.group ?? null,
      quantity: c.quantity,
      amountMinor: c.amount,
    }));
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
        overdue: boolean;
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
             SUM(s.refunded)::bigint AS refunded,
             COALESCE(
               r.status::text NOT IN ('CANCELLED', 'NO_SHOW')
               AND (r.status::text = 'CHECKED_OUT'
                    OR ((r.departure_date + NULLIF(pr.check_out_time, '')::time)
                          AT TIME ZONE pr.timezone) <= now()),
               false) AS overdue
        FROM folio_sums s
        JOIN reservations r ON r.id = s.reservation_id
        JOIN properties pr ON pr.id = r.property_id
        LEFT JOIN guests g ON g.id = r.primary_guest_id
       GROUP BY r.id, g.id, pr.id`;
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
      overdue: r.overdue,
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
    filter: {
      type?: OperationKind;
      method?: PaymentMethod;
      source?: 'RESERVATIONS' | 'CASH';
      limit: number;
    },
  ): Promise<{ rows: OperationRecord[]; summary: OperationsSummaryRow[] }> {
    const tz = await this.timezone();
    const { id: propertyId } = await this.property();
    const start = localStart(from, tz);
    const end = localEndExclusive(to, tz);
    const ops = Prisma.sql`
      SELECT 'PAYMENT'::text AS kind, p.id, p.paid_at AS at, p.method::text AS method, NULL::text AS method_to,
             p.amount, p.status::text AS status, NULL::uuid AS folio_id, NULL::text AS category, NULL::text AS note
        FROM payments p
       WHERE p.property_id = ${propertyId}::uuid AND p.paid_at >= ${start} AND p.paid_at < ${end}
      UNION ALL
      SELECT 'REFUND'::text, x.id, x.created_at, p.method::text, NULL::text, x.amount, 'COMPLETED'::text,
             x.folio_id, NULL::text, NULL::text
        FROM refunds x
        JOIN payments p ON p.id = x.payment_id
        JOIN folios f ON f.id = x.folio_id
        JOIN reservation_items ri ON ri.id = f.reservation_item_id
        JOIN reservations r ON r.id = ri.reservation_id
       WHERE r.property_id = ${propertyId}::uuid AND x.created_at >= ${start} AND x.created_at < ${end}
      UNION ALL
      SELECT co.kind::text, co.id, co.occurred_at, co.method::text, co.method_to::text, co.amount,
             co.status::text, NULL::uuid, cc.name, co.note
        FROM cash_operations co
        LEFT JOIN cash_categories cc ON cc.id = co.category_id
       WHERE co.property_id = ${propertyId}::uuid AND co.occurred_at >= ${start} AND co.occurred_at < ${end}`;
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        kind: OperationKind;
        id: string;
        at: Date;
        local_at: string;
        method: PaymentMethod;
        method_to: PaymentMethod | null;
        amount: bigint;
        status: 'COMPLETED' | 'VOIDED';
        confirmation_number: string | null;
        first_name: string | null;
        last_name: string | null;
        reservations: bigint | null;
        category: string | null;
        note: string | null;
      }>
    >(Prisma.sql`
      WITH ops AS (${ops})
      SELECT o.kind, o.id, o.at, to_char(o.at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24:MI') AS local_at,
             o.method, o.method_to, o.amount, o.status, o.category, o.note,
             b.confirmation_number, b.first_name, b.last_name, b.reservations
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
         AND (${filter.source ?? null}::text IS NULL
              OR (CASE WHEN o.kind IN ('INCOME', 'EXPENSE', 'TRANSFER') THEN 'CASH' ELSE 'RESERVATIONS' END)
                 = ${filter.source ?? null}::text)
       ORDER BY o.at DESC, o.id
       LIMIT ${filter.limit}`);
    const summary = await this.prisma.db.$queryRaw<
      Array<{
        kind: OperationKind;
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
        methodTo: r.method_to,
        amountMinor: BigInt(r.amount),
        status: r.status,
        confirmationNumber: r.confirmation_number,
        reservations: Number(r.reservations ?? 0),
        guestLabel:
          r.first_name === null ? null : `${r.first_name} ${r.last_name ?? ''}`.trim() || null,
        category: r.category,
        note: r.note,
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
  async issueReceipt(paymentId: string, number: string, audit: AuditEntry): Promise<void> {
    const { id: propertyId } = await this.property();
    try {
      await this.prisma.db.$transaction(async (t) => {
        const tx = t as unknown as TxClient;
        const rows = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT "status"::text AS status FROM "payments"
           WHERE "id" = ${paymentId}::uuid AND "property_id" = ${propertyId}::uuid FOR UPDATE`;
        if (!rows[0]) throw new FinanceStateError('Платёж не найден');
        if (rows[0].status !== 'COMPLETED') throw new FinanceStateError('Платёж аннулирован');
        const existing = await tx.fiscalReceipt.findUnique({
          where: { paymentId },
          select: { number: true },
        });
        if (existing)
          throw new FinanceStateError(`Чек по этому платежу уже выдан: ${existing.number}`);
        const row = await tx.fiscalReceipt.create({
          data: { propertyId, paymentId, number, issuedById: auditUserId() ?? null },
          select: { id: true },
        });
        await writeAudit(tx, {
          ...audit,
          entityId: paymentId,
          after: { ...audit.after, receiptId: row.id },
        });
      });
    } catch (e) {
      // одновременная отметка с другого места: уникальный индекс страхует проверку выше
      if ((e as { code?: string }).code === 'P2002')
        throw new FinanceStateError('Чек по этому платежу уже выдан');
      throw e;
    }
  }
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
  // ── Касса (DATA_MODEL §21) ─────────────────────────────────────────────────────────────────────
  async cashBalanceSources(): Promise<CashBalanceSources> {
    const { id: propertyId } = await this.property();
    const payments = await this.prisma.db.payment.groupBy({
      by: ['method'],
      where: { propertyId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    // способ возврата — от платежа, с которого вернули (как в ленте операций)
    const refunds = await this.prisma.db.$queryRaw<Array<{ method: string; amount: bigint }>>`
      SELECT p.method::text AS method, SUM(x.amount)::bigint AS amount
        FROM refunds x
        JOIN payments p ON p.id = x.payment_id
       WHERE p.property_id = ${propertyId}::uuid
       GROUP BY p.method`;
    const operations = await this.prisma.db.cashOperation.groupBy({
      by: ['kind', 'method', 'methodTo'],
      where: { propertyId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    return {
      payments: payments.map((p) => ({ method: p.method, amountMinor: p._sum.amount ?? 0n })),
      refunds: refunds.map((r) => ({ method: r.method, amountMinor: BigInt(r.amount) })),
      operations: operations.map((o) => ({
        kind: o.kind,
        method: o.method,
        methodTo: o.methodTo,
        amountMinor: o._sum.amount ?? 0n,
      })),
    };
  }
  /** Стартовый набор статей (Q-236): список старой системы без «Расходы Хостел №2» — это другой объект */
  private static readonly DEFAULT_CASH_CATEGORIES: ReadonlyArray<{
    kind: 'INCOME' | 'EXPENSE';
    name: string;
  }> = [
    { kind: 'INCOME', name: 'Начальный остаток' },
    { kind: 'INCOME', name: 'Прочее поступление' },
    { kind: 'EXPENSE', name: 'Комиссия банка' },
    { kind: 'EXPENSE', name: 'Зарплата' },
    { kind: 'EXPENSE', name: 'Бытовые расходы' },
    { kind: 'EXPENSE', name: 'Ремонтные работы' },
    { kind: 'EXPENSE', name: 'Таргет/СММ/Инстаграм' },
    { kind: 'EXPENSE', name: 'Минибар' },
    { kind: 'EXPENSE', name: 'Чай/вода/сахар' },
    { kind: 'EXPENSE', name: 'Бытовая химия' },
    { kind: 'EXPENSE', name: 'Мероприятия' },
  ];
  async cashCategories(): Promise<CashCategoryRecord[]> {
    const { id: propertyId } = await this.property();
    const existing = await this.prisma.db.cashCategory.count({ where: { propertyId } });
    if (existing === 0)
      // новый объект получает набор при первом чтении; гонка двух чтений упрётся в уникальный ключ — не страшно
      await this.prisma.db.cashCategory
        .createMany({
          data: PrismaFinanceRepository.DEFAULT_CASH_CATEGORIES.map((c) => ({
            propertyId,
            ...c,
          })),
        })
        .catch(() => undefined);
    const rows = await this.prisma.db.cashCategory.findMany({
      where: { propertyId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    return rows.map((c) => ({
      id: c.id,
      kind: c.kind as 'INCOME' | 'EXPENSE',
      name: c.name,
      active: c.active,
    }));
  }
  async createCashCategory(
    c: { kind: 'INCOME' | 'EXPENSE'; name: string },
    audit?: AuditEntry,
  ): Promise<string> {
    const { id: propertyId } = await this.property();
    try {
      const row = await this.withAudit(audit, (tx) =>
        tx.cashCategory.create({
          data: { propertyId, kind: c.kind, name: c.name },
          select: { id: true },
        }),
      );
      return row.id;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new FinanceRuleError(`Статья «${c.name}» уже есть`);
      throw e;
    }
  }
  async updateCashCategory(
    id: string,
    patch: { name?: string; active?: boolean },
    audit?: AuditEntry,
  ): Promise<boolean> {
    const { id: propertyId } = await this.property();
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const [before] = await tx.$queryRaw<Array<{ name: string; active: boolean }>>`
          SELECT name, active FROM cash_categories
          WHERE id = ${id}::uuid AND property_id = ${propertyId}::uuid FOR UPDATE`;
        if (!before) return false;
        const after = await tx.cashCategory.update({ where: { id }, data: patch });
        if (audit)
          await writeAudit(tx as unknown as TxClient, {
            ...audit,
            before: { name: before.name, active: before.active },
            after: { name: after.name, active: after.active },
          });
        return true;
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new FinanceRuleError(`Статья «${patch.name}» уже есть`);
      throw e;
    }
  }
  async createCashOperation(op: NewCashOperation, audit?: AuditEntry): Promise<string> {
    const { id: propertyId } = await this.property();
    const row = await this.withAudit(audit, async (tx) => {
      const main = await tx.cashOperation.create({
        data: {
          propertyId,
          kind: op.kind,
          method: op.method,
          methodTo: op.methodTo,
          amount: op.amountMinor,
          categoryId: op.categoryId,
          note: op.note,
          createdById: auditUserId(),
          ...(op.occurredAt ? { occurredAt: new Date(op.occurredAt) } : {}),
        },
        select: { id: true, occurredAt: true },
      });
      if (op.commission)
        await tx.cashOperation.create({
          data: {
            propertyId,
            kind: 'EXPENSE',
            method: op.method,
            amount: op.commission.amountMinor,
            categoryId: op.commission.categoryId,
            note: 'Комиссия за операцию',
            relatedId: main.id,
            createdById: auditUserId(),
            occurredAt: main.occurredAt,
          },
        });
      return main;
    });
    return row.id;
  }
  async cashOperationById(id: string): Promise<CashOperationRecord | null> {
    const { id: propertyId } = await this.property();
    const o = await this.prisma.db.cashOperation.findFirst({ where: { id, propertyId } });
    if (!o) return null;
    const commission = await this.prisma.db.cashOperation.findFirst({
      where: { relatedId: id },
      select: { id: true },
    });
    return {
      id: o.id,
      kind: o.kind,
      method: o.method,
      methodTo: o.methodTo,
      amountMinor: o.amount,
      status: o.status,
      relatedId: o.relatedId,
      commissionId: commission?.id ?? null,
    };
  }
  async voidCashOperation(id: string, audit?: AuditEntry): Promise<void> {
    await this.locked(
      audit,
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT "status"::text AS status FROM "cash_operations" WHERE "id" = ${id}::uuid FOR UPDATE`;
        if (rows[0]?.status !== 'COMPLETED')
          throw new FinanceStateError('Операция уже аннулирована');
      },
      async (tx) => {
        await tx.cashOperation.updateMany({
          where: { OR: [{ id }, { relatedId: id }] },
          data: { status: 'VOIDED' },
        });
      },
    );
  }
  // ── Сверка кассы (§21.4) ──────────────────────────────────────────────────────────────────────
  async latestCashReconciliations(): Promise<CashReconciliationRecord[]> {
    const tz = await this.timezone();
    const { id: propertyId } = await this.property();
    const rows = await this.prisma.db.$queryRaw<
      Array<{
        method: PaymentMethod;
        at: Date;
        local_at: string;
        expected: bigint;
        counted: bigint;
        note: string | null;
      }>
    >`
      SELECT DISTINCT ON ("method") "method"::text AS method, "created_at" AS at,
             to_char("created_at" AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24:MI') AS local_at,
             "expected", "counted", "note"
        FROM "cash_reconciliations"
       WHERE "property_id" = ${propertyId}::uuid
       ORDER BY "method", "created_at" DESC`;
    return rows.map((r) => ({
      method: r.method,
      at: r.at.toISOString(),
      localAt: r.local_at,
      expectedMinor: BigInt(r.expected),
      countedMinor: BigInt(r.counted),
      note: r.note,
    }));
  }
  async createCashReconciliation(r: NewCashReconciliation, audit?: AuditEntry): Promise<string> {
    const { id: propertyId } = await this.property();
    const row = await this.withAudit(audit, async (tx) => {
      if (r.adjustment) {
        const category = await tx.cashCategory.upsert({
          where: {
            propertyId_kind_name: {
              propertyId,
              kind: r.adjustment.kind,
              name: r.adjustment.categoryName,
            },
          },
          update: { active: true },
          create: { propertyId, kind: r.adjustment.kind, name: r.adjustment.categoryName },
          select: { id: true },
        });
        await tx.cashOperation.create({
          data: {
            propertyId,
            kind: r.adjustment.kind,
            method: r.method,
            amount: r.adjustment.amountMinor,
            categoryId: category.id,
            note: 'Поправка по сверке кассы',
            createdById: auditUserId(),
          },
        });
      }
      return tx.cashReconciliation.create({
        data: {
          propertyId,
          method: r.method,
          expected: r.expectedMinor,
          counted: r.countedMinor,
          note: r.note,
          createdById: auditUserId(),
        },
        select: { id: true },
      });
    });
    return row.id;
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
