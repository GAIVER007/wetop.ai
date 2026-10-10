import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import { actor, legacyStocked, auditCase, blockedPair, catalog, db, designGap, folio, note, ok, post, receipt, reconciliation, request, snapshot, start, stocked, stop, type Actor, type Row } from './bar-money-fixes.harness';
const sell = (a: Actor, productId: string, quantityUnits = '1', idempotencyKey: string = randomUUID(), method = 'CASH') => request(a, '/bar/sales/retail', 'POST', { productId, quantityUnits, idempotencyKey, method });
const pay = (a: Actor, id: string, amountMinor: string) => request(a, `/bar/receipts/${id}/payments`, 'POST', { amountMinor, method: 'CASH' });
const reverse = (a: Actor, id: unknown, restock: boolean) => request(a, `/bar/sales/${id}/reverse`, 'POST', { restock, reason: 'A3 synthetic return' });
const folioSell = (a: Actor, productId: string, folioId: string, idempotencyKey: string = randomUUID()) => request(a, '/bar/sales/folio', 'POST', { productId, folioId, quantityUnits: '1', idempotencyKey });
const payment = (a: Actor, folioId: string, amount = '150.00') => request(a, '/finance/payments', 'POST', { method: 'CASH', currency: 'KZT', amount, allocations: [{ folioId, amount }] });
const rows = (value: unknown) => value as Row[];

