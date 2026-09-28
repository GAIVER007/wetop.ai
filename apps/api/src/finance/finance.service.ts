import 'reflect-metadata';
import { UnitsService } from '../units/units.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceRuleError,
  assertAllocationsMatch,
  assertRefundWithin,
  folioBalance,
  parseMoney,
  stayExtraDefaultMinor,
  stayExtraPercent,
  adjacentNight,
} from '@pms/domain';
import { freeTextForStorage, maskContacts } from '@pms/shared';
import {
  FINANCE_REPOSITORY,
  FolioBalanceError,
  FinanceStateError,
  FolioClosedError,
  MANUAL_CHARGE_KINDS,
  PAYMENT_METHODS,
  type ChargeKind,
  type FinanceRepository,
  type FolioRecord,
  type PaymentMethod,
} from './finance.repository';

/** Все суммы наружу — integer minor units строкой (BigInt в JSON не сериализуется). */
export interface ChargeView {
  id: string;
  kind: ChargeKind;
  serviceCode: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: string;
  amountMinor: string;
  serviceDate: string | null;
  createdAt: string;
  voidedAt: string | null;
}
export interface PaymentLineView {
  paymentId: string;
  method: PaymentMethod;
  status: 'COMPLETED' | 'VOIDED';
  paidAt: string;
  note: string | null;
  externalReference: string | null;
  paymentAmountMinor: string;
  /** сколько из этого платежа легло на этот счёт */
  allocatedMinor: string;
  /** сколько из этого платежа возвращено по этому счёту */
  refundedMinor: string;
}
export interface RefundView {
  id: string;
  paymentId: string;
  amountMinor: string;
  reason: string | null;
  createdAt: string;
}
export interface FolioView {
  id: string;
  reservationItemId: string;
  status: 'OPEN' | 'CLOSED';
  currency: string;
  stay: FolioRecord['stay'];
  charges: ChargeView[];
  payments: PaymentLineView[];
  refunds: RefundView[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  /** начислено − оплачено + возвращено: > 0 гость должен, < 0 переплата */
  balanceMinor: string;
}
export interface ReservationFinanceView {
  confirmationNumber: string;
  currency: string;
  folios: FolioView[];
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export interface PeriodReportView {
  from: string;
  to: string;
  currency: string;
  chargesByKind: Array<{ kind: string; count: number; amountMinor: string }>;
  paymentsByMethod: Array<{ method: string; count: number; amountMinor: string }>;
  refunds: { count: number; amountMinor: string };
  accommodationByCategory: Array<{ category: string; count: number; amountMinor: string }>;
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  /** начислено − оплачено + возвращено за период: сколько ещё не собрано */
  balanceMinor: string;
}
/** Строка списка «Брони с остатком к сбору» (ADR-107): остаток — по всем счетам брони, как на её карточке */
export interface DebtRowView {
  confirmationNumber: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  guestLabel: string | null;
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}
export interface PeriodDebtsView {
  from: string;
  to: string;
  currency: string;
  /** броней с остатком > 0 и сумма их остатков — по всем, не только по строкам ниже */
  count: number;
  balanceMinor: string;
  /** из них гость уже выехал, а остаток не оплачен */
  checkedOut: { count: number; balanceMinor: string };
  rows: DebtRowView[];
  /** строк больше, чем отдаёт ответ (`MAX_DEBT_ROWS`) */
  truncated: boolean;
}
/** Оплата или возврат за период (ADR-107, F2) — строка списка «Оплаты и возвраты» и выгрузки */
export interface OperationView {
  kind: 'PAYMENT' | 'REFUND';
  id: string;
  at: string;
  localAt: string;
  method: PaymentMethod;
  amountMinor: string;
  status: 'COMPLETED' | 'VOIDED';
  confirmationNumber: string | null;
  reservations: number;
  guestLabel: string | null;
}
export interface PeriodOperationsView {
  from: string;
  to: string;
  currency: string;
  /** строк по отбору — всех, не только отданных */
  total: number;
  /** по отбору: проведённые оплаты и возвраты; аннулированные оплаты не входят */
  paidMinor: string;
  refundedMinor: string;
  /** способы периода с числом операций — внутри отбора по типу, без отбора по способу */
  methods: Array<{ method: PaymentMethod; count: number }>;
  rows: OperationView[];
  truncated: boolean;
}
export interface ServiceView {
  code: string;
  nameRu: string;
  nameKz: string | null;
  priceMinor: string;
  group: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Предел периода сводки: год с запасом, как у отчёта по каналам — дальше это уже выгрузка, не экран */
const MAX_PERIOD_DAYS = 366;
const s = (x: bigint) => x.toString();
/** Потолок строк списка долгов: экран показывает 20 и «все»; за год должников больше не бывает (88 мест) */
const MAX_DEBT_ROWS = 500;
/** Строк операций за запрос: экран берёт 20 или все, выгрузка — до этого предела (год Luxx — около 12 000) */
const DEFAULT_OPERATION_ROWS = 50;
const MAX_OPERATION_ROWS = 20_000;
const OPERATION_TYPES = ['PAYMENT', 'REFUND'] as const;
/** Период отчёта: обе даты, по порядку, не длиннее `MAX_PERIOD_DAYS` */
function checkedPeriod(from?: string, to?: string): { from: string; to: string } {
  if (!from || !ISO.test(from) || !to || !ISO.test(to))
    throw new BadRequestException('from и to — даты YYYY-MM-DD');
  if (to < from) throw new BadRequestException('to не может быть раньше from');
  // Волна 4: без предела отчёт просили хоть за десять лет и собирали всю базу разом
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_PERIOD_DAYS)
    throw new BadRequestException(`Период до ${MAX_PERIOD_DAYS} дней включительно`);
  return { from, to };
}
/** Тиыны → «12 000,00 ₸» для сообщения администратору; без float. */
const formatMinorRu = (minor: bigint): string => {
  const neg = minor < 0n;
  const d = (neg ? -minor : minor).toString().padStart(3, '0');
  const int = d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${int},${d.slice(-2)} ₸`;
};

/** Сумма из запроса: «12000», «456.50», «-300,10» → minor units; иначе 400 */
function money(value: unknown, field: string): bigint {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new BadRequestException(`${field} — сумма, например 12000 или 456.50`);
  return rule(() => parseMoney(String(value)));
}
/**
 * Запись денег: правила, которые репозиторий проверяет под блокировкой строки (счёт открыт, предел возврата, нулевой
 * баланс при закрытии), отвечают теми же словами и кодами, что проверки сервиса до записи (аудит 26.09, С-25, С-2).
 */
async function lockedWrite<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (e) {
    if (e instanceof FinanceRuleError) throw new BadRequestException(e.message);
    if (e instanceof FolioClosedError) throw new ConflictException(`Счёт ${e.folioId} закрыт`);
    if (e instanceof FinanceStateError) throw new ConflictException(e.message);
    if (e instanceof FolioBalanceError)
      throw new ConflictException(
        `На счёте баланс ${formatMinorRu(e.balanceMinor)} — закрыть нельзя: ${
          e.balanceMinor > 0n ? 'примите оплату' : 'оформите возврат переплаты'
        }`,
      );
    throw e;
  }
}
function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof FinanceRuleError) throw new BadRequestException(e.message);
    throw e;
  }
}

export function folioView(f: FolioRecord): FolioView {
  const live = f.allocations.filter((a) => a.payment.status === 'COMPLETED');
  const b = folioBalance({
    charges: f.charges.map((c) => ({ amountMinor: c.amountMinor, voided: c.voidedAt !== null })),
    allocations: live.map((a) => ({ amountMinor: a.amountMinor })),
    refunds: f.refunds.map((r) => ({ amountMinor: r.amountMinor })),
  });
  const refundedBy = (paymentId: string) =>
    f.refunds.filter((r) => r.paymentId === paymentId).reduce((x, r) => x + r.amountMinor, 0n);
  return {
    id: f.id,
    reservationItemId: f.reservationItemId,
    status: f.status,
    currency: f.currency,
    stay: f.stay,
    charges: f.charges.map((c) => ({
      id: c.id,
      kind: c.kind,
      serviceCode: c.serviceCode,
      description: c.description,
      quantity: c.quantity,
      unitPriceMinor: s(c.unitPriceMinor),
      amountMinor: s(c.amountMinor),
      serviceDate: c.serviceDate,
      createdAt: c.createdAt,
      voidedAt: c.voidedAt,
    })),
    payments: f.allocations.map((a) => ({
      paymentId: a.paymentId,
      method: a.payment.method,
      status: a.payment.status,
      paidAt: a.payment.paidAt,
      note: a.payment.note,
      externalReference: a.payment.externalReference,
      paymentAmountMinor: s(a.payment.amountMinor),
      allocatedMinor: s(a.amountMinor),
      refundedMinor: s(refundedBy(a.paymentId)),
    })),
    refunds: f.refunds.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      amountMinor: s(r.amountMinor),
      reason: r.reason,
      createdAt: r.createdAt,
    })),
    chargedMinor: s(b.chargedMinor),
    paidMinor: s(b.paidMinor),
    refundedMinor: s(b.refundedMinor),
    balanceMinor: s(b.balanceMinor),
  };
}

type StayExtra = 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT';
/** ADR-021: доплаты за соседнюю ночь. description — текст начисления и начало причины блока этой ночи */
const STAY_EXTRAS: Record<
  StayExtra,
  { description: string; date: (st: FolioRecord['stay']) => string }
> = {
  EARLY_CHECK_IN: { description: 'Ранний заезд', date: (st) => st.arrivalDate },
  LATE_CHECK_OUT: { description: 'Поздний выезд', date: (st) => st.departureDate },
};
/** Причина блока соседней ночи; по ней же блок снимают отмена брони (releaseStayExtraBlocks) и сторно (Б7) */
const stayExtraBlockReason = (description: string, confirmationNumber: string) =>
  `${description}, бронь ${confirmationNumber}`;
/** Начисление — доплата за соседнюю ночь? Ручная услуга с тем же текстом тоже SERVICE, но блока у неё нет */
function stayExtraByDescription(c: { kind: string; description: string }): StayExtra | null {
  if (c.kind !== 'SERVICE') return null;
  const hit = (Object.keys(STAY_EXTRAS) as StayExtra[]).find(
    (k) => STAY_EXTRAS[k].description === c.description,
  );
  return hit ?? null;
}

/**
 * Счета гостя (DATA_MODEL §6, ADR-014): счёт на проживание, начисление «проживание» ведёт система,
 * услуги / штрафы / корректировки — стойка; платёж распределяется по счетам полностью;
 * возврат — только из платежа, который на этот счёт ложился.
 */
@Injectable()
export class FinanceService {
  constructor(
    @Inject(FINANCE_REPOSITORY) private readonly repo: FinanceRepository,
    @Inject(UnitsService) private readonly units: UnitsService,
  ) {}

  async reservation(confirmationNumber: string): Promise<ReservationFinanceView> {
    const folios = await this.repo.foliosByReservation(confirmationNumber);
    if (!folios) throw new NotFoundException(`Бронь ${confirmationNumber} не найдена`);
    const views = folios.map(folioView);
    const sum = (k: 'chargedMinor' | 'paidMinor' | 'refundedMinor' | 'balanceMinor') =>
      s(views.reduce((x, v) => x + BigInt(v[k]), 0n));
    return {
      confirmationNumber,
      currency: views[0]?.currency ?? 'KZT',
      folios: views,
      chargedMinor: sum('chargedMinor'),
      paidMinor: sum('paidMinor'),
      refundedMinor: sum('refundedMinor'),
      balanceMinor: sum('balanceMinor'),
    };
  }

  /** T4 «Финансовый учёт период»: начисления, оплаты и возвраты за период в разрезах. */
  async periodReport(fromParam?: string, toParam?: string): Promise<PeriodReportView> {
    const { from, to } = checkedPeriod(fromParam, toParam);
    const r = await this.repo.periodReport(from, to);
    const sum = (xs: Array<{ amountMinor: bigint }>) => xs.reduce((a, x) => a + x.amountMinor, 0n);
    const charged = sum(r.chargesByKind);
    const paid = sum(r.paymentsByMethod);
    return {
      from,
      to,
      currency: 'KZT',
      chargesByKind: r.chargesByKind.map((x) => ({
        kind: x.kind,
        count: x.count,
        amountMinor: s(x.amountMinor),
      })),
      paymentsByMethod: r.paymentsByMethod.map((x) => ({
        method: x.method,
        count: x.count,
        amountMinor: s(x.amountMinor),
      })),
      refunds: { count: r.refunds.count, amountMinor: s(r.refunds.amountMinor) },
      accommodationByCategory: r.accommodationByCategory.map((x) => ({
        category: x.category,
        count: x.count,
        amountMinor: s(x.amountMinor),
      })),
      chargedMinor: s(charged),
      paidMinor: s(paid),
      refundedMinor: s(r.refunds.amountMinor),
      balanceMinor: s(charged - paid + r.refunds.amountMinor),
    };
  }

  /**
   * «Брони с остатком к сбору» (ADR-107): брони с начислением в периоде, у которых остаток по всему счёту больше
   * нуля. Остаток считает тот же `folioBalance`, что карточка и список броней, — числа везде одни. Крупные долги
   * первыми, равные — по дате заезда. Ровно оплаченные и переплаты в список не входят.
   */
  async periodDebts(fromParam?: string, toParam?: string): Promise<PeriodDebtsView> {
    const { from, to } = checkedPeriod(fromParam, toParam);
    const debts = (await this.repo.periodDebts(from, to))
      .map((r) => ({
        ...r,
        balance: folioBalance({
          charges: [{ amountMinor: r.chargedMinor, voided: false }],
          allocations: [{ amountMinor: r.paidMinor }],
          refunds: [{ amountMinor: r.refundedMinor }],
        }).balanceMinor,
      }))
      .filter((r) => r.balance > 0n)
      .sort(
        (a, b) =>
          (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1) ||
          a.arrivalDate.localeCompare(b.arrivalDate) ||
          a.confirmationNumber.localeCompare(b.confirmationNumber),
      );
    const total = (xs: typeof debts) => xs.reduce((a, x) => a + x.balance, 0n);
    const left = debts.filter((r) => r.status === 'CHECKED_OUT');
    return {
      from,
      to,
      currency: 'KZT',
      count: debts.length,
      balanceMinor: s(total(debts)),
      checkedOut: { count: left.length, balanceMinor: s(total(left)) },
      rows: debts.slice(0, MAX_DEBT_ROWS).map((r) => ({
        confirmationNumber: r.confirmationNumber,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        guestLabel: r.guestLabel,
        chargedMinor: s(r.chargedMinor),
        paidMinor: s(r.paidMinor),
        refundedMinor: s(r.refundedMinor),
        balanceMinor: s(r.balance),
      })),
      truncated: debts.length > MAX_DEBT_ROWS,
    };
  }

  /**
   * Оплаты и возвраты за период (ADR-107, F2). Отбор по типу и способу применяется к строкам и суммам; числа на
   * чипах способов считаются без отбора по способу, чтобы соседний способ было видно. «Оплачено» по списку без
   * отборов равно «Оплачено» в сводке: те же проведённые платежи по дате оплаты.
   */
  async periodOperations(
    fromParam?: string,
    toParam?: string,
    query: { type?: string; method?: string; limit?: string } = {},
  ): Promise<PeriodOperationsView> {
    const { from, to } = checkedPeriod(fromParam, toParam);
    const type = query.type || undefined;
    const method = query.method || undefined;
    if (type !== undefined && !(OPERATION_TYPES as readonly string[]).includes(type))
      throw new BadRequestException('type — PAYMENT или REFUND');
    if (method !== undefined && !PAYMENT_METHODS.includes(method as PaymentMethod))
      throw new BadRequestException(`method — один из: ${PAYMENT_METHODS.join(', ')}`);
    const limit =
      query.limit === undefined || query.limit === ''
        ? DEFAULT_OPERATION_ROWS
        : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_OPERATION_ROWS)
      throw new BadRequestException(`limit — целое от 1 до ${MAX_OPERATION_ROWS}`);
    const r = await this.repo.periodOperations(from, to, {
      ...(type ? { type: type as 'PAYMENT' | 'REFUND' } : {}),
      ...(method ? { method: method as PaymentMethod } : {}),
      limit,
    });
    const ofType = r.summary.filter((x) => !type || x.kind === type);
    const picked = ofType.filter((x) => !method || x.method === method);
    const sum = (xs: typeof picked) => xs.reduce((a, x) => a + x.amountMinor, 0n);
    const counts = new Map<PaymentMethod, number>();
    for (const x of ofType) counts.set(x.method, (counts.get(x.method) ?? 0) + x.count);
    const total = picked.reduce((a, x) => a + x.count, 0);
    return {
      from,
      to,
      currency: 'KZT',
      total,
      paidMinor: s(sum(picked.filter((x) => x.kind === 'PAYMENT' && x.status === 'COMPLETED'))),
      refundedMinor: s(sum(picked.filter((x) => x.kind === 'REFUND'))),
      methods: [...counts]
        .map(([m, count]) => ({ method: m, count }))
        .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method)),
      rows: r.rows.map((x) => ({ ...x, amountMinor: s(x.amountMinor) })),
      truncated: total > r.rows.length,
    };
  }

  async services(): Promise<ServiceView[]> {
    return (await this.repo.services()).map((x) => ({
      code: x.code,
      nameRu: x.nameRu,
      nameKz: x.nameKz,
      priceMinor: s(x.priceMinor),
      group: x.group,
    }));
  }

  private async openFolio(id: string): Promise<FolioRecord> {
    const f = await this.repo.folioById(id);
    if (!f) throw new NotFoundException(`Счёт ${id} не найден`);
    if (f.status !== 'OPEN') throw new ConflictException(`Счёт ${id} закрыт`);
    return f;
  }

  /**
   * Закрыть счёт вручную — например, гость рассчитался до выезда или после выселения с долгом.
   * Только при нулевом балансе: долг или переплата должны быть закрыты оплатой или возвратом, иначе деньги
   * повиснут на закрытом счёте. При выезде без долга счёт закрывается сам (reservations.checkOut).
   */
  async closeFolio(folioId: string): Promise<ReservationFinanceView> {
    const folio = await this.openFolio(folioId);
    const balance = BigInt(folioView(folio).balanceMinor);
    if (balance !== 0n)
      throw new ConflictException(
        `На счёте баланс ${formatMinorRu(balance)} — закрыть нельзя: ${
          balance > 0n ? 'примите оплату' : 'оформите возврат переплаты'
        }`,
      );
    await lockedWrite(
      this.repo.closeFolio(folioId, {
        entityType: 'Folio',
        entityId: folioId,
        action: 'finance.folio.close',
        before: { status: 'OPEN' },
        after: {
          status: 'CLOSED',
          balanceMinor: '0',
        },
      }),
    );
    return this.reservation(folio.confirmationNumber);
  }

  /** Ручное начисление: услуга (цена и название из справочника), штраф, корректировка (может быть отрицательной). */
  async addCharge(
    folioId: string,
    dto: {
      kind?: string;
      serviceCode?: string;
      description?: string;
      quantity?: number | string;
      unitPrice?: string | number;
      serviceDate?: string;
    },
  ): Promise<ReservationFinanceView> {
    if (!dto.kind || !MANUAL_CHARGE_KINDS.includes(dto.kind as ChargeKind))
      throw new BadRequestException(
        `kind — один из ${MANUAL_CHARGE_KINDS.join(', ')} (проживание начисляет система)`,
      );
    const kind = dto.kind as ChargeKind;
    const quantity = dto.quantity === undefined ? 1 : Number(dto.quantity);
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new BadRequestException('quantity — целое число от 1');
    const serviceDate = dto.serviceDate ?? (await this.repo.today());
    if (!ISO.test(serviceDate)) throw new BadRequestException('serviceDate — дата YYYY-MM-DD');
    const folio = await this.openFolio(folioId);

    let serviceId: string | null = null;
    // Q-169: пока база не в РК, почта и телефоны в тексте, который набирает стойка, маскируются
    let description = freeTextForStorage(dto.description?.trim() ?? '') ?? '';
    let unitPriceMinor: bigint;
    if (kind === 'SERVICE') {
      if (!dto.serviceCode) throw new BadRequestException('serviceCode — услуга из справочника');
      const svc = (await this.repo.services()).find((x) => x.code === dto.serviceCode);
      if (!svc)
        throw new BadRequestException(`Услуга «${dto.serviceCode}» не найдена в справочнике`);
      serviceId = svc.id;
      if (!description) description = svc.nameRu;
      unitPriceMinor =
        dto.unitPrice === undefined ? svc.priceMinor : money(dto.unitPrice, 'unitPrice');
    } else {
      if (!description) throw new BadRequestException('description — за что начисление');
      unitPriceMinor = money(dto.unitPrice, 'unitPrice');
    }
    if (kind === 'ADJUSTMENT' ? unitPriceMinor === 0n : unitPriceMinor <= 0n)
      throw new BadRequestException(
        kind === 'ADJUSTMENT'
          ? 'Корректировка не может быть нулевой'
          : 'Цена должна быть больше нуля',
      );
    const amountMinor = unitPriceMinor * BigInt(quantity);
    await lockedWrite(
      this.repo.addCharge(
        folioId,
        { kind, serviceId, description, quantity, unitPriceMinor, amountMinor, serviceDate },
        {
          entityType: 'Folio',
          entityId: folioId,
          action: 'finance.charge',
          idField: 'chargeId',
          after: {
            kind,
            description,
            quantity,
            unitPriceMinor: s(unitPriceMinor),
            amountMinor: s(amountMinor),
            serviceDate,
          },
        },
      ),
    );
    return this.reservation(folio.confirmationNumber);
  }

  /**
   * ADR-021: ранний заезд и поздний выезд — услуга на счёте одной командой. Сумма по умолчанию — половина
   * цены ночи этого проживания (цена берётся из действующего начисления за проживание), можно задать свою.
   * Даты и ячейка не меняются: гость занимает ту же койку.
   */
  async addStayExtra(
    folioId: string,
    dto: { extra?: string; unitPrice?: string | number; time?: string },
  ): Promise<ReservationFinanceView> {
    const spec = STAY_EXTRAS[dto.extra as StayExtra];
    if (!spec) throw new BadRequestException('extra — EARLY_CHECK_IN или LATE_CHECK_OUT');
    const folio = await this.openFolio(folioId);
    const nights = Math.round(
      (Date.parse(`${folio.stay.departureDate}T00:00:00Z`) -
        Date.parse(`${folio.stay.arrivalDate}T00:00:00Z`)) /
        86_400_000,
    );
    const accommodation = folio.charges
      .filter((c) => c.kind === 'ACCOMMODATION' && c.voidedAt === null)
      .reduce((sum, c) => sum + c.amountMinor, 0n);
    // Правило объекта из Exely: доля ночи зависит от времени; без времени — половина ночи
    let percent: 0 | 50 | 100 = 50;
    if (dto.time !== undefined) {
      try {
        percent = stayExtraPercent(dto.extra as 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT', dto.time);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
      if (percent === 0 && dto.unitPrice === undefined)
        throw new BadRequestException(
          `${spec.description} в ${dto.time} по правилу объекта бесплатен — начислять нечего`,
        );
    }
    const halfNight = stayExtraDefaultMinor(accommodation, nights);
    const byRule = percent === 100 ? halfNight * 2n : percent === 50 ? halfNight : 0n;
    const unitPriceMinor = dto.unitPrice === undefined ? byRule : money(dto.unitPrice, 'unitPrice');
    if (unitPriceMinor <= 0n)
      throw new BadRequestException(
        'Сумма должна быть больше нуля: у проживания нет цены, задайте сумму услуги',
      );
    const serviceDate = spec.date(folio.stay);
    // Как в Exely («выделять доступность: да»): соседняя ночь на этой койке не продаётся. Блок ставится
    // командой ячейки — она сама откажет, если на ту ночь уже есть проживание, и разошлёт остаток в канал.
    const unit = await this.repo.stayUnitCode(folio.reservationItemId);
    if (unit) {
      const night = adjacentNight(
        dto.extra as 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT',
        folio.stay.arrivalDate,
        folio.stay.departureDate,
      );
      try {
        await this.units.block(unit.code, {
          dateFrom: night.from,
          dateTo: night.toExclusive,
          type: 'OTHER',
          reason: stayExtraBlockReason(spec.description, folio.confirmationNumber),
        });
      } catch (e) {
        if (e instanceof ConflictException)
          throw new ConflictException(
            `${spec.description} невозможен: койка ${unit.code} занята в ночь ${night.from}. ${e.message}`,
          );
        throw e;
      }
    }
    await lockedWrite(
      this.repo.addCharge(
        folioId,
        {
          kind: 'SERVICE',
          serviceId: null,
          description: spec.description,
          quantity: 1,
          unitPriceMinor,
          amountMinor: unitPriceMinor,
          serviceDate,
        },
        {
          entityType: 'Folio',
          entityId: folioId,
          action: 'finance.stayExtra',
          idField: 'chargeId',
          after: {
            extra: dto.extra,
            time: dto.time ?? null,
            percent,
            amountMinor: s(unitPriceMinor),
            serviceDate,
            defaultUsed: dto.unitPrice === undefined,
          },
        },
      ),
    );
    return this.reservation(folio.confirmationNumber);
  }

  async voidCharge(chargeId: string): Promise<ReservationFinanceView> {
    const c = await this.repo.chargeById(chargeId);
    if (!c) throw new NotFoundException(`Начисление ${chargeId} не найдено`);
    if (c.voidedAt) throw new ConflictException('Начисление уже сторнировано');
    if (c.kind === 'ACCOMMODATION')
      throw new ConflictException(
        'Начисление за проживание ведёт система: измените даты или отмените проживание',
      );
    const folio = await this.openFolio(c.folioId);
    // Б7: доплата за соседнюю ночь ставила блок на эту ночь — без него сторно оставило бы койку непродаваемой.
    // Снимаем до сторно: не снялся — ничего не сторнировано, повтор безопасен.
    const extra = stayExtraByDescription(c);
    let releasedBlock: { unitCode: string; dateFrom: string } | null = null;
    if (extra) {
      const candidates = await this.repo.stayExtraBlocks(
        stayExtraBlockReason(c.description, folio.confirmationNumber),
      );
      const night = adjacentNight(extra, folio.stay.arrivalDate, folio.stay.departureDate);
      const block = candidates.find((b) => b.dateFrom === night.from) ?? candidates[0];
      if (block) {
        await this.units.unblock(block.unitCode, block.id);
        releasedBlock = { unitCode: block.unitCode, dateFrom: block.dateFrom };
      }
    }
    await lockedWrite(
      this.repo.voidCharge(chargeId, {
        entityType: 'Folio',
        entityId: c.folioId,
        action: 'finance.charge.void',
        before: {
          chargeId,
          kind: c.kind,
          description: c.description,
          amountMinor: s(c.amountMinor),
          ...(extra ? { releasedBlock } : {}),
        },
        // Сторно: состояние «до» — само начисление, «после» — его больше нет
        after: { voided: true },
      }),
    );
    return this.reservation(folio.confirmationNumber);
  }

  /** Платёж одним из 9 способов, распределённый по счетам без остатка (все счета в одной валюте). */
  async createPayment(dto: {
    method?: string;
    amount?: string | number;
    currency?: string;
    paidAt?: string;
    note?: string | null;
    allocations?: Array<{ folioId?: string; amount?: string | number }>;
  }): Promise<ReservationFinanceView> {
    if (!dto.method || !PAYMENT_METHODS.includes(dto.method as PaymentMethod))
      throw new BadRequestException(`method — один из ${PAYMENT_METHODS.join(', ')}`);
    const amountMinor = money(dto.amount, 'amount');
    if (!Array.isArray(dto.allocations))
      throw new BadRequestException('allocations — список { folioId, amount }');
    const allocations = dto.allocations.map((a) => {
      if (!a || typeof a.folioId !== 'string' || !a.folioId)
        throw new BadRequestException('allocations[].folioId — id счёта');
      return { folioId: a.folioId, amountMinor: money(a.amount, 'allocations[].amount') };
    });
    rule(() => assertAllocationsMatch(amountMinor, allocations));
    if (dto.paidAt !== undefined && Number.isNaN(Date.parse(dto.paidAt)))
      throw new BadRequestException('paidAt — дата-время ISO 8601');
    const folios: FolioRecord[] = [];
    for (const a of allocations) folios.push(await this.openFolio(a.folioId));
    const currency = folios[0]!.currency;
    if (folios.some((f) => f.currency !== currency))
      throw new BadRequestException('Счета в одном платеже должны быть в одной валюте');
    if (dto.currency !== undefined && dto.currency !== currency)
      throw new BadRequestException(`Валюта платежа должна быть ${currency}`);
    await lockedWrite(
      this.repo.createPayment(
        {
          method: dto.method as PaymentMethod,
          amountMinor,
          currency,
          paidAt: dto.paidAt ?? null,
          note: freeTextForStorage(dto.note?.trim() || null),
          allocations,
        },
        {
          // id платежа известен только после вставки — его подставит репозиторий в той же транзакции
          entityType: 'Payment',
          action: 'finance.payment',
          after: {
            method: dto.method,
            amountMinor: s(amountMinor),
            currency,
            allocations: allocations.map((a) => ({
              folioId: a.folioId,
              amountMinor: s(a.amountMinor),
            })),
          },
        },
      ),
    );
    return this.reservation(folios[0]!.confirmationNumber);
  }

  /** Возврат по счёту из конкретного платежа: не больше, чем он на этот счёт внёс, минус уже возвращённое. */
  async refund(
    paymentId: string,
    dto: { folioId?: string; amount?: string | number; reason?: string | null },
  ): Promise<ReservationFinanceView> {
    const p = await this.repo.paymentById(paymentId);
    if (!p) throw new NotFoundException(`Платёж ${paymentId} не найден`);
    if (p.status !== 'COMPLETED') throw new ConflictException('Платёж аннулирован');
    if (!dto.folioId) throw new BadRequestException('folioId — счёт, по которому возврат');
    const alloc = p.allocations.find((a) => a.folioId === dto.folioId);
    if (!alloc) throw new BadRequestException('Этот платёж на указанный счёт не распределялся');
    const refundMinor = money(dto.amount, 'amount');
    const refundedMinor = p.refunds
      .filter((r) => r.folioId === dto.folioId)
      .reduce((x, r) => x + r.amountMinor, 0n);
    rule(() =>
      assertRefundWithin({ allocatedMinor: alloc.amountMinor, refundedMinor, refundMinor }),
    );
    const folio = await this.openFolio(dto.folioId);
    // Одна маска для таблицы и журнала: в журнал раньше уходил сырой текст (аудит 26.09, С-39)
    const reason = freeTextForStorage(dto.reason?.trim() || null);
    await lockedWrite(
      this.repo.createRefund(
        {
          paymentId,
          folioId: dto.folioId,
          amountMinor: refundMinor,
          reason,
        },
        {
          entityType: 'Payment',
          entityId: paymentId,
          action: 'finance.refund',
          idField: 'refundId',
          after: {
            folioId: dto.folioId,
            amountMinor: s(refundMinor),
            // в журнал — с маской контактов и при PII_STORAGE=real: журнал только дописывается
            reason: reason === null ? null : maskContacts(reason),
          },
        },
      ),
    );
    return this.reservation(folio.confirmationNumber);
  }
}
