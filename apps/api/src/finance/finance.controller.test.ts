import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  ADJUSTMENT_DOWN_MESSAGE,
  FinanceRuleError,
  accessDeniedMessage,
  type MembershipRole,
} from '@pms/domain';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { RoleGuard } from '../auth/role.guard';
import { PrismaService } from '../database/prisma.provider';
import { UnitsService } from '../units/units.service';
import { FinanceModule } from './finance.module';
import {
  FINANCE_REPOSITORY,
  type FinanceRepository,
  type FolioRecord,
  type PaymentMethod,
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
        id: id.replace('4000-8000', '4000-8acc'),
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
  const folios = [
    folio('00000000-0000-4000-8000-000000000021', 'S-1', 1_200_000n),
    folio('00000000-0000-4000-8000-000000000022', 'S-2', 800_000n),
  ];
  const payments: PaymentRecord[] = [];
  const audits: string[] = [];
  /** Что возврат записал в журнал — проверяем, что туда не уехали контакты (аудит 26.09, С-39) */
  const auditAfter: unknown[] = [];
  let seq = 0;
  const repo: FinanceRepository = {
    async today() {
      // как прежний жёсткий UTC+5 — под фальшивыми часами тестов даёт ту же дату
      return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    },
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
    async periodServiceCharges(from, to) {
      // REP2: октябрь — две стирки (3 загрузки), один трансфер и одно начисление вручную;
      // сумма 100 000 равна строке SERVICE фальшивой сводки periodReport
      if (!(from <= '2026-10-02' && to >= '2026-10-02')) return [];
      const laundry = { serviceCode: 'LAUNDRY', serviceName: 'Стирка', serviceGroup: 'Прачечная' };
      return [
        { ...laundry, quantity: 2, amountMinor: 30_000n },
        { ...laundry, quantity: 1, amountMinor: 15_000n },
        {
          serviceCode: 'TRANSFER',
          serviceName: 'Трансфер',
          serviceGroup: null,
          quantity: 1,
          amountMinor: 50_000n,
        },
        {
          serviceCode: null,
          serviceName: null,
          serviceGroup: null,
          quantity: 1,
          amountMinor: 5_000n,
        },
      ];
    },
    async periodDebts(from, to) {
      // ADR-113: брони с начислением в периоде и суммы по всем их счетам. Октябрь — пять броней:
      // долг, долг побольше, ровно оплачено, переплата у отменённой, долг после возврата
      if (from <= '2026-11-01' && to >= '2026-11-01')
        // ноябрь — 501 должник: ответ держит не больше 500 строк
        return Array.from({ length: 501 }, (_, i) => ({
          confirmationNumber: `N-${String(i).padStart(3, '0')}`,
          status: 'CONFIRMED',
          arrivalDate: '2026-11-01',
          departureDate: '2026-11-02',
          guestLabel: null,
          chargedMinor: 1_000n + BigInt(i),
          paidMinor: 0n,
          refundedMinor: 0n,
          overdue: false,
        }));
      if (!(from <= '2026-10-02' && to >= '2026-10-02')) return [];
      const row = (
        n: string,
        status: string,
        arrivalDate: string,
        charged: bigint,
        paid: bigint,
        refunded: bigint,
        overdue = false,
      ) => ({
        confirmationNumber: n,
        status,
        arrivalDate,
        departureDate: '2026-10-09',
        guestLabel: `Гость ${n}`,
        chargedMinor: charged,
        paidMinor: paid,
        refundedMinor: refunded,
        // Q-207: признак просрочки считает запрос (время выезда по часам объекта прошло) — здесь он задан
        overdue,
      });
      return [
        row('B-10', 'CHECKED_OUT', '2026-09-28', 500_000n, 200_000n, 0n, true),
        row('B-11', 'CONFIRMED', '2026-10-06', 1_000_000n, 0n, 0n),
        row('B-12', 'CHECKED_IN', '2026-10-01', 400_000n, 400_000n, 0n, true),
        row('B-13', 'CANCELLED', '2026-10-02', 100_000n, 300_000n, 100_000n),
        row('B-14', 'CHECKED_IN', '2026-10-05', 300_000n, 100_000n, 100_000n, true),
      ];
    },
    async periodOperations(from, to, filter) {
      // ADR-113 F2: октябрь — две оплаты, аннулированная оплата, возврат; итоги — по всему периоду без отборов
      if (!(from <= '2026-10-05' && to >= '2026-10-02')) return { rows: [], summary: [] };
      const op = (
        kind: 'PAYMENT' | 'REFUND',
        id: string,
        day: string,
        method: 'CASH' | 'KASPI',
        amount: bigint,
        status: 'COMPLETED' | 'VOIDED',
        booking: string,
      ) => ({
        kind,
        id,
        at: `${day}T05:00:00.000Z`,
        localAt: `${day} 10:00`,
        method,
        methodTo: null,
        amountMinor: amount,
        status,
        confirmationNumber: booking,
        reservations: 1,
        guestLabel: `Гость ${booking}`,
        category: null,
        note: null,
      });
      const all = [
        op('PAYMENT', 'P1', '2026-10-05', 'CASH', 1_500_000n, 'COMPLETED', 'B-1'),
        op('REFUND', 'R1', '2026-10-04', 'KASPI', 50_000n, 'COMPLETED', 'B-2'),
        op('PAYMENT', 'P2', '2026-10-03', 'KASPI', 200_000n, 'COMPLETED', 'B-2'),
        op('PAYMENT', 'P3', '2026-10-02', 'CASH', 300_000n, 'VOIDED', 'B-1'),
      ];
      const summary = all.map((x) => ({
        kind: x.kind,
        method: x.method,
        status: x.status,
        count: 1,
        amountMinor: x.amountMinor,
      }));
      const rows = all
        .filter((x) => !filter.type || x.kind === filter.type)
        .filter((x) => !filter.method || x.method === filter.method)
        .slice(0, filter.limit);
      return { rows, summary };
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
      const id = `00000000-0000-4000-8c00-${String(++seq).padStart(12, '0')}`;
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
      const id = `00000000-0000-4000-8b00-${String(++seq).padStart(12, '0')}`;
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
      if (audit) auditAfter.push(audit.after);
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
    // ── касса (DATA_MODEL §21): статьи как после первого чтения (стартовый набор), операции в памяти ──
    async cashBalanceSources() {
      return {
        payments: payments
          .filter((p) => p.status === 'COMPLETED')
          .map((p) => ({ method: p.method, amountMinor: p.amountMinor })),
        refunds: payments.flatMap((p) =>
          p.refunds.map((r) => ({ method: p.method, amountMinor: r.amountMinor })),
        ),
        operations: cashOps
          .filter((o) => o.status === 'COMPLETED')
          .map((o) => ({
            kind: o.kind,
            method: o.method,
            methodTo: o.methodTo,
            amountMinor: o.amountMinor,
          })),
      };
    },
    async cashCategories() {
      return cashCategories.map((c) => ({ ...c }));
    },
    async createCashCategory(c, audit) {
      if (audit) audits.push(audit.action);
      if (cashCategories.some((x) => x.kind === c.kind && x.name === c.name))
        throw new FinanceRuleError(`Статья «${c.name}» уже есть`);
      const id = `00000000-0000-4000-8d00-${String(++seq).padStart(12, '0')}`;
      cashCategories.push({ id, kind: c.kind, name: c.name, active: true });
      return id;
    },
    async updateCashCategory(id, patch, audit) {
      const c = cashCategories.find((x) => x.id === id);
      if (!c) return false;
      if (audit) audits.push(audit.action);
      Object.assign(c, patch);
      return true;
    },
    async createCashOperation(op, audit) {
      if (audit) {
        audits.push(audit.action);
        auditAfter.push(audit.after);
      }
      const id = `00000000-0000-4000-8e00-${String(++seq).padStart(12, '0')}`;
      cashOps.push({
        id,
        kind: op.kind,
        method: op.method,
        methodTo: op.methodTo,
        amountMinor: op.amountMinor,
        categoryId: op.categoryId,
        status: 'COMPLETED',
        relatedId: null,
      });
      if (op.commission)
        cashOps.push({
          id: `00000000-0000-4000-8e00-${String(++seq).padStart(12, '0')}`,
          kind: 'EXPENSE',
          method: op.method,
          methodTo: null,
          amountMinor: op.commission.amountMinor,
          categoryId: op.commission.categoryId,
          status: 'COMPLETED',
          relatedId: id,
        });
      return id;
    },
    async cashOperationById(id) {
      const o = cashOps.find((x) => x.id === id);
      if (!o) return null;
      return {
        id: o.id,
        kind: o.kind,
        method: o.method,
        methodTo: o.methodTo,
        amountMinor: o.amountMinor,
        status: o.status,
        relatedId: o.relatedId,
        commissionId: cashOps.find((x) => x.relatedId === id)?.id ?? null,
      };
    },
    async voidCashOperation(id, audit) {
      if (audit) audits.push(audit.action);
      for (const o of cashOps) if (o.id === id || o.relatedId === id) o.status = 'VOIDED';
    },
    // сверка (§21.4): последняя по каждому способу; запись с поправкой — одной «транзакцией»
    async latestCashReconciliations() {
      const latest = new Map<string, (typeof cashRecs)[number]>();
      for (const r of cashRecs) latest.set(r.method, r);
      return [...latest.values()].map((r) => ({
        method: r.method,
        at: r.at,
        localAt: r.at.slice(0, 16).replace('T', ' '),
        expectedMinor: r.expectedMinor,
        countedMinor: r.countedMinor,
        note: r.note,
      }));
    },
    async createCashReconciliation(r, audit) {
      if (audit) {
        audits.push(audit.action);
        auditAfter.push(audit.after);
      }
      const id = `00000000-0000-4000-8f00-${String(++seq).padStart(12, '0')}`;
      cashRecs.push({
        id,
        method: r.method,
        expectedMinor: r.expectedMinor,
        countedMinor: r.countedMinor,
        note: r.note,
        at: new Date().toISOString(),
      });
      if (r.adjustment) {
        let category = cashCategories.find(
          (c) => c.kind === r.adjustment!.kind && c.name === r.adjustment!.categoryName,
        );
        if (!category) {
          category = {
            id: `00000000-0000-4000-8d00-${String(++seq).padStart(12, '0')}`,
            kind: r.adjustment.kind,
            name: r.adjustment.categoryName,
            active: true,
          };
          cashCategories.push(category);
        }
        cashOps.push({
          id: `${id}-adj`,
          kind: r.adjustment.kind,
          method: r.method,
          methodTo: null,
          amountMinor: r.adjustment.amountMinor,
          categoryId: category.id,
          status: 'COMPLETED',
          relatedId: null,
        });
      }
      return id;
    },
  };
  const cashRecs: Array<{
    id: string;
    method: PaymentMethod;
    expectedMinor: bigint;
    countedMinor: bigint;
    note: string | null;
    at: string;
  }> = [];
  const cashCategories: Array<{
    id: string;
    kind: 'INCOME' | 'EXPENSE';
    name: string;
    active: boolean;
  }> = [
    { id: '00000000-0000-4000-8d00-000000000c01', kind: 'INCOME', name: 'Начальный остаток', active: true },
    { id: '00000000-0000-4000-8d00-000000000c02', kind: 'EXPENSE', name: 'Комиссия банка', active: true },
    { id: '00000000-0000-4000-8d00-000000000c03', kind: 'EXPENSE', name: 'Зарплата', active: true },
  ];
  const cashOps: Array<{
    id: string;
    kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    method: PaymentMethod;
    methodTo: PaymentMethod | null;
    amountMinor: bigint;
    categoryId: string | null;
    status: 'COMPLETED' | 'VOIDED';
    relatedId: string | null;
  }> = [];
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
    auditAfter,
    blocks,
    units,
    cashOps,
    cashCategories,
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
  it('id не UUID — 400 до базы, а не 500 из-за ошибки типа в запросе (аудит 29.09.2026)', async () => {
    const http = () => request(app.getHttpServer());
    for (const bad of ['abc', "1'%20or%20'1'='1", '123']) {
      await http().post(`/finance/folios/${bad}/charges`).send({}).expect(400);
      await http().post(`/finance/folios/${bad}/stay-extras`).send({}).expect(400);
      await http().post(`/finance/folios/${bad}/close`).expect(400);
      await http().post(`/finance/charges/${bad}/void`).expect(400);
      await http().post(`/finance/payments/${bad}/refunds`).send({}).expect(400);
    }
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
      id: '00000000-0000-4000-8000-000000000021',
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

  it('REP2: отчёт по услугам — свод по услуге, «вручную» одной строкой, крупные первыми, итог равен строке SERVICE сводки; неверный период → 400', async () => {
    await request(app.getHttpServer()).get('/finance/services-report').expect(400);
    await request(app.getHttpServer())
      .get('/finance/services-report?from=2026-10-31&to=2026-10-01')
      .expect(400);
    await request(app.getHttpServer())
      .get('/finance/services-report?from=2020-01-01&to=2030-12-31')
      .expect(400);

    const r = await request(app.getHttpServer())
      .get('/finance/services-report?from=2026-10-01&to=2026-10-31')
      .expect(200);
    expect(r.body).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      currency: 'KZT',
      count: 4,
      totalMinor: '100000',
    });
    // две стирки слились в одну строку; сортировка — по сумме; начисление вручную — строкой без кода
    expect(r.body.rows).toEqual([
      { code: 'TRANSFER', name: 'Трансфер', group: null, charges: 1, quantity: 1, amountMinor: '50000' },
      { code: 'LAUNDRY', name: 'Стирка', group: 'Прачечная', charges: 2, quantity: 3, amountMinor: '45000' },
      { code: null, name: null, group: null, charges: 1, quantity: 1, amountMinor: '5000' },
    ]);
    // то же окно, что у сводки: итог равен её строке SERVICE
    const report = await request(app.getHttpServer())
      .get('/finance/report?from=2026-10-01&to=2026-10-31')
      .expect(200);
    const service = report.body.chargesByKind.find((x: { kind: string }) => x.kind === 'SERVICE');
    expect(r.body.totalMinor).toBe(service.amountMinor);

    // пустой период — пустой отчёт, не ошибка
    const empty = await request(app.getHttpServer())
      .get('/finance/services-report?from=2027-01-01&to=2027-01-02')
      .expect(200);
    expect(empty.body).toMatchObject({ count: 0, totalMinor: '0', rows: [] });
  });

  it('T4: сводка за период — начисления по видам, оплаты по способам, возвраты, разрез по категориям; неверный период → 400', async () => {
    await request(app.getHttpServer()).get('/finance/report').expect(400);
    await request(app.getHttpServer()).get('/finance/report?from=2026-10-01').expect(400);
    await request(app.getHttpServer())
      .get('/finance/report?from=2026-10-31&to=2026-10-01')
      .expect(400);
    // Волна 4: без предела «Деньги за период» просили хоть десять лет и собирали всю базу
    await request(app.getHttpServer())
      .get('/finance/report?from=2020-01-01&to=2030-12-31')
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

  it('ADR-113: брони с остатком к сбору — начисление в периоде, остаток по всему счёту > 0, крупные первыми, просроченные отдельно (Q-207); неверный период → 400', async () => {
    const debts = (qs: string) => request(app.getHttpServer()).get(`/finance/debts${qs}`);
    await debts('').expect(400);
    await debts('?from=2026-10-31&to=2026-10-01').expect(400);
    await debts('?from=2020-01-01&to=2030-12-31').expect(400);

    const r = await debts('?from=2026-10-01&to=2026-10-31').expect(200);
    expect(r.body).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      currency: 'KZT',
      count: 3,
      balanceMinor: '1600000',
      // Q-207: просроченный долг — только брони с остатком > 0; ровно оплаченная B-12 не считается, хоть и «просрочена»
      overdue: { count: 2, balanceMinor: '600000' },
      truncated: false,
    });
    expect(r.body).not.toHaveProperty('checkedOut');
    // ровно оплаченная B-12 и переплата B-13 в список к сбору не входят; равные остатки — по дате заезда
    expect(r.body.rows.map((x: { confirmationNumber: string }) => x.confirmationNumber)).toEqual([
      'B-11',
      'B-10',
      'B-14',
    ]);
    expect(r.body.rows[2]).toEqual({
      confirmationNumber: 'B-14',
      status: 'CHECKED_IN',
      arrivalDate: '2026-10-05',
      departureDate: '2026-10-09',
      guestLabel: 'Гость B-14',
      chargedMinor: '300000',
      paidMinor: '100000',
      refundedMinor: '100000',
      balanceMinor: '300000', // начислено − оплачено + возвращено
      overdue: true,
    });
    expect(r.body.rows[0]).toMatchObject({ confirmationNumber: 'B-11', overdue: false });

    const many = await debts('?from=2026-11-01&to=2026-11-30').expect(200);
    expect(many.body).toMatchObject({ count: 501, truncated: true });
    expect(many.body.rows).toHaveLength(500);
    expect(many.body.rows[0].confirmationNumber).toBe('N-500');

    const empty = await debts('?from=2026-01-01&to=2026-01-31').expect(200);
    expect(empty.body).toMatchObject({
      count: 0,
      balanceMinor: '0',
      overdue: { count: 0, balanceMinor: '0' },
      rows: [],
      truncated: false,
    });
  });

  it('ADR-113 F2: оплаты и возвраты за период — новыми первыми, отборы по типу и способу, суммы без аннулированных; неверное → 400', async () => {
    const ops = (qs: string) => request(app.getHttpServer()).get(`/finance/operations${qs}`);
    await ops('').expect(400);
    await ops('?from=2026-10-31&to=2026-10-01').expect(400);
    await ops('?from=2026-10-01&to=2026-10-31&type=FOO').expect(400);
    await ops('?from=2026-10-01&to=2026-10-31&method=BTC').expect(400);
    for (const limit of ['0', '20001', 'abc'])
      await ops(`?from=2026-10-01&to=2026-10-31&limit=${limit}`).expect(400);

    const all = await ops('?from=2026-10-01&to=2026-10-31').expect(200);
    expect(all.body).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      currency: 'KZT',
      total: 4,
      paidMinor: '1700000', // аннулированная оплата в «оплачено» не входит — как в итогах периода
      refundedMinor: '50000',
      truncated: false,
    });
    expect(all.body.methods).toEqual([
      { method: 'CASH', count: 2 },
      { method: 'KASPI', count: 2 },
    ]);
    expect(all.body.rows.map((x: { id: string }) => x.id)).toEqual(['P1', 'R1', 'P2', 'P3']);
    expect(all.body.rows[1]).toEqual({
      kind: 'REFUND',
      id: 'R1',
      at: '2026-10-04T05:00:00.000Z',
      localAt: '2026-10-04 10:00',
      method: 'KASPI',
      methodTo: null,
      amountMinor: '50000',
      status: 'COMPLETED',
      confirmationNumber: 'B-2',
      reservations: 1,
      guestLabel: 'Гость B-2',
      category: null,
      note: null,
    });

    const payments = await ops('?from=2026-10-01&to=2026-10-31&type=PAYMENT').expect(200);
    expect(payments.body).toMatchObject({ total: 3, paidMinor: '1700000', refundedMinor: '0' });
    // числа на чипах способов — внутри отбора по типу, но без отбора по способу
    expect(payments.body.methods).toEqual([
      { method: 'CASH', count: 2 },
      { method: 'KASPI', count: 1 },
    ]);

    const kaspi = await ops('?from=2026-10-01&to=2026-10-31&method=KASPI').expect(200);
    expect(kaspi.body).toMatchObject({ total: 2, paidMinor: '200000', refundedMinor: '50000' });
    expect(kaspi.body.rows.map((x: { id: string }) => x.id)).toEqual(['R1', 'P2']);
    expect(kaspi.body.methods).toHaveLength(2);

    const one = await ops('?from=2026-10-01&to=2026-10-31&limit=1').expect(200);
    expect(one.body).toMatchObject({ total: 4, truncated: true });
    expect(one.body.rows).toHaveLength(1);

    const empty = await ops('?from=2026-01-01&to=2026-01-31').expect(200);
    expect(empty.body).toMatchObject({
      total: 0,
      paidMinor: '0',
      refundedMinor: '0',
      methods: [],
      rows: [],
      truncated: false,
    });
  });

  it('charge: only SERVICE/PENALTY/ADJUSTMENT by hand, service fills description and price, amount = qty × price', async () => {
    const post = (body: object) =>
      request(app.getHttpServer())
        .post('/finance/folios/00000000-0000-4000-8000-000000000021/charges')
        .send(body);
    await post({ kind: 'ACCOMMODATION', description: 'x', unitPrice: '1' }).expect(400);
    await post({ kind: 'SERVICE' }).expect(400); // нет serviceCode
    await post({ kind: 'SERVICE', serviceCode: 'Сауна' }).expect(400);
    await post({ kind: 'PENALTY', unitPrice: '1000' }).expect(400); // нет описания
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000', quantity: 0 }).expect(
      400,
    );
    // потолок количества (аудит 29.09, SEC-4): огромное значение давало переполнение в базе и 500
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000', quantity: 1001 }).expect(
      400,
    );
    await post({
      kind: 'PENALTY',
      description: 'Штраф',
      unitPrice: '1000',
      quantity: '9999999999999999999',
    }).expect(400);
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: 'abc' }).expect(400);
    await post({ kind: 'PENALTY', description: 'Штраф', unitPrice: '-10' }).expect(400);
    await post({ kind: 'ADJUSTMENT', description: 'Скидка', unitPrice: '0' }).expect(400);
    await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-0000000000ff/charges')
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
      allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '10' }],
    }).expect(400);
    await post({ method: 'CASH', amount: '10', allocations: [] }).expect(400);
    const mismatch = await post({
      method: 'CASH',
      amount: '20000',
      allocations: [
        { folioId: '00000000-0000-4000-8000-000000000021', amount: '12000' },
        { folioId: '00000000-0000-4000-8000-000000000022', amount: '7000' },
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
      allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '10' }],
    }).expect(400);
    const ok = await post({
      method: 'KASPI',
      amount: '20000',
      note: 'перевод',
      allocations: [
        { folioId: '00000000-0000-4000-8000-000000000021', amount: '13000' },
        { folioId: '00000000-0000-4000-8000-000000000022', amount: '7000' },
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

  it('Q-169: пока база не в РК, почта и телефоны в назначении начисления, заметке платежа и причине возврата маскируются', async () => {
    const before = process.env.PII_STORAGE;
    delete process.env.PII_STORAGE;
    try {
      const charge = await request(app.getHttpServer())
        .post('/finance/folios/00000000-0000-4000-8000-000000000021/charges')
        .send({
          kind: 'ADJUSTMENT',
          description: 'Скидка по звонку +7 701 234 56 78',
          unitPrice: '-100',
        })
        .expect(201);
      const pay = await request(app.getHttpServer())
        .post('/finance/payments')
        .send({
          method: 'KASPI',
          amount: '1000',
          note: 'чек на guest.test@example.com',
          allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '1000' }],
        })
        .expect(201);
      const paymentId: string = pay.body.folios[0].payments[0].paymentId;
      const refund = await request(app.getHttpServer())
        .post(`/finance/payments/${paymentId}/refunds`)
        .send({
          folioId: '00000000-0000-4000-8000-000000000021',
          amount: '500',
          reason: 'вернуть на 8 777 123 45 67',
        })
        .expect(201);
      const all = JSON.stringify([charge.body, pay.body, refund.body]);
      for (const raw of ['701 234 56 78', 'guest.test@example.com', '777 123 45 67'])
        expect(all).not.toContain(raw);
      // и в журнал причина возврата уходит с той же маской: раньше туда писался сырой текст (аудит 26.09, С-39)
      expect(JSON.stringify(fakes.auditAfter)).not.toContain('777 123 45 67');
      expect(JSON.stringify(fakes.auditAfter)).toContain('<телефон>');
      expect(all).toContain('Скидка по звонку <телефон>');
      expect(all).toContain('чек на <почта>');
    } finally {
      if (before === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = before;
    }
  });

  it('refund: only from a payment that was allocated to this folio, not more than allocated − refunded', async () => {
    const pay = await request(app.getHttpServer())
      .post('/finance/payments')
      .send({
        method: 'CASH',
        amount: '12000',
        allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '12000' }],
      })
      .expect(201);
    const paymentId: string = pay.body.folios[0].payments[0].paymentId;
    const post = (body: object) =>
      request(app.getHttpServer()).post(`/finance/payments/${paymentId}/refunds`).send(body);
    await request(app.getHttpServer())
      .post('/finance/payments/00000000-0000-4000-8000-0000000000ff/refunds')
      .send({ folioId: '00000000-0000-4000-8000-000000000021', amount: '1' })
      .expect(404);
    await post({ folioId: '00000000-0000-4000-8000-000000000022', amount: '10' }).expect(400); // на f2 не распределялся
    await post({ folioId: '00000000-0000-4000-8000-000000000021', amount: '12000.01' }).expect(400);
    const ok = await post({
      folioId: '00000000-0000-4000-8000-000000000021',
      amount: '3000',
      reason: 'ранний выезд',
    }).expect(201);
    expect(ok.body.folios[0]).toMatchObject({
      paidMinor: '1200000',
      refundedMinor: '300000',
      balanceMinor: '300000',
      payments: [{ allocatedMinor: '1200000', refundedMinor: '300000' }],
      refunds: [{ amountMinor: '300000', reason: 'ранний выезд' }],
    });
    await post({ folioId: '00000000-0000-4000-8000-000000000021', amount: '9000.01' }).expect(400); // остаток 9 000
    expect(fakes.audits).toEqual(['finance.payment', 'finance.refund']);
  });

  it('ручное закрытие счёта: только при нулевом балансе (иначе 409 с суммой), закрытый счёт не принимает начислений и платежей', async () => {
    const close = (id: string) => request(app.getHttpServer()).post(`/finance/folios/${id}/close`);
    await close('00000000-0000-4000-8000-0000000000ff').expect(404);
    // гость должен 12 000 ₸ — закрыть нельзя, сумма в сообщении
    const debt = await close('00000000-0000-4000-8000-000000000021').expect(409);
    expect(debt.body.message).toContain('12 000,00 ₸');
    expect(debt.body.message).toMatch(/закрыть нельзя/);
    // переплата — тоже не ноль
    await request(app.getHttpServer())
      .post('/finance/payments')
      .send({
        method: 'CASH',
        amount: '12500',
        allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '12500' }],
      })
      .expect(201);
    const over = await close('00000000-0000-4000-8000-000000000021').expect(409);
    expect(over.body.message).toContain('−500,00 ₸');
    // возврат переплаты → баланс 0 → закрывается, счёт CLOSED, в журнале
    const paymentId: string = (await get()).body.folios[0].payments[0].paymentId;
    await request(app.getHttpServer())
      .post(`/finance/payments/${paymentId}/refunds`)
      .send({ folioId: '00000000-0000-4000-8000-000000000021', amount: '500', reason: 'переплата' })
      .expect(201);
    const closed = await close('00000000-0000-4000-8000-000000000021').expect(200);
    expect(closed.body.folios[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000021',
      status: 'CLOSED',
      balanceMinor: '0',
    });
    expect(closed.body.folios[1]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000022',
      status: 'OPEN',
    });
    await close('00000000-0000-4000-8000-000000000021').expect(409); // уже закрыт
    await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/charges')
      .send({ kind: 'PENALTY', description: 'Штраф', unitPrice: '1000' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/finance/payments')
      .send({
        method: 'CASH',
        amount: '10',
        allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '10' }],
      })
      .expect(409);
    expect(fakes.audits).toEqual(['finance.payment', 'finance.refund', 'finance.folio.close']);
  });

  it('ADR-021: «Поздний выезд» и «Ранний заезд» начисляются одной командой — половина ночи по умолчанию, сумму можно задать', async () => {
    // счёт f1: проживание 12 000 ₸ за 2 ночи (01→03.10) → половина ночи 3 000 ₸
    const late = await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT' })
      .expect(201);
    const f1 = late.body.folios.find(
      (f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021',
    );
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
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'EARLY_CHECK_IN', unitPrice: '2500' })
      .expect(201);
    const e = early.body.folios
      .find((f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021')
      .charges.find((c: { description: string }) => c.description === 'Ранний заезд');
    expect(e).toMatchObject({ amountMinor: '250000', serviceDate: '2026-10-01' });
    await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'BREAKFAST' })
      .expect(400);
    // правило объекта по времени: выезд в 19:00 — вся ночь 6 000 ₸; в 11:30 — бесплатно, начислять нечего
    const night = await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' })
      .expect(201);
    const full = night.body.folios
      .find((f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021')
      .charges.filter((c: { description: string }) => c.description === 'Поздний выезд');
    expect(full.at(-1)).toMatchObject({ amountMinor: '600000' });
    await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '11:30' })
      .expect(400);
  });

  it('ADR-021: доплата за соседнюю ночь блокирует койку на эту ночь, как в Legacy; занятая койка — отказ без начисления', async () => {
    // счёт f1: проживание 01→03.10 в ячейке 9001 (фальшивка stayUnitCode)
    fakes.blocks.length = 0;
    await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
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
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'EARLY_CHECK_IN', time: '07:00' })
      .expect(201);
    expect(fakes.blocks[1]).toMatchObject({ dateFrom: '2026-09-30', dateTo: '2026-10-01' });
    // койка в соседнюю ночь занята другим гостем — услугу не начисляем, отвечаем 409 словами блокировки
    fakes.blockConflict =
      'В ячейке 9001 есть проживание: X-1 (2026-10-03 → 2026-10-05) — сначала переселите';
    const before = (
      await request(app.getHttpServer()).get('/finance/reservations/B-1')
    ).body.folios.find((f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021')
      .charges.length;
    const refused = await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/занята|проживание/);
    const after = (
      await request(app.getHttpServer()).get('/finance/reservations/B-1')
    ).body.folios.find((f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021')
      .charges.length;
    expect(after).toBe(before);
    fakes.blockConflict = null;
  });

  it('void: a manual charge is voided once; accommodation is managed by the stay and cannot be voided by hand', async () => {
    const c = await request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/charges')
      .send({ kind: 'PENALTY', description: 'Штраф за отмену', unitPrice: '5000' })
      .expect(201);
    const chargeId: string = c.body.folios[0].charges[1].id;
    expect(c.body.folios[0].balanceMinor).toBe('1700000');
    await request(app.getHttpServer())
      .post('/finance/charges/00000000-0000-4000-8000-0000000000ff/void')
      .expect(404);
    await request(app.getHttpServer())
      .post('/finance/charges/00000000-0000-4000-8acc-000000000021/void')
      .expect(409);
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
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/stay-extras')
      .send({ extra: 'LATE_CHECK_OUT', time: '19:00' })
      .expect(201);
    expect(fakes.blocks).toHaveLength(1);
    const chargeId: string = late.body.folios
      .find((f: { id: string }) => f.id === '00000000-0000-4000-8000-000000000021')
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

/**
 * Роли в деньгах (ADR-107, Q-024): администратор принимает оплаты и начисляет услуги, а возврат, сторно и корректировку
 * счёта на уменьшение делают владелец и управляющий. Приложение собрано с настоящими замками входа и ролей.
 */
describe('роли в деньгах: возврат, сторно и уменьшение счёта — владелец и управляющий (ADR-107)', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  const users: Record<string, MembershipRole> = {
    'session-owner': 'OWNER',
    'session-manager': 'MANAGER',
    'session-admin': 'STAFF',
  };
  beforeEach(() => {
    fakes = makeFakes();
    vi.stubEnv('AUTH_REQUIRED', '1');
  });
  afterEach(() => vi.unstubAllEnvs());
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const auth = {
      whoami: async (token: string) =>
        users[token]
          ? {
              user: {
                id: `u-${token}`,
                email: 'desk@example.invalid',
                name: null,
                organizationId: 'org-1',
                role: users[token],
                platformAdmin: false,
              },
              organization: null,
              expiresAt: '2026-10-01T00:00:00.000Z',
            }
          : null,
    };
    const m = await Test.createTestingModule({
      imports: [FinanceModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: RoleGuard },
        { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
      ],
    })
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
  const as = (session: string) => ({ 'x-wetop-session': session });
  const charge = (session: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/finance/folios/00000000-0000-4000-8000-000000000021/charges')
      .set(as(session))
      .send(body);
  const pay = (session: string) =>
    request(app.getHttpServer())
      .post('/finance/payments')
      .set(as(session))
      .send({
        method: 'CASH',
        amount: '1000',
        allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount: '1000' }],
      });

  /** Ручное начисление, созданное этим ответом: его id — для сторно (проживание сторнирует только система) */
  const manualChargeId = (body: {
    folios: Array<{ charges: Array<{ id: string; kind: string }> }>;
  }) => body.folios[0]!.charges.find((c) => c.kind !== 'ACCOMMODATION')!.id;

  it('администратор принимает оплату и начисляет, но не возвращает, не сторнирует и не уменьшает счёт', async () => {
    const up = await charge('session-admin', {
      kind: 'ADJUSTMENT',
      description: 'Доплата',
      unitPrice: '100',
    }).expect(201);
    const down = await charge('session-admin', {
      kind: 'ADJUSTMENT',
      description: 'Скидка',
      unitPrice: '-100',
    });
    expect(down.status).toBe(403);
    expect(down.body.message).toBe(ADJUSTMENT_DOWN_MESSAGE);

    const paid = await pay('session-admin').expect(201);
    const paymentId: string = paid.body.folios[0].payments[0].paymentId;
    const refund = await request(app.getHttpServer())
      .post(`/finance/payments/${paymentId}/refunds`)
      .set(as('session-admin'))
      .send({
        folioId: '00000000-0000-4000-8000-000000000021',
        amount: '500',
        reason: 'ошибся суммой',
      });
    expect(refund.status).toBe(403);
    expect(refund.body.message).toBe(accessDeniedMessage('refunds'));
    const voided = await request(app.getHttpServer())
      .post(`/finance/charges/${manualChargeId(up.body)}/void`)
      .set(as('session-admin'));
    expect(voided.status).toBe(403);
    expect(fakes.audits).toEqual(['finance.charge', 'finance.payment']);
  });

  it('управляющий и владелец возвращают, сторнируют и уменьшают счёт', async () => {
    for (const session of ['session-manager', 'session-owner']) {
      fakes = makeFakes();
      const down = await charge(session, {
        kind: 'ADJUSTMENT',
        description: 'Скидка',
        unitPrice: '-100',
      }).expect(201);
      const paid = await pay(session).expect(201);
      const paymentId: string = paid.body.folios[0].payments[0].paymentId;
      await request(app.getHttpServer())
        .post(`/finance/payments/${paymentId}/refunds`)
        .set(as(session))
        .send({
          folioId: '00000000-0000-4000-8000-000000000021',
          amount: '500',
          reason: 'ошибся суммой',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/finance/charges/${manualChargeId(down.body)}/void`)
        .set(as(session))
        .expect(200);
    }
  });

  it('отчёт за период администратор смотрит', async () => {
    await request(app.getHttpServer())
      .get('/finance/report?from=2026-10-01&to=2026-10-31')
      .set(as('session-admin'))
      .expect(200);
  });
});

describe('касса: остатки, операции, переводы, статьи (DATA_MODEL §21)', () => {
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
  const http = () => request(app.getHttpServer());
  const pay = (method: string, amount: string) =>
    http()
      .post('/finance/payments')
      .send({
        method,
        amount,
        allocations: [{ folioId: '00000000-0000-4000-8000-000000000021', amount }],
      })
      .expect(201);

  it('остатки по способам: оплаты гостей − возвраты + касса; плитки по умолчанию видны при нуле', async () => {
    await pay('CASH', '100');
    await http()
      .post('/finance/cash/operations')
      .send({ kind: 'INCOME', method: 'CASH', amount: '20' })
      .expect(201);
    await http()
      .post('/finance/cash/operations')
      .send({
        kind: 'EXPENSE',
        method: 'CASH',
        amount: '5',
        categoryId: '00000000-0000-4000-8d00-000000000c03',
      })
      .expect(201);
    const r = await http().get('/finance/cash').expect(200);
    const by = Object.fromEntries(
      r.body.balances.map((b: { method: string; balanceMinor: string }) => [
        b.method,
        b.balanceMinor,
      ]),
    );
    expect(by['CASH']).toBe('11500'); // 10 000 + 2 000 − 500 тиын
    expect(by['KASPI']).toBe('0');
    expect(by['HALYK']).toBe('0');
    expect(by['CARD_TERMINAL']).toBe('0');
    expect(r.body.totalMinor).toBe('11500');
    expect(fakes.audits).toContain('finance.cash.operation');
  });

  it('проверки операции: вид, сумма, способ не из кассы, статья другого вида, перевод не этим маршрутом', async () => {
    const op = (body: object) => http().post('/finance/cash/operations').send(body);
    await op({ kind: 'WAT', method: 'CASH', amount: '10' }).expect(400);
    await op({ kind: 'INCOME', method: 'CASH', amount: '0' }).expect(400);
    await op({ kind: 'INCOME', method: 'CASH', amount: 'abc' }).expect(400);
    await op({ kind: 'EXPENSE', method: 'EXTERNAL', amount: '10' }).expect(400);
    // статья дохода у расхода — 400
    await op({
      kind: 'EXPENSE',
      method: 'CASH',
      amount: '10',
      categoryId: '00000000-0000-4000-8d00-000000000c01',
    }).expect(400);
    await op({ kind: 'TRANSFER', method: 'CASH', amount: '10' }).expect(400);
    expect(fakes.cashOps).toHaveLength(0);
  });

  it('перевод: из способа в способ, комиссия процентом — связанный расход со статьёй «Комиссия банка»', async () => {
    await pay('KASPI', '1000');
    await http()
      .post('/finance/cash/transfers')
      .send({ from: 'KASPI', to: 'CASH', amount: '500', commission: { percent: '1' } })
      .expect(201);
    expect(fakes.cashOps).toHaveLength(2);
    const [transfer, fee] = fakes.cashOps;
    expect(transfer).toMatchObject({ kind: 'TRANSFER', method: 'KASPI', methodTo: 'CASH' });
    expect(fee).toMatchObject({
      kind: 'EXPENSE',
      method: 'KASPI',
      amountMinor: 500n, // 1 % от 50 000 тиын
      categoryId: '00000000-0000-4000-8d00-000000000c02',
      relatedId: transfer!.id,
    });
    const r = await http().get('/finance/cash').expect(200);
    const by = Object.fromEntries(
      r.body.balances.map((b: { method: string; balanceMinor: string }) => [
        b.method,
        b.balanceMinor,
      ]),
    );
    expect(by['KASPI']).toBe('49500'); // 100 000 − 50 000 − 500
    expect(by['CASH']).toBe('50000');
    // в тот же способ — 400
    await http()
      .post('/finance/cash/transfers')
      .send({ from: 'KASPI', to: 'KASPI', amount: '10' })
      .expect(400);
  });

  it('статья «Комиссия банка» выключена и статья комиссии не указана — 400 словами', async () => {
    fakes.cashCategories.find((c) => c.name === 'Комиссия банка')!.active = false;
    const r = await http()
      .post('/finance/cash/transfers')
      .send({ from: 'KASPI', to: 'CASH', amount: '500', commission: { amount: '5' } })
      .expect(400);
    expect(r.body.message).toContain('Комиссия банка');
    expect(fakes.cashOps).toHaveLength(0);
  });

  it('аннулирование: комиссия снимается с основной; повтор — 409; комиссию отдельно — 409', async () => {
    await http()
      .post('/finance/cash/operations')
      .send({ kind: 'INCOME', method: 'CASH', amount: '100', commission: { amount: '2' } })
      .expect(201);
    const [main, fee] = fakes.cashOps;
    await http().post(`/finance/cash/operations/${fee!.id}/void`).expect(409);
    await http().post(`/finance/cash/operations/${main!.id}/void`).expect(200);
    expect(main!.status).toBe('VOIDED');
    expect(fee!.status).toBe('VOIDED');
    await http().post(`/finance/cash/operations/${main!.id}/void`).expect(409);
    await http()
      .post('/finance/cash/operations/00000000-0000-4000-8e00-00000000dead/void')
      .expect(404);
    expect(fakes.audits).toContain('finance.cash.operation.void');
    const r = await http().get('/finance/cash').expect(200);
    expect(r.body.totalMinor).toBe('0');
  });

  it('статьи: стартовый набор в ответе кассы, добавление, дубль — 400, выключение, неизвестная — 404', async () => {
    const list = await http().get('/finance/cash').expect(200);
    expect(list.body.categories.map((c: { name: string }) => c.name)).toContain('Комиссия банка');
    const added = await http()
      .post('/finance/cash/categories')
      .send({ kind: 'EXPENSE', name: 'Реклама' })
      .expect(201);
    expect(added.body.map((c: { name: string }) => c.name)).toContain('Реклама');
    await http()
      .post('/finance/cash/categories')
      .send({ kind: 'EXPENSE', name: 'Реклама' })
      .expect(400);
    await http().post('/finance/cash/categories').send({ kind: 'TRANSFER', name: 'X' }).expect(400);
    const id = fakes.cashCategories.find((c) => c.name === 'Реклама')!.id;
    const off = await http().patch(`/finance/cash/categories/${id}`).send({ active: false }).expect(200);
    expect(
      off.body.find((c: { id: string; active: boolean }) => c.id === id)!.active,
    ).toBe(false);
    await http()
      .patch('/finance/cash/categories/00000000-0000-4000-8d00-00000000dead')
      .send({ active: false })
      .expect(404);
    expect(fakes.audits).toContain('finance.cash.category.created');
    expect(fakes.audits).toContain('finance.cash.category.updated');
  });

  it('лента операций: source — только RESERVATIONS или CASH, новые типы в type', async () => {
    await http().get('/finance/operations?from=2026-10-01&to=2026-10-31&source=WAT').expect(400);
    await http().get('/finance/operations?from=2026-10-01&to=2026-10-31&type=WAT').expect(400);
    const r = await http()
      .get('/finance/operations?from=2026-10-01&to=2026-10-31&source=CASH')
      .expect(200);
    // фальшивый период броней без кассы: лента пуста, суммы кассы нулевые, оплаты броней не подмешаны
    expect(r.body).toMatchObject({ incomeMinor: '0', expenseMinor: '0', paidMinor: '0' });
  });
});

describe('сверка наличных (§21.4, K4)', () => {
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
  const http = () => request(app.getHttpServer());
  const income = (amount: string) =>
    http().post('/finance/cash/operations').send({ kind: 'INCOME', method: 'CASH', amount }).expect(201);

  it('недостача с поправкой: запись сверки, расход «Недостача кассы», остаток равен пересчитанному', async () => {
    await income('100');
    const r = await http()
      .post('/finance/cash/reconciliations')
      .send({ method: 'CASH', counted: '95', adjust: true })
      .expect(201);
    const rec = r.body.reconciliations.find((x: { method: string }) => x.method === 'CASH');
    expect(rec).toMatchObject({ expectedMinor: '10000', countedMinor: '9500' });
    const by = Object.fromEntries(
      r.body.balances.map((b: { method: string; balanceMinor: string }) => [b.method, b.balanceMinor]),
    );
    expect(by['CASH']).toBe('9500');
    const adj = fakes.cashOps.find((o) => o.kind === 'EXPENSE');
    expect(adj).toMatchObject({ amountMinor: 500n, method: 'CASH' });
    expect(
      fakes.cashCategories.find((c) => c.id === adj!.categoryId)!.name,
    ).toBe('Недостача кассы');
    expect(fakes.audits).toContain('finance.cash.reconciliation');
  });

  it('излишек без галочки — остаток не меняется; совпало — поправки нет; GET /finance/cash отдаёт сверку', async () => {
    await income('100');
    await http()
      .post('/finance/cash/reconciliations')
      .send({ method: 'CASH', counted: '110' })
      .expect(201);
    expect(fakes.cashOps.filter((o) => o.kind !== 'INCOME')).toHaveLength(0);
    const cash = await http().get('/finance/cash').expect(200);
    expect(
      cash.body.reconciliations.find((x: { method: string }) => x.method === 'CASH'),
    ).toMatchObject({ expectedMinor: '10000', countedMinor: '11000' });
    // совпало — поправка не создаётся и с галочкой
    await http()
      .post('/finance/cash/reconciliations')
      .send({ method: 'CASH', counted: '100', adjust: true })
      .expect(201);
    expect(fakes.cashOps.filter((o) => o.kind !== 'INCOME')).toHaveLength(0);
  });

  it('проверки: отрицательная сумма, не-кассовый способ, не число — 400; способ по умолчанию — наличные', async () => {
    await http()
      .post('/finance/cash/reconciliations')
      .send({ method: 'CASH', counted: '-5' })
      .expect(400);
    await http()
      .post('/finance/cash/reconciliations')
      .send({ method: 'EXTERNAL', counted: '5' })
      .expect(400);
    await http().post('/finance/cash/reconciliations').send({ counted: 'abc' }).expect(400);
    const r = await http().post('/finance/cash/reconciliations').send({ counted: '0' }).expect(201);
    expect(r.body.reconciliations[0]).toMatchObject({ method: 'CASH', countedMinor: '0' });
  });
});
