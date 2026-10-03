import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parsePaymentRequestInput, type PaymentRequestMethod } from '@pms/domain';
import { freeTextForStorage } from '@pms/shared';
import {
  FINANCE_REPOSITORY,
  FinanceStateError,
  FolioClosedError,
  type FinanceRepository,
} from './finance.repository';
import {
  PAYMENT_REQUESTS_REPOSITORY,
  type PaymentRequestRecord,
  type PaymentRequestsRepository,
} from './payment-requests.repository';

export interface PaymentRequestView {
  id: string;
  folioId: string;
  amountMinor: string;
  currency: string;
  method: PaymentRequestMethod;
  link: string | null;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentId: string | null;
  note: string | null;
  createdAt: string;
  closedAt: string | null;
}
export interface PaymentRequestsView {
  confirmationNumber: string;
  /** Название объекта для текста гостю */
  propertyName: string;
  requests: PaymentRequestView[];
}

const view = (r: PaymentRequestRecord): PaymentRequestView => ({
  ...r,
  amountMinor: r.amountMinor.toString(),
});

/** Ошибки записи под блокировкой — теми же словами и кодами, что у платежей (аудит 26.09, С-25) */
async function lockedWrite<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (e) {
    if (e instanceof FolioClosedError) throw new ConflictException(`Счёт ${e.folioId} закрыт`);
    if (e instanceof FinanceStateError) throw new ConflictException(e.message);
    throw e;
  }
}

/** Запросы оплаты (DATA_MODEL §23, ADR-143): счёт Kaspi по телефону, ссылка банка или перевод в брони */
@Injectable()
export class PaymentRequestsService {
  constructor(
    @Inject(PAYMENT_REQUESTS_REPOSITORY) private readonly repo: PaymentRequestsRepository,
    @Inject(FINANCE_REPOSITORY) private readonly finance: FinanceRepository,
  ) {}

  async list(confirmationNumber: string): Promise<PaymentRequestsView> {
    const rows = await this.repo.byReservation(confirmationNumber);
    if (!rows) throw new NotFoundException(`Бронь ${confirmationNumber} не найдена`);
    return {
      confirmationNumber,
      propertyName: await this.repo.propertyName(),
      requests: rows.map(view),
    };
  }

  async create(
    confirmationNumber: string,
    dto: { folioId?: unknown; method?: unknown; amount?: unknown; link?: unknown; note?: unknown },
  ): Promise<PaymentRequestsView> {
    const folios = await this.finance.foliosByReservation(confirmationNumber);
    if (!folios) throw new NotFoundException(`Бронь ${confirmationNumber} не найдена`);
    const folio = folios.find((f) => f.id === dto?.folioId);
    if (!folio) throw new BadRequestException('folioId: счёт проживания этой брони');
    if (folio.status !== 'OPEN') throw new ConflictException(`Счёт ${folio.id} закрыт`);
    const parsed = parsePaymentRequestInput(dto);
    if (!parsed.ok) throw new BadRequestException(parsed.reason);
    const { method, amountMinor, link } = parsed.value;
    const note = freeTextForStorage(parsed.value.note);
    await lockedWrite(
      this.repo.create(
        { folioId: folio.id, amountMinor, currency: folio.currency, method, link, note },
        {
          entityType: 'PaymentRequest',
          action: 'finance.payment_request.created',
          // ссылка банка в журнал не пишется: в ней бывает одноразовый токен оплаты
          after: {
            folioId: folio.id,
            method,
            amountMinor: amountMinor.toString(),
            hasLink: link !== null,
          },
        },
      ),
    );
    return this.list(confirmationNumber);
  }

  async markPaid(id: string, dto: { paidAt?: unknown }): Promise<PaymentRequestsView> {
    const r = await this.repo.byId(id);
    if (!r) throw new NotFoundException(`Запрос оплаты ${id} не найден`);
    let paidAt: string | null = null;
    if (dto?.paidAt !== undefined && dto.paidAt !== null && dto.paidAt !== '') {
      if (typeof dto.paidAt !== 'string' || Number.isNaN(Date.parse(dto.paidAt)))
        throw new BadRequestException('paidAt — дата-время ISO 8601');
      paidAt = dto.paidAt;
    }
    await lockedWrite(
      this.repo.markPaid(id, paidAt, {
        entityType: 'PaymentRequest',
        action: 'finance.payment_request.paid',
        before: { status: 'PENDING' },
        after: { status: 'PAID', method: r.method, amountMinor: r.amountMinor.toString() },
      }),
    );
    return this.list(r.confirmationNumber);
  }

  async cancel(id: string): Promise<PaymentRequestsView> {
    const r = await this.repo.byId(id);
    if (!r) throw new NotFoundException(`Запрос оплаты ${id} не найден`);
    await lockedWrite(
      this.repo.cancel(id, {
        entityType: 'PaymentRequest',
        action: 'finance.payment_request.cancelled',
        before: { status: 'PENDING' },
        after: { status: 'CANCELLED' },
      }),
    );
    return this.list(r.confirmationNumber);
  }
}
