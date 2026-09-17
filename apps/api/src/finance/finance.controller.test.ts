import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { UnitsService } from '../units/units.service';
import { FinanceModule } from './finance.module';
import {
  FINANCE_REPOSITORY,
  type FinanceRepository,
  type FolioRecord,
  type PaymentRecord,
} from './finance.repository';

/** Счета на вымышленной брони B-1: два проживания (1 200 000 и 800 000 тиын), ничего не оплачено. */
function makeFakes() {
  const folio = (id: string, stayId: string, price: bigint): FolioRecord => ({
    id,
    reservationItemId: stayId,
    confirmationNumber: 'B-1',
    status: 'OPEN',
    currency: 'KZT',
    stay: {
      accommodationTypeName: 'Одноместная',
      arrivalDate: '2026-10-01',
      departureDate: '2026-10-03',
      status: 'CONFIRMED',
    },
    charges: [
      {
        id: `acc-${id}`,
        folioId: id,
        kind: 'ACCOMMODATION',
        serviceCode: null,
        description: 'Проживание 2026-10-01 → 2026-10-03',
        quantity: 1,
        unitPriceMinor: price,
        amountMinor: price,
        serviceDate: null,
        createdAt: '2026-09-09T09:00:00.000Z',
        voidedAt: null,
      },
    ],
    allocations: [],
    refunds: [],
  });
  const folios = [folio('f1', 'S-1', 1_200_000n), folio('f2', 'S-2', 800_000n)];
  const payments: PaymentRecord[] = [];
  const audits: string[] = [];
  let seq = 0;
  const repo: FinanceRepository = {
    async foliosByReservation(n) {
      const fs = folios.filter((f) => f.confirmationNumber === n);
      return fs.length ? fs : null;
    },
    async folioById(id) {
      return folios.find((f) => f.id === id) ?? null;
    },
    async periodReport(from, to) {
      // фальшивка: период 2026-10-01..2026-10-31 — одно проживание, одна услуга, одна оплата, один возврат
      const inRange = from <= '2026-10-02' && to >= '2026-10-02';
      return inRange
        ? {
            chargesByKind: [
              { kind: 'ACCOMMODATION' as const, count: 2, amountMinor: 2_000_000n },
              { kind: 'SERVICE' as const, count: 1, amountMinor: 100_000n },
            ],
            paymentsByMethod: [
              { method: 'KASPI' as const, count: 1, amountMinor: 1_500_000n },
              { method: 'CASH' as const, count: 1, amountMinor: 200_000n },
            ],
            refunds: { count: 1, amountMinor: 50_000n },
            accommodationByCategory: [
              { category: 'Одноместная', count: 2, amountMinor: 2_000_000n },
            ],
          }
        : {
            chargesByKind: [],
            paymentsByMethod: [],
            refunds: { count: 0, amountMinor: 0n },
            accommodationByCategory: [],
          };
    },
    async services() {
      return [
        {
          id: 'svc1',
          code: 'Стирка (1 загрузка)',
          nameRu: 'Стирка (1 загрузка)',
          nameKz: null,
          priceMinor: 50_000n,
          group: 'Прачечная',
        },
      ];
    },
    async addCharge(folioId, c, audit) {
      if (audit) audits.push(audit.action);
      const id = `c${++seq}`;
      folios
        .find((f) => f.id === folioId)!
        .charges.push({
          id,
          folioId,
          kind: c.kind,
          serviceCode: c.serviceId ? 'Стирка (1 загрузка)' : null,
          description: c.description,
          quantity: c.quantity,
          unitPriceMinor: c.unitPriceMinor,
          amountMinor: c.amountMinor,
          serviceDate: c.serviceDate,
          createdAt: '2026-09-09T10:00:00.000Z',
          voidedAt: null,
        });
      return id;
    },
    async chargeById(id) {
      for (const f of folios) {
        const c = f.charges.find((x) => x.id === id);
        if (c) return c;
      }
      return null;
    },
    async voidCharge(id, audit) {
      if (audit) audits.push(audit.action);
      const c = await repo.chargeById(id);
      if (c) c.voidedAt = '2026-09-09T11:00:00.000Z';
    },
    // блоки доплат за соседнюю ночь: причина «<услуга>, бронь <номер>» (как releaseStayExtraBlocks)
    async stayExtraBlocks(reason) {
      return blocks
        .filter((b) => b.type === 'OTHER' && b.reason === reason)
        .map((b) => ({ id: b.id, unitCode: b.code, dateFrom: b.dateFrom, dateTo: b.dateTo }));
    },
    async createPayment(p, audit) {
      if (audit) audits.push(audit.action);
      const id = `p${++seq}`;
      payments.push({
        id,
        method: p.method,
        status: 'COMPLETED',
        amountMinor: p.amountMinor,
        currency: p.currency,
        allocations: p.allocations,
        refunds: [],
      });
      for (const a of p.allocations)
        folios
          .find((f) => f.id === a.folioId)!
          .allocations.push({
            paymentId: id,
            amountMinor: a.amountMinor,
            payment: {
              method: p.method,
              status: 'COMPLETED',
              amountMinor: p.amountMinor,
              paidAt: p.paidAt ?? '2026-09-09T12:00:00.000Z',
              note: p.note,
              externalReference: null,
            },
          });
      return id;
    },
    async paymentById(id) {
      return payments.find((p) => p.id === id) ?? null;
    },
    async createRefund(r, audit) {
      if (audit) audits.push(audit.action);
      const id = `r${++seq}`;
      payments
        .find((p) => p.id === r.paymentId)!
        .refunds.push({
          folioId: r.folioId,
          amountMinor: r.amountMinor,
        });
      folios
        .find((f) => f.id === r.folioId)!
        .refunds.push({
          id,
          paymentId: r.paymentId,
          amountMinor: r.amountMinor,
          reason: r.reason,
          createdAt: '2026-09-09T13:00:00.000Z',
        });
      return id;
    },
    async closeFolio(id, audit) {
      if (audit) audits.push(audit.action);
      const f = folios.find((x) => x.id === id);
      if (f) f.status = 'CLOSED';
    },
    async audit(_t, _id, action) {
      audits.push(action);
    },
    async stayUnitCode(itemId) {
      return itemId === 'S-1' ? { code: '9001' } : null;
    },
  };
  // ADR-021: блок соседней ночи ставится командой ячейки; фальшивка записывает блоки и умеет отказать
  const blocks: Array<{
    id: string;
    code: string;
    dateFrom: string;
    dateTo: string;
    type: string;
    reason: string | null;
  }> = [];
  const state = { blockConflict: null as string | null };
  const units = {
    async block(
      code: string,
      dto: { dateFrom?: string; dateTo?: string; type?: string; reason?: string | null },
    ) {
      if (state.blockConflict) throw new ConflictException(state.blockConflict);
      blocks.push({
        id: `blk-${blocks.length + 1}`,
        code,
        dateFrom: dto.dateFrom!,
        dateTo: dto.dateTo!,
        type: dto.type!,
        reason: dto.reason ?? null,
      });
      return {} as never;
    },
    async unblock(code: string, blockId: string) {
      const i = blocks.findIndex((b) => b.code === code && b.id === blockId);
      if (i >= 0) blocks.splice(i, 1);
      return {} as never;
    },
  };
  return {
    repo,
    audits,
    blocks,
    units,
    get blockConflict() {
      return state.blockConflict;
    },
    set blockConflict(v: string | null) {
      state.blockConflict = v;
    },
  };
}

