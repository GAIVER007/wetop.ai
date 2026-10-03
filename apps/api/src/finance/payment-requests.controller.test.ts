import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FINANCE_REPOSITORY, FinanceStateError, FolioClosedError } from './finance.repository';
import { PaymentRequestsController } from './payment-requests.controller';
import {
  PAYMENT_REQUESTS_REPOSITORY,
  type NewPaymentRequest,
  type PaymentRequestRecord,
} from './payment-requests.repository';
import { PaymentRequestsService } from './payment-requests.service';

/** Запросы оплаты на фальшивках (DATA_MODEL §23, ADR-143); транзакцию «платёж + закрытие» доказывает integration */
const FOLIO = { id: '00000000-0000-4000-8000-0000000000f1', status: 'OPEN', currency: 'KZT' };
const CLOSED = { id: '00000000-0000-4000-8000-0000000000f2', status: 'CLOSED', currency: 'KZT' };

class FakeRequests {
  rows: Array<PaymentRequestRecord & { confirmationNumber: string }> = [];
  audits: Array<{ action: string; after: Record<string, unknown> }> = [];
  payments = 0;
  async propertyName() {
    return 'Хостел Тест';
  }
  async byReservation(n: string) {
    return n === 'R-1' ? this.rows.filter((r) => r.confirmationNumber === n) : null;
  }
  async byId(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async create(r: NewPaymentRequest, audit: { action: string; after: Record<string, unknown> }) {
    if (r.folioId === CLOSED.id) throw new FolioClosedError(r.folioId);
    const id = `00000000-0000-4000-8000-00000000000${this.rows.length + 1}`;
    this.rows.push({
      ...r,
      id,
      status: 'PENDING',
      paymentId: null,
      createdAt: '2026-10-03T10:00:00.000Z',
      closedAt: null,
      confirmationNumber: 'R-1',
    });
    this.audits.push(audit);
    return id;
  }
  async markPaid(id: string) {
    const r = this.rows.find((x) => x.id === id)!;
    if (r.status !== 'PENDING') throw new FinanceStateError('Запрос уже оплачен');
    this.payments += 1;
    r.status = 'PAID';
    r.paymentId = 'pay-1';
    r.closedAt = '2026-10-03T11:00:00.000Z';
    return 'pay-1';
  }
  async cancel(id: string) {
    const r = this.rows.find((x) => x.id === id)!;
    if (r.status !== 'PENDING')
      throw new FinanceStateError(
        'Оплаченный запрос не отменяется: верните деньги возвратом платежа',
      );
    r.status = 'CANCELLED';
  }
}

describe('запросы оплаты /finance/*payment-requests (DATA_MODEL §23)', () => {
  let app: INestApplication;
  const repo = new FakeRequests();
  const finance = {
    async foliosByReservation(n: string) {
      return n === 'R-1' ? [FOLIO, CLOSED] : null;
    },
  };
  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [PaymentRequestsController],
      providers: [
        PaymentRequestsService,
        { provide: PAYMENT_REQUESTS_REPOSITORY, useValue: repo },
        { provide: FINANCE_REPOSITORY, useValue: finance },
      ],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    repo.rows = [];
    repo.audits = [];
    repo.payments = 0;
  });
  const http = () => request(app.getHttpServer());
  const create = (body: object) =>
    http().post('/finance/reservations/R-1/payment-requests').send(body);

  it('Kaspi по телефону: запрос создан, сумма в тиынах, название объекта для текста гостю', async () => {
    const r = await create({ folioId: FOLIO.id, method: 'KASPI', amount: '12 000' }).expect(201);
    expect(r.body.propertyName).toBe('Хостел Тест');
    expect(r.body.requests).toHaveLength(1);
    expect(r.body.requests[0]).toMatchObject({
      amountMinor: '1200000',
      currency: 'KZT',
      method: 'KASPI',
      link: null,
      status: 'PENDING',
    });
  });

  it('ссылка банка в журнал не пишется: только признак', async () => {
    await create({
      folioId: FOLIO.id,
      method: 'HALYK',
      amount: '5000',
      link: 'https://epay.example/pay?token=secret',
    }).expect(201);
    expect(repo.audits[0]!.action).toBe('finance.payment_request.created');
    expect(JSON.stringify(repo.audits[0])).not.toContain('secret');
    expect(repo.audits[0]!.after).toMatchObject({ hasLink: true });
  });

  it.each([
    [
      'чужой счёт',
      { folioId: '00000000-0000-4000-8000-0000000000ff', method: 'KASPI', amount: '100' },
      400,
    ],
    ['наличные', { folioId: FOLIO.id, method: 'CASH', amount: '100' }, 400],
    [
      'ссылка http',
      { folioId: FOLIO.id, method: 'HALYK', amount: '100', link: 'http://x.example' },
      400,
    ],
    ['закрытый счёт', { folioId: CLOSED.id, method: 'KASPI', amount: '100' }, 409],
  ])('%s — отказ', async (_n, body, code) => {
    await create(body).expect(code);
    expect(repo.rows).toHaveLength(0);
  });

  it('нет брони — 404', async () => {
    await http().get('/finance/reservations/NOPE/payment-requests').expect(404);
  });

  it('«Оплачено» создаёт один платёж; повтор — 409, второго платежа нет', async () => {
    const created = await create({ folioId: FOLIO.id, method: 'KASPI', amount: '100' }).expect(201);
    const id = created.body.requests[0].id;
    const paid = await http().post(`/finance/payment-requests/${id}/paid`).send({}).expect(200);
    expect(paid.body.requests[0]).toMatchObject({ status: 'PAID', paymentId: 'pay-1' });
    await http().post(`/finance/payment-requests/${id}/paid`).send({}).expect(409);
    expect(repo.payments).toBe(1);
  });

  it('оплаченный не отменяется — 409 со словами про возврат', async () => {
    const created = await create({ folioId: FOLIO.id, method: 'KASPI', amount: '100' }).expect(201);
    const id = created.body.requests[0].id;
    await http().post(`/finance/payment-requests/${id}/paid`).send({}).expect(200);
    const r = await http().post(`/finance/payment-requests/${id}/cancel`).send({}).expect(409);
    expect(r.body.message).toContain('возвратом');
  });

  it('отмена ожидающего: статус «отменён»', async () => {
    const created = await create({ folioId: FOLIO.id, method: 'KASPI', amount: '100' }).expect(201);
    const id = created.body.requests[0].id;
    const r = await http().post(`/finance/payment-requests/${id}/cancel`).send({}).expect(200);
    expect(r.body.requests[0].status).toBe('CANCELLED');
  });
});
