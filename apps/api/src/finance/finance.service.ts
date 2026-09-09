import 'reflect-metadata';
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
  constructor(@Inject(FINANCE_REPOSITORY) private readonly repo: FinanceRepository) {}

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