describe('finance API: folios, charges, payments, refunds (DATA_MODEL §6, ADR-014)', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
  });
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const m = await Test.createTestingModule({ imports: [FinanceModule] })
      .overrideProvider(FINANCE_REPOSITORY)
      .useFactory({ factory: () => proxy(() => fakes.repo) })
      .overrideProvider(UnitsService)
      .useFactory({ factory: () => proxy(() => fakes.units) })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  const get = () => request(app.getHttpServer()).get('/finance/reservations/B-1').expect(200);

  it('GET returns one folio per stay with balances = charged − paid + refunded; 404 for unknown booking', async () => {
    const res = await get();
    expect(res.body).toMatchObject({
      confirmationNumber: 'B-1',
      currency: 'KZT',
      chargedMinor: '2000000',
      paidMinor: '0',
      refundedMinor: '0',
      balanceMinor: '2000000',
    });
    expect(res.body.folios).toHaveLength(2);
    expect(res.body.folios[0]).toMatchObject({
      id: 'f1',
      status: 'OPEN',
      chargedMinor: '1200000',
      balanceMinor: '1200000',
      charges: [{ kind: 'ACCOMMODATION', amountMinor: '1200000', voidedAt: null }],
    });
    await request(app.getHttpServer()).get('/finance/reservations/nope').expect(404);
    const services = await request(app.getHttpServer()).get('/finance/services').expect(200);
    expect(services.body).toEqual([
      expect.objectContaining({ code: 'Стирка (1 загрузка)', priceMinor: '50000' }),
    ]);
  });

  it('T4: сводка за период — начисления по видам, оплаты по способам, возвраты, разрез по категориям; неверный период → 400', async () => {
    await request(app.getHttpServer()).get('/finance/report').expect(400);
    await request(app.getHttpServer()).get('/finance/report?from=2026-10-01').expect(400);
    await request(app.getHttpServer())
      .get('/finance/report?from=2026-10-31&to=2026-10-01')
      .expect(400);

    const r = await request(app.getHttpServer())
      .get('/finance/report?from=2026-10-01&to=2026-10-31')
      .expect(200);
    expect(r.body).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      chargedMinor: '2100000',
      paidMinor: '1700000',
      refundedMinor: '50000',
      balanceMinor: '450000', // начислено − оплачено + возвращено
    });
    expect(r.body.chargesByKind).toEqual([
      { kind: 'ACCOMMODATION', count: 2, amountMinor: '2000000' },
      { kind: 'SERVICE', count: 1, amountMinor: '100000' },
    ]);
    expect(r.body.paymentsByMethod).toEqual([
      { method: 'KASPI', count: 1, amountMinor: '1500000' },
      { method: 'CASH', count: 1, amountMinor: '200000' },
    ]);
    expect(r.body.accommodationByCategory).toEqual([
      { category: 'Одноместная', count: 2, amountMinor: '2000000' },
    ]);

    const empty = await request(app.getHttpServer())
      .get('/finance/report?from=2026-01-01&to=2026-01-31')
      .expect(200);
    expect(empty.body).toMatchObject({ chargedMinor: '0', paidMinor: '0', balanceMinor: '0' });
  });

  it('charge: only SERVICE/PENALTY/ADJUSTMENT by hand, service fills description and price, amount = qty × price', async () => {
    const post = (body: object) =>
      request(app.getHttpServer()).post('/finance/folios/f1/charges').send(body);
    await post({ kind: 'ACCOMMODATION', description: 'x', unitPrice: '1' }).expect(400);
    await post({ kind: 'SERVICE' }).expect(400); // нет serviceCode
    await post({ kind: 'SERVICE', serviceCode: 'Сауна' }).expect(400);
    await post({ kind: 'PENALTY', unitPrice: '1000' }).expect(400); // нет описания
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000', quantity: 0 }).expect(
      400,
    );
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: 'abc' }).expect(400);
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: '-10' }).expect(400);
    await post({ kind: 'ADJUSTMENT', description: 'Скидка', unitPrice: '0' }).expect(400);
    await request(app.getHttpServer())
      .post('/finance/folios/nope/charges')
      .send({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000' })
      .expect(404);
    const ok = await post({
      kind: 'SERVICE',
      serviceCode: 'Стирка (1 загрузка)',
      quantity: 2,
    }).expect(201);
    const f1 = ok.body.folios[0];
    expect(f1.charges[1]).toMatchObject({
      kind: 'SERVICE',
      serviceCode: 'Стирка (1 загрузка)',
      description: 'Стирка (1 загрузка)',
      quantity: 2,
      unitPriceMinor: '50000',
      amountMinor: '100000',
    });
    expect(f1.balanceMinor).toBe('1300000');
    const adj = await post({
      kind: 'ADJUSTMENT',
      description: 'Скидка',
      unitPrice: '-300.50',
    }).expect(201);
    expect(adj.body.folios[0].charges[2]).toMatchObject({ amountMinor: '-30050' });
    expect(adj.body.folios[0].balanceMinor).toBe('1269950');
    expect(fakes.audits).toEqual(['finance.charge', 'finance.charge']);
  });

  it('payment: 9 methods, allocations must sum to the amount, folios must exist and share the currency', async () => {
    const post = (body: object) =>
      request(app.getHttpServer()).post('/finance/payments').send(body);
    await post({
      method: 'BITCOIN',
      amount: '10',
      allocations: [{ folioId: 'f1', amount: '10' }],
    }).expect(400);
    await post({ method: 'CASH', amount: '10', allocations: [] }).expect(400);
    const mismatch = await post({
      method: 'CASH',
      amount: '20000',
      allocations: [
        { folioId: 'f1', amount: '12000' },
        { folioId: 'f2', amount: '7000' },
      ],
    }).expect(400);
    expect(mismatch.body.message).toContain('Распределено');
    await post({
      method: 'CASH',
      amount: '10',
      allocations: [{ folioId: 'nope', amount: '10' }],
    }).expect(404);
    await post({
      method: 'CASH',
      amount: '10',
      currency: 'USD',
      allocations: [{ folioId: 'f1', amount: '10' }],
    }).expect(400);
    const ok = await post({
      method: 'KASPI',
      amount: '20000',
      note: 'перевод',
      allocations: [
        { folioId: 'f1', amount: '13000' },
        { folioId: 'f2', amount: '7000' },
      ],
    }).expect(201);
    expect(ok.body).toMatchObject({ paidMinor: '2000000', balanceMinor: '0' });
    expect(ok.body.folios[0]).toMatchObject({
      paidMinor: '1300000',
      balanceMinor: '-100000', // переплата по первому счёту
      payments: [
        { method: 'KASPI', allocatedMinor: '1300000', refundedMinor: '0', note: 'перевод' },
      ],
    });
    expect(ok.body.folios[1]).toMatchObject({ paidMinor: '700000', balanceMinor: '100000' });
    expect(fakes.audits).toEqual(['finance.payment']);
  });

  it('refund: only from a payment that was allocated to this folio, not more than allocated − refunded', async () => {
    const pay = await request(app.getHttpServer())
      .post('/finance/payments')
      .send({ method: 'CASH', amount: '12000', allocations: [{ folioId: 'f1', amount: '12000' }] })
      .expect(201);
    const paymentId: string = pay.body.folios[0].payments[0].paymentId;
    const post = (body: object) =>
      request(app.getHttpServer()).post(`/finance/payments/${paymentId}/refunds`).send(body);
    await request(app.getHttpServer())
      .post('/finance/payments/nope/refunds')
      .send({ folioId: 'f1', amount: '1' })
      .expect(404);
    await post({ folioId: 'f2', amount: '10' }).expect(400); // на f2 не распределялся
    await post({ folioId: 'f1', amount: '12000.01' }).expect(400);
    const ok = await post({ folioId: 'f1', amount: '3000', reason: 'ранний выезд' }).expect(201);
    expect(ok.body.folios[0]).toMatchObject({
      paidMinor: '1200000',
      refundedMinor: '300000',
      balanceMinor: '300000',
      payments: [{ allocatedMinor: '1200000', refundedMinor: '300000' }],
      refunds: [{ amountMinor: '300000', reason: 'ранний выезд' }],
    });
    await post({ folioId: 'f1', amount: '9000.01' }).expect(400); // остаток 9 000
    expect(fakes.audits).toEqual(['finance.payment', 'finance.refund']);
  });

  it('ручное закрытие счёта: только при нулевом балансе (иначе 409 с суммой), закрытый счёт не принимает начислений и платежей', async () => {
    const close = (id: string) => request(app.getHttpServer()).post(`/finance/folios/${id}/close`);
    await close('nope').expect(404);
    // гость должен 12 000 ₸ — закрыть нельзя, сумма в сообщении
    const debt = await close('f1').expect(409);
    expect(debt.body.message).toContain('12 000,00 ₸');
    expect(debt.body.message).toMatch(/закрыть нельзя/);
    // переплата — тоже не ноль
    await request(app.getHttpServer())
      .post('/finance/payments')
      .send({ method: 'CASH', amount: '12500', allocations: [{ folioId: 'f1', amount: '12500' }] })
      .expect(201);
    const over = await close('f1').expect(409);
    expect(over.body.message).toContain('−500,00 ₸');
    // возврат переплаты → баланс 0 → закрывается, счёт CLOSED, в журнале
    const paymentId: string = (await get()).body.folios[0].payments[0].paymentId;
    await request(app.getHttpServer())
      .post(`/finance/payments/${paymentId}/refunds`)
      .send({ folioId: 'f1', amount: '500', reason: 'переплата' })
      .expect(201);
    const closed = await close('f1').expect(200);
    expect(closed.body.folios[0]).toMatchObject({ id: 'f1', status: 'CLOSED', balanceMinor: '0' });
    expect(closed.body.folios[1]).toMatchObject({ id: 'f2', status: 'OPEN' });
    await close('f1').expect(409); // уже закрыт
    await request(app.getHttpServer())
      .post('/finance/folios/f1/charges')
      .send({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/finance/payments')
      .send({ method: 'CASH', amount: '10', allocations: [{ folioId: 'f1', amount: '10' }] })
      .expect(409);
    expect(fakes.audits).toEqual(['finance.payment', 'finance.refund', 'finance.folio.close']);
  });

  it('ADR-021: «Поздний выезд» и «Ранний заезд» начисляются одной командой — половина ночи по умолчанию, сумму можно задать', async () => {
    // счёт f1: проживание 12 000 ₸ за 2 ночи (01→03.10) → половина ночи 3 000 ₸
    const late = await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT' })
      .expect(201);
    const f1 = late.body.folios.find((f: { id: string }) => f.id === 'f1');
    const charge = f1.charges.find(
      (c: { description: string }) => c.description === 'Поздний выезд',
    );
    expect(charge).toMatchObject({
      kind: 'SERVICE',
      amountMinor: '300000',
      serviceDate: '2026-10-03',
    });
    // ранний заезд с заданной суммой и датой заезда
    const early = await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'EARLY_CHECK_IN', unitPrice: '2500' })
      .expect(201);
    const e = early.body.folios
      .find((f: { id: string }) => f.id === 'f1')
      .charges.find((c: { description: string }) => c.description === 'Ранний заезд');
    expect(e).toMatchObject({ amountMinor: '250000', serviceDate: '2026-10-01' });
    await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'BREAKFAST' })
      .expect(400);
    // правило объекта по времени: выезд в 19:00 — вся ночь 6 000 ₸; в 11:30 — бесплатно, начислять нечего
    const night = await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' })
      .expect(201);
    const full = night.body.folios
      .find((f: { id: string }) => f.id === 'f1')
      .charges.filter((c: { description: string }) => c.description === 'Поздний выезд');
    expect(full.at(-1)).toMatchObject({ amountMinor: '600000' });
    await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '11:30' })
      .expect(400);
  });

  it('ADR-021: доплата за соседнюю ночь блокирует койку на эту ночь, как в Exely; занятая койка — отказ без начисления', async () => {
    // счёт f1: проживание 01→03.10 в ячейке 9001 (фальшивка stayUnitCode)
    fakes.blocks.length = 0;
    await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' })
      .expect(201);
    expect(fakes.blocks).toEqual([
      {
        id: expect.any(String),
        code: '9001',
        dateFrom: '2026-10-03',
        dateTo: '2026-10-04',
        type: 'OTHER',
        reason: expect.stringMatching(/Поздний выезд/),
      },
    ]);
    // ранний заезд: ночь перед заездом
    await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'EARLY_CHECK_IN', time: '07:00' })
      .expect(201);
    expect(fakes.blocks[1]).toMatchObject({ dateFrom: '2026-09-30', dateTo: '2026-10-01' });
    // койка в соседнюю ночь занята другим гостем — услугу не начисляем, отвечаем 409 словами блокировки
    fakes.blockConflict =
      'В ячейке 9001 есть проживание: X-1 (2026-10-03 → 2026-10-05) — сначала переселите';
    const before = (
      await request(app.getHttpServer()).get('/finance/reservations/B-1')
    ).body.folios.find((f: { id: string }) => f.id === 'f1').charges.length;
    const refused = await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/занята|проживание/);
    const after = (
      await request(app.getHttpServer()).get('/finance/reservations/B-1')
    ).body.folios.find((f: { id: string }) => f.id === 'f1').charges.length;
    expect(after).toBe(before);
    fakes.blockConflict = null;
  });

  it('void: a manual charge is voided once; accommodation is managed by the stay and cannot be voided by hand', async () => {
    const c = await request(app.getHttpServer())
      .post('/finance/folios/f1/charges')
      .send({ kind: 'PENALTY', description: 'Штраф за отмену', unitPrice: '5000' })
      .expect(201);
    const chargeId: string = c.body.folios[0].charges[1].id;
    expect(c.body.folios[0].balanceMinor).toBe('1700000');
    await request(app.getHttpServer()).post('/finance/charges/nope/void').expect(404);
    await request(app.getHttpServer()).post('/finance/charges/acc-f1/void').expect(409);
    const v = await request(app.getHttpServer())
      .post(`/finance/charges/${chargeId}/void`)
      .expect(200);
    expect(v.body.folios[0].charges[1].voidedAt).not.toBeNull();
    expect(v.body.folios[0].balanceMinor).toBe('1200000');
    await request(app.getHttpServer()).post(`/finance/charges/${chargeId}/void`).expect(409);
    expect(fakes.audits).toEqual(['finance.charge', 'finance.charge.void']);
  });

  it('Б7: сторно доплаты за соседнюю ночь снимает её блокировку — койка снова продаётся', async () => {
    fakes.blocks.length = 0;
    const late = await request(app.getHttpServer())
      .post('/finance/folios/f1/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' })
      .expect(201);
    expect(fakes.blocks).toHaveLength(1);
    const chargeId: string = late.body.folios
      .find((f: { id: string }) => f.id === 'f1')
      .charges.find((c: { description: string }) => c.description === 'Поздний выезд').id;
    // чужая блокировка той же койки (ремонт) остаётся — снимается только блок этой доплаты
    fakes.blocks.push({
      id: 'blk-repair',
      code: '9001',
      dateFrom: '2026-10-10',
      dateTo: '2026-10-11',
      type: 'OUT_OF_ORDER',
      reason: 'ремонт',
    });
    await request(app.getHttpServer()).post(`/finance/charges/${chargeId}/void`).expect(200);
    expect(fakes.blocks.map((b) => b.reason)).toEqual(['ремонт']);
  });
});
