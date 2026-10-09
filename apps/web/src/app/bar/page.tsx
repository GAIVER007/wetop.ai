import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi, type BarReceiptRow, type BarSaleRow } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { Badge, EmptyState, Stat, Stats, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { StockBoard } from './stock-board';
import { stockStatusOf } from './stock-status';
import { BarTabs } from './tabs';
import './bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

const receiptTone = (receipt: BarReceiptRow) => {
  if (receipt.status === 'DRAFT') return { tone: 'neutral' as const, label: 'Черновик' };
  if (BigInt(receipt.dueAmount) <= 0n) return { tone: 'ok' as const, label: 'Оплачен' };
  return BigInt(receipt.paidAmount) > 0n
    ? { tone: 'warn' as const, label: 'Оплачен частично' }
    : { tone: 'danger' as const, label: 'Не оплачен' };
};

/** Топ продаж по штукам из проведённых продаж: «Популярные товары» правой нижней панели макета */
function popularOf(sales: BarSaleRow[]): Array<{ name: string; units: bigint }> {
  const byName = new Map<string, bigint>();
  for (const sale of sales) {
    if (sale.status !== 'POSTED') continue;
    for (const line of sale.lines)
      byName.set(line.product.name, (byName.get(line.product.name) ?? 0n) + BigInt(line.quantityUnits));
  }
  return [...byName.entries()].map(([name, units]) => ({ name, units }))
    .sort((a, b) => (a.units === b.units ? a.name.localeCompare(b.name, 'ru') : a.units > b.units ? -1 : 1))
    .slice(0, 5);
}

/**
 * Обзор бара по макету владельца (09.10.2026, ADR-154): показатели, быстрая продажа, «Товары и остатки»
 * с карточкой товара боковой панелью, приходы поставщиков и популярные товары. Журналы целиком и
 * справочники живут на вкладках раздела.
 */
export default async function BarPage() {
  await requireVertical(['HOSPITALITY']);
  const [categories, stock, folios, receipts, sales, report] = await Promise.all([
    settle(barApi.categories()), settle(barApi.stock()), settle(barApi.folios()),
    settle(barApi.receipts()), settle(barApi.sales()), settle(barApi.report()),
  ]);
  const failed = [categories, stock, folios, receipts, sales, report].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!categories.ok || !stock.ok || !folios.ok || !receipts.ok || !sales.ok || !report.ok) return null;
  const active = stock.value.filter((item) => item.active);
  const unitsTotal = active.reduce((sum, item) => sum + BigInt(item.availableUnits), 0n);
  const lowCount = active.filter((item) => stockStatusOf(item) !== 'ok').length;
  const debtors = new Set(receipts.value.filter((receipt) => receipt.status === 'POSTED' && BigInt(receipt.dueAmount) > 0n).map((receipt) => receipt.supplier.id)).size;
  const revenue = BigInt(report.value.revenueMinor);
  const margin = revenue > 0n ? Number((BigInt(report.value.grossProfitMinor) * 100n) / revenue) : null;
  const lastReceipts = [...receipts.value]
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
    .slice(0, 5);
  const popular = popularOf(sales.value);
  return <Page width="wide" title="Бар" subtitle="Учёт товаров: закупки, продажи, остатки, себестоимость, наценка и долги поставщикам." actions={<>
    <Link className="btn btn--secondary" href="/bar/receipts/new" prefetch={false}>Приход</Link>
    <Link className="btn btn--secondary" href="/bar/operations" prefetch={false}>Инвентаризация</Link>
    <Link className="btn" href="/bar/products" prefetch={false}>Добавить товар</Link>
  </>}>
    <BarTabs current="overview" />
    <Stats min={150} className="bar-stats">
      <Stat label="Товаров" value={active.length} hint="активных позиций" size="sm" />
      <Stat label="Остаток на складе" value={`${unitsTotal} шт.`} hint={`на сумму ${formatMoney(report.value.stockCostMinor)}`} size="sm" />
      <Stat label="Закуплено" value={formatMoney(report.value.purchasesMinor)} hint={`оплачено ${formatMoney(report.value.supplierPaidMinor)}`} size="sm" />
      <Stat label="Выручка бара" value={formatMoney(report.value.revenueMinor)} hint={`списано ${formatMoney(report.value.writeOffMinor)}`} size="sm" />
      <Stat label="Валовая прибыль" value={formatMoney(report.value.grossProfitMinor)} hint={margin === null ? 'продаж пока нет' : `маржинальность ${margin}%`} size="sm" />
      <Stat label="Долг поставщикам" value={formatMoney(report.value.supplierDebtMinor)} tone={BigInt(report.value.supplierDebtMinor) > 0n ? 'warn' : undefined} hint={debtors > 0 ? `поставщиков: ${debtors}` : 'долгов нет'} size="sm" />
      <Stat label="Заканчиваются" value={lowCount} tone={lowCount > 0 ? 'danger' : undefined} hint="товаров на минимуме" size="sm" />
    </Stats>
    <div className="bar-quick">
      <section className="panel bar-quick-panel">
        <h3><Icon name="receipt" /> Быстрая продажа</h3>
        <p className="bar-muted">Продайте товар напрямую: остаток и касса обновятся сразу.</p>
        <SaleForm stock={stock.value} />
      </section>
      <section className="panel bar-quick-panel">
        <h3><Icon name="guests" /> Добавить в счёт гостя</h3>
        <p className="bar-muted">Товар ляжет строкой в открытый счёт брони.</p>
        {folios.value.length === 0
          ? <EmptyState icon={<Icon name="guests" />} title="Нет открытых счетов">Продажу можно записать слева, без брони.</EmptyState>
          : <FolioSaleForm stock={stock.value} folios={folios.value} />}
      </section>
    </div>
    {active.length === 0
      ? <EmptyState icon={<Icon name="inventory" />} title="Товаров пока нет">Добавьте первый товар на вкладке «Товары» или загрузите накладную: «Приходы» → «Новый приход».</EmptyState>
      : <StockBoard stock={stock.value} categories={categories.value} />}
    <div className="bar-bottom">
      <section className="panel bar-bottom-panel">
        <header className="bar-bottom-head">
          <h3>Приходы от поставщиков</h3>
          <Link href="/bar/receipts" prefetch={false}>Все приходы</Link>
        </header>
        {lastReceipts.length === 0
          ? <p className="bar-muted">Приходов пока нет: занесите первую счёт-фактуру.</p>
          : <Table density="compact" aria-label="Последние приходы поставщиков" plain>
              <thead><tr><th>Дата</th><th>Поставщик</th><th>Документ</th><th>Позиций</th><th>Сумма</th><th>Статус</th></tr></thead>
              <tbody>{lastReceipts.map((receipt) => {
                const badge = receiptTone(receipt);
                return <tr key={receipt.id}>
                  <td>{receipt.receivedDate.slice(0, 10)}</td>
                  <td>{receipt.supplier.name}</td>
                  <td>{receipt.documentNumber}</td>
                  <td>{receipt._count.lines}</td>
                  <td>{formatMoney(receipt.totalAmount)}</td>
                  <td><Badge tone={badge.tone}>{badge.label}</Badge></td>
                </tr>;
              })}</tbody>
            </Table>}
      </section>
      <section className="panel bar-bottom-panel">
        <header className="bar-bottom-head"><h3>Популярные товары</h3></header>
        {popular.length === 0
          ? <p className="bar-muted">Продаж пока нет: первая продажа заполнит список.</p>
          : <ol className="bar-popular">{popular.map((item) => (
              <li key={item.name}><span>{item.name}</span><b>{item.units.toString()} шт.</b></li>
            ))}</ol>}
      </section>
    </div>
  </Page>;
}