describe.skipIf(process.env.A23_RUNTIME_AUDIT !== '1')('A3 approved money audit through real workspace HTTP and PostgreSQL', () => {
  beforeAll(start, 60000);
  afterAll(stop, 10000);

  auditCase('D-KEY distinct keys allow independent legitimate sales', 'Approved D-KEY; wording clarification for TZ2.4', async () => {
    const a = await actor(); const c = await stocked(a, '3');
    const first = await sell(a, c.product, '1', randomUUID());
    const second = await sell(a, c.product, '1', randomUUID());
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    const s = await snapshot(a, 'two independent keys');
    expect(s.state.sales).toHaveLength(2); expect(s.metrics.units).toBe('1');
    expect(s.metrics.cashDelta).toBe('30000');
  });

  auditCase('SHIFT / A3-1: independently reconciled KZT shift', 'TZ2.2 §7; Q-BAR-1/4/5; DATA_MODEL §27', async () => {
    const a = await actor(); const c = await catalog(a);
    const p1 = await receipt(a, c, '3', '10000'); const p2 = await receipt(a, c, '2', '12000');
    async function check(step: string, units: string, cost: string, debt: string, cash: string) {
      const s = await snapshot(a, step); const report = await ok(a, '/bar/report'); const cashApi = await ok(a, '/finance/cash');
      const expected = { units, stockCost: cost, debt, cashDelta: cash };
      reconciliation.push({ step, expected, actual: s.metrics, report, cashApi });
      expect(s.metrics).toMatchObject(expected); expect(s.metrics.movementUnits).toBe(units);
      expect(report).toMatchObject({ stockCostMinor: cost, supplierDebtMinor: debt }); expect(cashApi.totalMinor).toBe(cash);
    }
    await check('drafts', '0', '0', '0', '0');
    await post(a, p1.id); await check('post P1', '3', '30000', '30000', '0');
    await new Promise(yes => setTimeout(yes, 10));
    await post(a, p2.id); await check('post P2', '5', '54000', '54000', '0');
    const ordered = (await db.query('SELECT r.id,l.received_at FROM bar_stock_lots l JOIN bar_receipt_lines rl ON rl.id=l.receipt_line_id JOIN bar_receipts r ON r.id=rl.receipt_id WHERE l.property_id=$1 ORDER BY l.received_at,l.id', [a.property])).rows;
    expect(ordered.map(r => r.id)).toEqual([p1.id, p2.id]); expect(new Date(ordered[0]!.received_at).getTime()).toBeLessThan(new Date(ordered[1]!.received_at).getTime());
    await ok(a, `/bar/products/${c.product}/price`, 'PATCH', { salePriceMinor: '15000' });
    expect((await pay(a, String(p1.id), '20000')).status).toBe(201); await check('partial P1', '5', '54000', '34000', '-20000');
    expect((await pay(a, String(p1.id), '10000')).status).toBe(201); await check('finish P1', '5', '54000', '24000', '-30000');
    const sold = await sell(a, c.product, '4'); expect(sold.status).toBe(201); expect(sold.body).toMatchObject({ revenueMinor: '60000', costMinor: '42000' });
    await check('retail four', '1', '12000', '24000', '30000');
    expect(await ok(a, '/bar/report')).toMatchObject({ revenueMinor: '60000', costMinor: '42000', grossProfitMinor: '18000', purchasesMinor: '54000', supplierPaidMinor: '30000' });
    const s = await snapshot(a, 'final FIFO snapshots');
    expect(s.state.saleLines).toHaveLength(1); expect(s.state.saleLines[0]).toMatchObject({ quantity_units: '4', sale_price: '15000', revenue: '60000', cost: '42000' });
    expect(s.state.movements.filter(m => m.kind === 'SALE').map(m => [m.units, m.unit_cost]).sort()).toEqual([['-1', '12000'], ['-3', '10000']].sort());
    expect(s.state.supplierPayments).toHaveLength(2); expect(s.state.cash).toHaveLength(3);
    expect((await reverse(a, sold.body.id, true)).status).toBe(201); const returned = await snapshot(a, 'M8 continuation: both FIFO lots restored'); expect(returned.metrics).toMatchObject({ units: '5', stockCost: '54000', movementUnits: '5', debt: '24000', cashDelta: '-30000' }); expect(returned.state.lots.map(l => [l.remaining_units, l.unit_cost])).toEqual([['3', '10000'], ['2', '12000']]); expect(await ok(a, '/bar/report')).toMatchObject({ revenueMinor: '0', costMinor: '0', stockCostMinor: '54000' });
  });

  auditCase('A3-2 new currency writes and Folio mismatch reject atomically', 'Approved D-CUR; old observation A3 accepted foreign receipts', async () => {
    const a=await actor();const c=await stocked(a);const before=await snapshot(a,'currency guard before');
    const foreign=await request(a,'/bar/receipts','POST',{supplierId:c.supplier,documentNumber:randomUUID(),documentDate:'2026-10-07',receivedDate:'2026-10-07',currency:'USD',lines:[{productId:c.product,quantityUnits:'1',unitCostMinor:'1000',markupBasis:0}]});expect(foreign.status).toBe(409);expect((await snapshot(a,'new currency refused')).state).toEqual(before.state);
    const f=await folio(a,'USD');const afterFixture=await snapshot(a,'USD folio only fixture');expect((await folioSell(a,c.product,f)).status).toBe(409);expect((await snapshot(a,'folio mismatch refused')).state).toEqual(afterFixture.state);
  });

  auditCase('A3-3 legacy mixed documents and drafts are guarded', 'Approved D-CUR; LEGACY_ONLY synthetic fixtures', async () => {
    const a=await actor();const c=await stocked(a);const other=await stocked(a);await db.query('UPDATE bar_receipts SET currency=$1 WHERE id=$2',['USD',other.receipt]);note('legacy origin',{receipt:other.receipt,origin:'synthetic pre-existing mismatched currency via SQL, not corrected API'});
    const before=await snapshot(a,'legacy different products');expect((await request(a,'/bar/report')).status).toBe(409);expect((await pay(a,other.receipt,'1000')).status).toBe(409);expect((await sell(a,other.product)).status).toBe(409);expect((await snapshot(a,'legacy monetary refusal')).state).toEqual(before.state);
    const list=rows((await request(a,'/bar/receipts')).body);expect(list.find(r=>r.id===other.receipt)?.currency).toBe('USD');
    const draft=await receipt(a,c,'1','10000');await db.query('UPDATE bar_receipts SET currency=$1 WHERE id=$2',['USD',draft.id]);const beforePost=await snapshot(a,'legacy draft');expect((await request(a,`/bar/receipts/${draft.id}/post`,'POST')).status).toBe(409);expect((await snapshot(a,'legacy draft refused')).state).toEqual(beforePost.state);
  });

  auditCase('A3-3 same-product mixed lots block ambiguous cost paths', 'Approved D-CUR; LEGACY_ONLY synthetic fixtures', async () => {
    const a=await actor();const c=await stocked(a);const second=await receipt(a,c,'1','1000');await post(a,second.id);await db.query('UPDATE bar_receipts SET currency=$1 WHERE id=$2',['USD',second.id]);note('legacy origin',{receipt:second.id,origin:'synthetic pre-existing mixed lots'});
    const before=await snapshot(a,'mixed lots');for(const [path,method,body] of [
      ['/bar/stock','GET',undefined],['/bar/report','GET',undefined],['/bar/sales/retail','POST',{productId:c.product,quantityUnits:'1',method:'CASH',idempotencyKey:randomUUID()}],['/bar/write-offs','POST',{productId:c.product,quantityUnits:'1',reason:'synthetic'}],['/bar/inventory-counts','POST',{productId:c.product,actualUnits:'0',reason:'synthetic'}],
    ] as const)expect((await request(a,path,method,body)).status,path).toBe(409);expect((await snapshot(a,'mixed lots no effects')).state).toEqual(before.state);
  });

  auditCase('A3-5: own scope excludes a different property and currency', 'DATA_MODEL BAR property boundary; narrow scope control', async () => {
    const a = await actor(); const b = await actor('USD'); const ca = await stocked(a); const cb = await legacyStocked(b, '2', '3000');
    const ownReceipts = rows((await request(a, '/bar/receipts')).body); expect(ownReceipts.map(r => r.id)).toEqual([ca.receipt]);
    expect(await ok(a, '/bar/report')).toMatchObject({ purchasesMinor: '30000', stockCostMinor: '30000' });
    const foreign = await pay(a, cb.receipt, '1000'); expect(foreign.status).toBe(404);
    const foreignState = await snapshot(b, 'foreign property after denied payment'); expect(foreignState.state.supplierPayments).toHaveLength(0);
  });

  auditCase('A3-4 foreign property retail: sale currency follows its actual property', 'DATA_MODEL §21 cash currency; USD Property fixture permitted by schema', async () => {
    const a = await actor('USD'); const c = await legacyStocked(a, '2', '1000', '2000'); const sold = await sell(a, c.product); expect(sold.status).toBe(201);
    const s = await snapshot(a, 'USD property retail and cash'); const cash = await ok(a, '/finance/cash'); note('property currency path', { propertyCurrency: a.currency, cash, sale: s.state.sales[0] });
    expect(s.state.sales[0]!.currency, 'A retail sale cannot relabel USD property prices as KZT').toBe('USD'); expect(cash.currency).toBe('USD'); expect(cash.totalMinor).toBe('2000');
    const before=await snapshot(a,'USD explicit price operations'); const auto=await request(a,'/bar/receipts','POST',{supplierId:c.supplier,documentNumber:randomUUID(),documentDate:'2026-10-07',receivedDate:'2026-10-07',currency:'USD',lines:[{productId:c.product,quantityUnits:'1',unitCostMinor:'1000',markupBasis:0}]});expect(auto.status).toBe(409);expect((await snapshot(a,'USD auto price rejected')).state).toEqual(before.state);
  });

  auditCase('D-CUR legacy cash sources never produce a false scalar total', 'Approved D-CUR existing historical settlement guard', async () => {
    const a=await actor();const c=await stocked(a);expect((await pay(a,c.receipt,'10000')).status).toBe(201);
    await db.query('UPDATE bar_receipts SET currency=$1 WHERE id=$2',['USD',c.receipt]);note('legacy cash origin',{receipt:c.receipt,origin:'synthetic pre-existing foreign settlement; currency mutation only fixture'});
    const before=await snapshot(a,'legacy payment');expect((await request(a,'/finance/cash')).status).toBe(409);expect((await snapshot(a,'cash aggregate refused')).state).toEqual(before.state);
  });

  auditCase('A3-6: malformed currency rejected atomically; cross-currency rejection branch recorded', 'service currency syntax and approved currency gap', async () => {
    const a = await actor(); const c = await catalog(a); const before = await snapshot(a, 'invalid currency before');
    const invalid = await request(a, '/bar/receipts', 'POST', { supplierId: c.supplier, documentNumber: randomUUID(), documentDate: '2026-10-07', receivedDate: '2026-10-07', currency: 'Usd', lines: [{ productId: c.product, quantityUnits: '1', unitCostMinor: '1000', markupBasis: 0 }] });
    expect(invalid.status).toBe(400); expect((await snapshot(a, 'invalid currency after')).state).toEqual(before.state);
    note('A3-6 mismatch guard', { status: 'PASS', reference: 'A3-2 approved D-CUR 409; malformed syntax stays 400' });
  });

  auditCase('M1: repeated and concurrent receipt posting has one effective posting', 'DATA_MODEL §27 immutable posted receipt', async () => {
    const a = await actor(); const c = await catalog(a); const r = await receipt(a, c, '2', '10000'); await post(a, r.id);
    const before = await snapshot(a, 'posted once'); expect((await request(a, `/bar/receipts/${r.id}/post`, 'POST')).status).toBe(409);
    expect((await snapshot(a, 'sequential repeat')).state).toEqual(before.state);
    const r2 = await receipt(a, c, '1', '12000');
    const replies = await blockedPair(a, 'bar_receipts', String(r2.id), [() => request(a, `/bar/receipts/${r2.id}/post`, 'POST'), () => request(a, `/bar/receipts/${r2.id}/post`, 'POST')]);
    expect(replies.map(r => r.status).sort()).toEqual([201, 409]);
    const final = await snapshot(a, 'concurrent receipt result'); expect(final.state.lots).toHaveLength(2); expect(final.state.movements).toHaveLength(2); expect(final.state.audit.filter(r => r.action === 'bar.receipt.posted')).toHaveLength(2);
  });

  auditCase('M2 sequential: identical retail replay has one cash and stock effect', 'bar idempotency key contract and DATA_MODEL §27', async () => {
    const a = await actor(); const c = await stocked(a); const key = randomUUID(); const first = await sell(a, c.product, '1', key); const before = await snapshot(a, 'first retail'); const repeat = await sell(a, c.product, '1', key);
    expect(first.status).toBe(201); expect(repeat).toEqual(first); expect((await snapshot(a, 'sequential retail replay')).state).toEqual(before.state);
  });

  auditCase('M2 concurrent: same-key copies replay the one source without a 500', 'idempotent sequential response and atomic sale/cash', async () => {
    const a = await actor(); const c = await stocked(a); const key = randomUUID(); const replies = await blockedPair(a, 'bar_stock_lots', c.product, [() => sell(a, c.product, '1', key), () => sell(a, c.product, '1', key)]);
    const s = await snapshot(a, 'concurrent same-key effects'); expect(s.state.sales).toHaveLength(1); expect(s.state.cash).toHaveLength(1); expect(s.metrics.units).toBe('2'); expect(s.metrics.movementUnits).toBe('2');
    note('atomicity holds independently from replay response', replies); expect(replies.map(r => r.status)).toEqual([201, 201]); expect(replies[0]!.body.id).toBe(replies[1]!.body.id);
  });

  auditCase('M2 payload identity: product, quantity, method and retail/Folio reuse', 'TZ2.2 M2; no approved mismatch HTTP status', async () => {
    const a = await actor(); const c = await stocked(a, '8'); const other = await stocked(a); const f = await folio(a); const key = randomUUID(); const original = await sell(a, c.product, '1', key); const before = await snapshot(a, 'identity original');
    const variants = [await sell(a, other.product, '1', key), await sell(a, c.product, '2', key), await sell(a, c.product, '1', key, 'KASPI'), await folioSell(a, c.product, f, key)];
    expect((await snapshot(a, 'identity variants')).state).toEqual(before.state);
    const folioKey = randomUUID(); const originalFolio = await folioSell(a, c.product, f, folioKey); const beforeRetailMode = await snapshot(a, 'Folio first before retail-mode replay'); const retailOfFolio = await sell(a, c.product, '1', folioKey); expect((await snapshot(a, 'Folio to retail key reuse')).state).toEqual(beforeRetailMode.state);
    note('mismatch replies point at the original unrelated request', { original, variants, originalFolio, retailOfFolio });
    expect(variants.map(r => r.status)).toEqual([409,409,409,409]); expect(retailOfFolio.status).toBe(409);
  });


  auditCase('D-KEY Folio identical and changed concurrent replays', 'Approved D-KEY', async () => {
    const a = await actor(); const c = await stocked(a, '8'); const f = await folio(a); const f2 = await folio(a); const key = randomUUID();
    const pair = await blockedPair(a, 'bar_stock_lots', c.product, [() => folioSell(a,c.product,f,key), () => folioSell(a,c.product,f,key)]); expect(pair.map(r => r.status)).toEqual([201,201]); expect(pair[0]!.body).toEqual(pair[1]!.body);
    const before = await snapshot(a,'Folio concurrent replay'); expect(before.state.charges).toHaveLength(1); expect(before.state.sales).toHaveLength(1);
    expect((await folioSell(a,c.product,f2,key)).status).toBe(409); await reverse(a,pair[0]!.body.id,true); const replay = await folioSell(a,c.product,f,key); expect(replay.body.status).toBe('REVERSED');
    const k2=randomUUID(); const mixed=await blockedPair(a,'bar_stock_lots',c.product,[() => sell(a,c.product,'1',k2),() => folioSell(a,c.product,f,k2)]); expect(mixed.map(r=>r.status).sort()).toEqual([201,409]);
    const k3=randomUUID(); const quantity=await blockedPair(a,'bar_stock_lots',c.product,[() => sell(a,c.product,'1',k3),() => sell(a,c.product,'2',k3)]); expect(quantity.map(r=>r.status).sort()).toEqual([201,409]);
    await ok(a,`/bar/products/${c.product}/price`,'PATCH',{salePriceMinor:'19000'}); const old = await folioSell(a,c.product,f,key); expect(old.body.revenueMinor).toBe('15000'); expect(old.body.id).toBe(pair[0]!.body.id);
  });

  auditCase('M3: replay after reversal reports the persisted terminal status', 'truthful status and no repeated monetary effect', async () => {
    const a = await actor(); const c = await stocked(a); const key = randomUUID(); const sale = await sell(a, c.product, '1', key); expect((await reverse(a, sale.body.id, true)).status).toBe(201); const before = await snapshot(a, 'reversed before replay'); const replay = await sell(a, c.product, '1', key); const after = await snapshot(a, 'reversed replay');
    expect(after.state).toEqual(before.state); expect(replay.body.status).toBe(after.state.sales[0]!.status);
  });

  auditCase('M4 retail/retail: controlled race cannot oversell last unit', 'Q-BAR-8; DATA_MODEL §27 atomics', async () => {
    const a = await actor(); const c = await stocked(a, '1'); const replies = await blockedPair(a, 'bar_stock_lots', c.product, [() => sell(a, c.product), () => sell(a, c.product)]);
    expect(replies.map(r => r.status).sort()).toEqual([201, 409]); const s = await snapshot(a, 'last unit two retail'); expect(s.state.sales).toHaveLength(1); expect(s.state.cash).toHaveLength(1); expect(s.state.charges).toHaveLength(0); expect(s.metrics).toMatchObject({ units: '0', movementUnits: '0' });
  });

  auditCase('M4 retail/writeoff: controlled shared stock race is atomic', 'Q-BAR-8; Q-BAR-1', async () => {
    const a = await actor(); const c = await stocked(a, '1'); const replies = await blockedPair(a, 'bar_stock_lots', c.product, [() => sell(a, c.product), () => request(a, '/bar/write-offs', 'POST', { productId: c.product, quantityUnits: '1', reason: 'A3 synthetic loss' })]);
    expect(replies.map(r => r.status).sort()).toEqual([201, 409]); const s = await snapshot(a, 'retail versus writeoff'); expect(s.metrics).toMatchObject({ units: '0', movementUnits: '0' }); expect(s.state.movements.filter(r => r.kind !== 'RECEIPT')).toHaveLength(1); expect(s.state.cash.length).toBe(s.state.sales.length); expect(s.state.audit.filter(r => ['bar.sale.posted', 'bar.stock.written_off'].includes(String(r.action)))).toHaveLength(1);
  });

  auditCase('M5: partial payments, overpayment and concurrent debt limit', 'Q-BAR-4; amount and one cash source per payment', async () => {
    const a = await actor(); const c = await stocked(a, '3'); expect((await pay(a, c.receipt, '10000')).status).toBe(201); const before = await snapshot(a, 'partial supplier payment'); expect((await pay(a, c.receipt, '20001')).status).toBe(409); expect((await snapshot(a, 'overpayment denied')).state).toEqual(before.state);
    const replies = await blockedPair(a, 'bar_receipts', c.receipt, [() => pay(a, c.receipt, '15000'), () => pay(a, c.receipt, '15000')]); expect(replies.map(r => r.status).sort()).toEqual([201, 409]);
    const s = await snapshot(a, 'concurrent supplier payments'); expect(s.metrics).toMatchObject({ paid: '25000', debt: '5000', cashDelta: '-25000' }); expect(s.state.supplierPayments).toHaveLength(2); expect(s.state.cash).toHaveLength(2);
    expect((await pay(a, c.receipt, '5000')).status).toBe(201); expect((await snapshot(a, 'exact debt payment')).metrics.debt).toBe('0');
  });

  auditCase('M5 cash void: supplier debt agrees with surviving settlement', 'DATA_MODEL §21 VOIDED cash; Q-BAR-4 supplier debt', async () => {
    const a = await actor(); const c = await stocked(a); expect((await pay(a, c.receipt, '10000')).status).toBe(201); const before = await snapshot(a, 'supplier paid'); const id = before.state.supplierPayments[0]!.cash_operation_id;
    const cancelled = await request(a, `/finance/cash/operations/${id}/void`, 'POST'); expect(cancelled.status).toBe(200); const after = await snapshot(a, 'supplier cash voided'); const report = await ok(a, '/bar/report'); const list = rows((await request(a, '/bar/receipts')).body);
    expect(after.metrics.cashDelta).toBe('0'); note('debt after supported cash cancellation', { report, list, settledDebt: after.metrics.settledDebt }); expect(report.supplierDebtMinor).toBe(after.metrics.settledDebt); expect(list.find(r => r.id === c.receipt)).toMatchObject({ paidAmount: '0', dueAmount: '30000' });
    expect((await pay(a, c.receipt, '30000')).status).toBe(201);
    const repaid = await snapshot(a, 'full repayment after void'); expect(repaid.metrics.settledDebt).toBe('0'); expect(repaid.metrics.cashDelta).toBe('-30000'); expect(repaid.state.supplierPayments).toHaveLength(2);
    expect((await request(a, `/finance/cash/operations/${id}/void`, 'POST')).status).toBe(409);
    const id2 = repaid.state.supplierPayments.find(p => p.cash_status === 'COMPLETED')!.cash_operation_id;
    const raced = await blockedPair(a, 'bar_receipts', c.receipt, [() => request(a, `/finance/cash/operations/${id2}/void`, 'POST'), () => pay(a, c.receipt, '10000')]);
    expect(raced[0]!.status).toBe(200); expect([201,409]).toContain(raced[1]!.status);
    const final = await snapshot(a, 'void pay serialized result'); const finalReport = await ok(a, '/bar/report'); const finalList = rows((await request(a, '/bar/receipts')).body); expect(finalReport.supplierDebtMinor).toBe(final.metrics.settledDebt); expect(finalList.find(r => r.id === c.receipt)?.dueAmount).toBe(final.metrics.settledDebt);
  });

  auditCase('M6: payment replay has no operation identity contract', 'Q-BAR-4; TZ2.2 M6 explicitly distinguishes legal partial payments', async () => {
    const a = await actor(); const c = await stocked(a); const first = await pay(a, c.receipt, '10000'); const second = await pay(a, c.receipt, '10000'); expect(first.status).toBe(201); expect(second.status).toBe(201); const s = await snapshot(a, 'two identical legitimate partial bodies'); expect(s.state.supplierPayments).toHaveLength(2); expect(s.metrics.paid).toBe('20000');
    designGap('Supplier payment request has no idempotencyKey/payment identity. A lost-response retry cannot be distinguished from a new legal partial payment. No deduplication rule was invented.');
  });

  auditCase('M7: Folio Charge, real guest payment, no duplicate cash/sale', 'DATA_MODEL §§6/21; Q-BAR-5', async () => {
    const a = await actor(); const c = await stocked(a); const f = await folio(a); const sale = await folioSell(a, c.product, f); expect(sale.status).toBe(201); const before = await snapshot(a, 'unpaid folio'); expect(before.state.charges).toHaveLength(1); expect(before.state.cash).toHaveLength(0); expect(before.metrics.cashDelta).toBe('0'); const repeatedSale = await folioSell(a, c.product, f, String(before.state.sales[0]!.idempotency_key)); expect(repeatedSale.status).toBe(201); expect(repeatedSale.body.id).toBe(sale.body.id); expect((await snapshot(a, 'Folio sale same-key replay')).state).toEqual(before.state);
    const paid = await payment(a, f); expect(paid.status).toBe(201); const after = await snapshot(a, 'guest payment'); expect(after.state.sales).toHaveLength(1); expect(after.state.payments).toHaveLength(1); expect(after.state.allocations).toHaveLength(1); expect(after.state.cash).toHaveLength(0); expect(after.metrics).toMatchObject({ units: '2', cashDelta: '15000' }); expect((await ok(a, '/finance/cash')).totalMinor).toBe('15000');
  });

  auditCase('M7: closed/foreign Folio rejected atomically; payment currency mismatch', 'DATA_MODEL §6 and existing openFolio contract', async () => {
    const a = await actor(); const c = await stocked(a); const f = await folio(a); const close = await request(a, `/finance/folios/${f}/close`, 'POST'); expect(close.status).toBe(200); const before = await snapshot(a, 'before closed folio attempt'); expect((await folioSell(a, c.product, f)).status).toBe(404); expect((await snapshot(a, 'closed folio denied')).state).toEqual(before.state);
    const other = await actor(); const foreign = await folio(other); expect((await folioSell(a, c.product, foreign)).status).toBe(404);
    const usd = await folio(a, 'USD'); const wrong = await payment(a, usd); expect(wrong.status).toBe(400); expect((await snapshot(a, 'mismatched guest payment denied')).state.payments).toHaveLength(0);
  });

  auditCase('M8: retail return restocks original lots and repeats have no effect', 'DATA_MODEL §27 snapshot costs and sale return', async () => {
    const a = await actor(); const c = await stocked(a, '3', '10000'); const initial = await snapshot(a, 'stock before return'); const sale = await sell(a, c.product, '2'); expect(sale.status).toBe(201); expect((await reverse(a, sale.body.id, true)).status).toBe(201); const after = await snapshot(a, 'restocked return'); expect(after.metrics).toMatchObject({ units: '3', stockCost: '30000', movementUnits: '3', cashDelta: '0' }); expect(after.state.lots).toEqual(initial.state.lots); expect(after.state.sales[0]!.status).toBe('REVERSED'); expect(after.state.cash[0]!.status).toBe('VOIDED'); expect(after.state.movements.filter(r => r.kind === 'SALE_RETURN')[0]).toMatchObject({ units: '2', unit_cost: '10000' });
    expect((await reverse(a, sale.body.id, true)).status).toBe(409); expect((await snapshot(a, 'second return refused')).state).toEqual(after.state);
  });

  auditCase('M9: return without restock keeps depletion; cost accounting gap explicit', 'plan §5 physical restock flag; TZ2.2 M9', async () => {
    const a = await actor(); const c = await stocked(a, '3'); const sale = await sell(a, c.product); expect((await reverse(a, sale.body.id, false)).status).toBe(201); const s = await snapshot(a, 'return without goods'); expect(s.metrics).toMatchObject({ units: '2', stockCost: '20000', movementUnits: '2', cashDelta: '0' }); expect(s.state.movements.filter(r => r.kind === 'SALE_RETURN')).toHaveLength(0); expect(s.state.sales[0]!.total_cost).toBe('10000'); const report = await ok(a, '/bar/report'); note('cost absent from POSTED report after no-restock return', report);
    designGap('Stored reversed sale keeps 10000 cost and physical stock stays depleted; report removes this sale revenue/cost and has no separate loss dimension. Approved attribution of non-restocked returned cost is not specified; no new expense category was assumed.');
  });

  auditCase('M10: unpaid Folio reversal cancels Charge without fictitious refund', 'DATA_MODEL §6 Charge and Refund are separate', async () => {
    const a = await actor(); const c = await stocked(a); const f = await folio(a); const sale = await folioSell(a, c.product, f); expect(sale.status).toBe(201); expect((await reverse(a, sale.body.id, true)).status).toBe(201); const s = await snapshot(a, 'unpaid folio returned'); expect(s.state.charges[0]!.voided_at).not.toBeNull(); expect(s.state.payments).toHaveLength(0); expect(s.state.refunds).toHaveLength(0); expect(s.metrics.cashDelta).toBe('0');
  });

  auditCase('M10: paid Folio reversal and explicit Refund remain distinct', 'DATA_MODEL §6 Payment/Allocation/Refund balance', async () => {
    const a = await actor(); const c = await stocked(a); const f = await folio(a); const sale = await folioSell(a, c.product, f); expect((await payment(a, f)).status).toBe(201); expect((await reverse(a, sale.body.id, true)).status).toBe(201); const beforeRefund = await snapshot(a, 'paid charge reversed before money refund'); expect(beforeRefund.state.refunds).toHaveLength(0); expect(beforeRefund.metrics.cashDelta).toBe('15000'); expect(beforeRefund.state.charges[0]!.voided_at).not.toBeNull(); const pid = beforeRefund.state.payments[0]!.id;
    const refunded = await request(a, `/finance/payments/${pid}/refunds`, 'POST', { folioId: f, amount: '150.00', reason: 'A3 explicit guest refund' }); expect(refunded.status).toBe(201); const after = await snapshot(a, 'explicit refund'); expect(after.state.refunds).toHaveLength(1); expect(after.state.allocations).toHaveLength(1); expect(after.metrics.cashDelta).toBe('0'); expect((await ok(a, '/finance/cash')).totalMinor).toBe('0'); const repeated = await request(a, `/finance/payments/${pid}/refunds`, 'POST', { folioId: f, amount: '150.00', reason: 'A3 repeated refund' }); expect([400, 409]).toContain(repeated.status); expect((await snapshot(a, 'over-refund rejected')).state).toEqual(after.state);
  });

  auditCase('M11: controlled real DB constraint failure after cash creation rolls back', 'TZ2.3 equivalent rollback; temporary check in own test schema only', async () => {
    const a=await actor();const c=await stocked(a);const before=await snapshot(a,'before real DB failure');
    const constraint='a23_sale_failure_'+a.property.replaceAll('-','');
    // Only this synthetic property is rejected. No product fault hook or persistent migration.
    await db.query(`ALTER TABLE bar_sales ADD CONSTRAINT "${constraint}" CHECK (property_id <> '${a.property}'::uuid)`);
    try { const failed=await sell(a,c.product);expect(failed.status).toBe(500);expect((await snapshot(a,'rollback after cash stage')).state).toEqual(before.state); }
    finally { await db.query(`ALTER TABLE bar_sales DROP CONSTRAINT "${constraint}"`); }
    note('rollback mechanism',{constraint,scope:a.property,removed:true,originalOverflow:'Preserved in unchanged A3 audit; new input bounds make that receipt unavailable'});
  });

  auditCase('N1: price preview, persisted receipt calculatedPrice and posted salePrice', 'Q-BAR-2, ten-tenge ceiling in KZT only', async () => {
    const a = await actor(); const c = await catalog(a); for (const [cost, markup, expected] of [['10000', 0, '10000'], ['10001', 0, '11000'], ['10000', 3500, '14000']] as const) {
      const r = await receipt(a, c, '1', cost, 'KZT', markup); expect(rows(r.lines)[0]!.calculatedPrice).toBe(expected); const before = await snapshot(a, 'calculated price before posting'); expect(before.state.receiptLines.find(l => l.receipt_id === r.id)?.calculated_price).toBe(expected); await post(a, r.id); const after = await snapshot(a, 'posted rounded price'); expect(after.state.products.find(p => p.id === c.product)?.sale_price).toBe(expected);
    }
  });

  auditCase('N2: category default, product override, line override and zero markup', 'Q-BAR-3; receipt-form.tsx inheritance contract and explicit API line', async () => {
    const a = await actor(); const inherited = await catalog(a, 3500, null); const inheritedProducts = rows((await request(a, '/bar/products')).body); const inheritedProduct = inheritedProducts.find(p => p.id === inherited.product)!; expect(inheritedProduct.markupBasis).toBeNull(); const categoryBasis = (inheritedProduct.category as Row).defaultMarkupBasis; expect(categoryBasis).toBe(3500); const inheritedReceipt = await receipt(a, inherited, '1', '10000', 'KZT', categoryBasis); expect(rows(inheritedReceipt.lines)[0]!.calculatedPrice).toBe('14000'); await post(a, inheritedReceipt.id);
    const c = await catalog(a, 3500, 7000); const products = rows((await request(a, '/bar/products')).body); const overridden = products.find(p => p.id === c.product)!; expect(overridden.markupBasis).toBe(7000); expect((overridden.category as Row).defaultMarkupBasis).toBe(3500);
    for (const [markup, expected] of [[3500, '14000'], [7000, '17000'], [0, '10000'], [3525, '14000']] as const) { const r = await receipt(a, c, '1', '10000', 'KZT', markup); expect(rows(r.lines)[0]).toMatchObject({ markupBasis: markup, calculatedPrice: expected }); await post(a, r.id); expect((await snapshot(a, 'explicit markup persisted')).state.products.find(p => p.id === c.product)?.sale_price).toBe(expected); }
    note('inheritance layer', { staticUI: 'receipt-form.tsx:39 product.markupBasis ?? category.defaultMarkupBasis ?? 0; explicit line submitted by form', browserNotRun: true });
  });

  auditCase('N3 quantities/UUID: invalid inputs rejected with zero partial effect', 'integer/bigint fields and service validators', async () => {
    const a = await actor(); const c = await stocked(a); const before = await snapshot(a, 'quantity validation before'); const responses = [];
    for (const quantity of ['0', '-1', '1.5', '', 1.5]) responses.push(await request(a, '/bar/sales/retail', 'POST', { productId: c.product, quantityUnits: quantity, method: 'CASH', idempotencyKey: randomUUID() }));
    for (const cost of ['0', '-1', '1.5', '']) responses.push(await request(a, '/bar/receipts', 'POST', { supplierId: c.supplier, documentNumber: randomUUID(), documentDate: '2026-10-07', receivedDate: '2026-10-07', currency: 'KZT', lines: [{ productId: c.product, quantityUnits: '1', unitCostMinor: cost, markupBasis: 0 }] }));
    responses.push(await sell(a, 'not-a-uuid')); responses.push(await request(a, '/bar/receipts/not-a-uuid/post', 'POST'));
    expect(responses.map(r => r.status)).toEqual(responses.map(() => 400)); expect((await snapshot(a, 'quantity validation after')).state).toEqual(before.state);
  });

  auditCase('N3 calendar: both dates exist and preserve calendar day', 'TZ2.3 dates', async () => {
    const a=await actor();const c=await catalog(a);
    const body={ supplierId:c.supplier, documentNumber:'A23 dates', documentDate:'2026-10-07',receivedDate:'2026-10-07',currency:'KZT',lines:[{productId:c.product,quantityUnits:'1',unitCostMinor:'10000',markupBasis:0}] };
    const before=await snapshot(a,'before invalid dates');
    for(const field of ['documentDate','receivedDate']) for(const date of ['2026-02-29','2026-02-30','2026-00-01','2026-01-00','2026-04-31','2026-13-01','26-02-01','']) {
      const r=await request(a,'/bar/receipts','POST',{...body,[field]:date});expect(r.status,field+':'+date).toBe(400);expect((await snapshot(a,'invalid date no effect')).state).toEqual(before.state);
    }
    for(const date of ['2026-10-07','2028-02-29']) {
      const r=await ok(a,'/bar/receipts','POST',{...body,documentNumber:randomUUID(),documentDate:date,receivedDate:date});const stored=(await db.query('SELECT document_date::text AS document_date,received_date::text AS received_date FROM bar_receipts WHERE id=$1',[r.id])).rows[0];expect(stored).toEqual({document_date:date,received_date:date});
    }
  });

  auditCase('N3 integer/bigint bounds: schema-invalid values do not become unhandled 500', 'native Int32/Int64 boundaries, no invented limits', async () => {
    const a = await actor(); const c = await catalog(a); const before = await snapshot(a, 'schema bounds before'); const replies = [];
    replies.push(await request(a, '/bar/products', 'POST', { code: randomUUID(), name: 'A3 outside int32 package', unitsPerPackage: 2147483648, salePriceMinor: '10000', minimumStockUnits: '0' }));
    replies.push(await request(a, '/bar/categories', 'POST', { name: 'A3 unsafe markup', defaultMarkupBasis: '9007199254740993' }));
    replies.push(await request(a, `/bar/products/${c.product}/price`, 'PATCH', { salePriceMinor: '9223372036854775808' }));
    replies.push(await request(a, '/bar/categories', 'POST', { name: randomUUID(), defaultMarkupBasis: 9007199254740992 }));
    replies.push(await sell(a,c.product,'9223372036854775808'));
    const b={supplierId:c.supplier,documentNumber:randomUUID(),documentDate:'2026-10-07',receivedDate:'2026-10-07',currency:'KZT'};
    for(const lines of [
      [{productId:c.product,quantityUnits:'2',unitCostMinor:'9223372036854775000',markupBasis:0}],
      [{productId:c.product,quantityUnits:'1',unitCostMinor:'9223372036854775000',markupBasis:1}],
      [{productId:c.product,quantityUnits:'1',unitCostMinor:'5000000000000000000',markupBasis:0},{productId:c.product,quantityUnits:'1',unitCostMinor:'5000000000000000000',markupBasis:0}]
    ]) replies.push(await request(a,'/bar/receipts','POST',{...b,lines}));
    note('schema boundary replies', replies); expect((await snapshot(a, 'schema bounds after')).state).toEqual(before.state); expect(replies.every(r => r.status >= 400 && r.status < 500), 'Known invalid numeric fields should be handled as client input errors').toBe(true);
  });

  auditCase('N3 exact bigint: valid money above JS safe integer persists exactly', 'DATA_MODEL §27 integer money; Postgres bigint range', async () => {
    const a = await actor(); const c = await catalog(a); const price = '9007199254740993'; const changed = await ok(a, `/bar/products/${c.product}/price`, 'PATCH', { salePriceMinor: price }); expect(changed.salePrice).toBe(price); expect((await snapshot(a, 'large exact price')).state.products[0]!.sale_price).toBe(price);
  });

  auditCase('N4/5: writeoff FIFO, inventory shortage, no-op and denied surplus', 'Q-BAR-1/8/9; audit/physical ledger DATA_MODEL §27', async () => {
    const a = await actor(); const c = await catalog(a); const r1 = await receipt(a, c, '3', '10000'); await post(a, r1.id); await new Promise(yes => setTimeout(yes, 5)); const r2 = await receipt(a, c, '2', '12000'); await post(a, r2.id);
    const written = await ok(a, '/bar/write-offs', 'POST', { productId: c.product, quantityUnits: '4', reason: 'A3 synthetic loss' }); expect(written.costMinor).toBe('42000'); const afterLoss = await snapshot(a, 'FIFO writeoff'); expect(afterLoss.metrics).toMatchObject({ units: '1', stockCost: '12000', movementUnits: '1' }); expect(await ok(a, '/bar/report')).toMatchObject({ writeOffMinor: '42000' });
    const noop = await ok(a, '/bar/inventory-counts', 'POST', { productId: c.product, actualUnits: '1', reason: 'A3 exact count' }); expect(noop.differenceUnits).toBe('0'); const afterNoop = await snapshot(a, 'zero discrepancy'); expect(afterNoop.state.movements).toEqual(afterLoss.state.movements); expect(afterNoop.state.audit.length).toBe(afterLoss.state.audit.length + 1);
    const surplus = await request(a, '/bar/inventory-counts', 'POST', { productId: c.product, actualUnits: '2', reason: 'A3 unapproved surplus' }); expect(surplus.status).toBe(409); expect((await snapshot(a, 'surplus denied')).state).toEqual(afterNoop.state);
    const shortage = await ok(a, '/bar/inventory-counts', 'POST', { productId: c.product, actualUnits: '0', reason: 'A3 synthetic shortage' }); expect(shortage.costMinor).toBe('12000'); const final = await snapshot(a, 'inventory shortage'); expect(final.metrics).toMatchObject({ units: '0', movementUnits: '0', stockCost: '0' }); expect(final.state.movements.find(m => m.kind === 'INVENTORY_ADJUSTMENT')).toMatchObject({ units: '-1', unit_cost: '12000', created_by_id: a.user });
  });

  auditCase('N6: archived product rejected; category/supplier historical boundary explicit', 'existing active contract without inventing historical restrictions', async () => {
    const a = await actor(); const c = await stocked(a); await ok(a, `/bar/products/${c.product}/active`, 'PATCH', { active: false }); const before = await snapshot(a, 'inactive product'); expect((await sell(a, c.product)).status).toBe(404); expect((await snapshot(a, 'inactive sale rejected')).state).toEqual(before.state);
    await ok(a, `/bar/products/${c.product}/active`, 'PATCH', { active: true }); await ok(a, `/bar/categories/${c.category}/active`, 'PATCH', { active: false }); await ok(a, `/bar/suppliers/${c.supplier}/active`, 'PATCH', { active: false }); const r = await receipt(a, c, '1', '10000'); await post(a, r.id); expect((await sell(a, c.product)).status).toBe(201); await snapshot(a, 'inactive supplier/category observed');
    designGap('Product.active explicitly gates sales. API permits a new receipt with archived supplier/category and sale of an active product in an inactive category. An approved distinction between historical completion and new operations is not documented; no extra prohibition was inferred from active alone.');
  });
});
