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
import {
  FINANCE_REPOSITORY,
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
export interface ServiceView {
  code: string;
  nameRu: string;
  nameKz: string | null;
  priceMinor: string;
  group: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const s = (x: bigint) => x.toString();
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
  async periodReport(from?: string, to?: string): Promise<PeriodReportView> {
    if (!from || !ISO.test(from) || !to || !ISO.test(to))
      throw new BadRequestException('from и to — даты YYYY-MM-DD');
    if (to < from) throw new BadRequestException('to не может быть раньше from');
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
    await this.repo.closeFolio(folioId);
    await this.repo.audit(
      'Folio',
      folioId,
      'finance.folio.close',
      { status: 'OPEN' },
      {
        status: 'CLOSED',
        balanceMinor: '0',
      },
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
    const serviceDate = dto.serviceDate ?? today();
    if (!ISO.test(serviceDate)) throw new BadRequestException('serviceDate — дата YYYY-MM-DD');
    const folio = await this.openFolio(folioId);

    let serviceId: string | null = null;
    let description = dto.description?.trim() ?? '';
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
    const id = await this.repo.addCharge(folioId, {
      kind,
      serviceId,
      description,
      quantity,
      unitPriceMinor,
      amountMinor,
      serviceDate,
    });
    await this.repo.audit('Folio', folioId, 'finance.charge', null, {
      chargeId: id,
      kind,
      description,
      quantity,
      unitPriceMinor: s(unitPriceMinor),
      amountMinor: s(amountMinor),
      serviceDate,
    });
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
    const EXTRAS = {
      EARLY_CHECK_IN: {
        description: 'Ранний заезд',
        date: (st: FolioRecord['stay']) => st.arrivalDate,
      },
      LATE_CHECK_OUT: {
        description: 'Поздний выезд',
        date: (st: FolioRecord['stay']) => st.departureDate,
      },
    } as const;
    const spec = EXTRAS[dto.extra as keyof typeof EXTRAS];
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
          reason: `${spec.description}, бронь ${folio.confirmationNumber}`,
        });
      } catch (e) {
        if (e instanceof ConflictException)
          throw new ConflictException(
            `${spec.description} невозможен: койка ${unit.code} занята в ночь ${night.from}. ${e.message}`,
          );
        throw e;
      }
    }
    const id = await this.repo.addCharge(folioId, {
      kind: 'SERVICE',
      serviceId: null,
      description: spec.description,
      quantity: 1,
      unitPriceMinor,
      amountMinor: unitPriceMinor,
      serviceDate,
    });
    await this.repo.audit('Folio', folioId, 'finance.stayExtra', null, {
      chargeId: id,
      extra: dto.extra,
      time: dto.time ?? null,
      percent,
      amountMinor: s(unitPriceMinor),
      serviceDate,
      defaultUsed: dto.unitPrice === undefined,
    });
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
    await this.repo.voidCharge(chargeId);
    await this.repo.audit(
      'Folio',
      c.folioId,
      'finance.charge.void',
      {
        chargeId,
        kind: c.kind,
        description: c.description,
        amountMinor: s(c.amountMinor),
      },
      null,
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
    const id = await this.repo.createPayment({
      method: dto.method as PaymentMethod,
      amountMinor,
      currency,
      paidAt: dto.paidAt ?? null,
      note: dto.note?.trim() || null,
      allocations,
    });
    await this.repo.audit('Payment', id, 'finance.payment', null, {
      method: dto.method,
      amountMinor: s(amountMinor),
      currency,
      allocations: allocations.map((a) => ({ folioId: a.folioId, amountMinor: s(a.amountMinor) })),
    });
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
    const id = await this.repo.createRefund({
      paymentId,
      folioId: dto.folioId,
      amountMinor: refundMinor,
      reason: dto.reason?.trim() || null,
    });
    await this.repo.audit('Payment', paymentId, 'finance.refund', null, {
      refundId: id,
      folioId: dto.folioId,
      amountMinor: s(refundMinor),
      reason: dto.reason ?? null,
    });
    return this.reservation(folio.confirmationNumber);
  }
}
