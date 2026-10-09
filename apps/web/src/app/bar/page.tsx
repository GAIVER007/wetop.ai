import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi, type BarReceiptRow, type BarReport, type BarSaleRow } from '../../lib/api';
import { hotelToday } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Page } from '../../components/page';
import { ActionMenu } from '../../components/action-menu';
import { Badge, EmptyState, Table, cx } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { StockBoard } from './stock-board';
import { sharePercent, stockStatusOf } from './stock-status';
import './bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

const receiptBadge = (receipt: BarReceiptRow) => {
  if (receipt.status === 'DRAFT') return { tone: 'neutral' as const, label: 'Черновик' };
  if (BigInt(receipt.dueAmount) <= 0n) return { tone: 'ok' as const, label: 'Оплачен' };
  return BigInt(receipt.paidAmount) > 0n
    ? { tone: 'warn' as const, label: 'Оплачен частично' }
    : { tone: 'danger' as const, label: 'Не оплачен' };
};
const dayRu = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** Популярные за 30 дней: из отчёта API; старый API без поля, тогда из последних продаж */
function popularOf(report: BarReport, sales: BarSaleRow[]): Array<{ name: string; units: string }> {
  if (report.popular) return report.popular;
  const byName = new Map<string, bigint>();
  for (const sale of sales) {
    if (sale.status !== 'POSTED') continue;
    for (const line of sale.lines) byName.set(line.product.name, (byName.get(line.product.name) ?? 0n) + BigInt(line.quantityUnits));
  }
  return [...byName.entries()].sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0], 'ru') : a[1] > b[1] ? -1 : 1))
    .slice(0, 5).map(([name, units]) => ({ name, units: units.toString() }));
}

/** Плитка показателя по макету: цветная иконка слева, подпись, число, подсказка или прирост к прошлому месяцу */
function Kpi({ icon, tone, label, value, hint, growth, alarm }: {
  icon: IconName;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
  value: string;
  hint?: string;
  growth?: number | null;
  alarm?: boolean;
}) {
  return <div className={cx('bar-kpi', alarm && 'bar-kpi--alarm')}>
    <span className={`bar-kpi-icon bar-kpi-icon--${tone}`}><Icon name={icon} width={24} height={24} /></span>
    <div className="bar-kpi-body">
      <div className="bar-kpi-label" title={label}>{label}</div>
      <div className="bar-kpi-value">{value}</div>
      {growth !== undefined && growth !== null
        ? <div className={cx('bar-kpi-hint', growth >= 0 ? 'bar-kpi-hint--up' : 'bar-kpi-hint--down')}>
            <span className="bar-kpi-delta"><Icon name={growth >= 0 ? 'up' : 'downArrow'} width={14} height={14} /> {growth >= 0 ? '+' : '−'}{Math.abs(growth)}%</span> к прошлому месяцу
          </div>
        : hint && <div className="bar-kpi-hint">{hint}</div>}
    </div>
  </div>;
}

/**
 * Обзор бара по макету владельца (09.10.2026, ADR-156): плитки, «Быстрая продажа» и «Добавить в счёт гостя»,
 * «Товары и остатки» с карточкой товара справа, приходы поставщиков и популярные товары. Журналы целиком и
 * справочники живут на вкладках раздела, вход в них из меню «…».
 */
export default async function BarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireVertical(['HOSPITALITY']);
  const params = await searchParams;
  const productParam = typeof params.product === 'string' ? params.product : null;
  const [categories, stock, suppliers, folios, receipts, sales, movements, report, today] = await Promise.all([
    settle(barApi.categories()), settle(barApi.stock()), settle(barApi.suppliers()), settle(barApi.folios()),
    settle(barApi.receipts()), settle(barApi.sales()), settle(barApi.movements()), settle(barApi.report()), hotelToday(),
  ]);
  const failed = [categories, stock, suppliers, folios, receipts, sales, movements, report].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!categories.ok || !stock.ok || !suppliers.ok || !folios.ok || !receipts.ok || !sales.ok || !movements.ok || !report.ok) return null;
  const r = report.value;
  const active = stock.value.filter((item) => item.active);
  const unitsTotal = active.reduce((sum, item) => sum + BigInt(item.availableUnits), 0n);
  const lowCount = active.filter((item) => stockStatusOf(item) !== 'ok').length;
  const debtors = new Set(receipts.value.filter((receipt) => receipt.status === 'POSTED' && BigInt(receipt.dueAmount) > 0n).map((receipt) => receipt.supplier.id)).size;
  const monthRevenue = BigInt(r.month?.revenueMinor ?? r.revenueMinor);
  const monthProfit = BigInt(r.month?.grossProfitMinor ?? r.grossProfitMinor);
  const margin = sharePercent(monthProfit, monthRevenue);
  const lastReceipts = receipts.value.slice(0, 4);
  const popular = popularOf(r, sales.value);
  const bottom = <div className="bar-bottom">
    <section className="panel bar-bottom-panel" aria-labelledby="bar-receipts-title">
      <header className="bar-bottom-head">
        <h2 id="bar-receipts-title" className="bar-panel-title">Приходы от поставщиков</h2>
        <Link href="/bar/receipts" prefetch={false} className="bar-link">Все приходы <Icon name="arrow" width={16} height={16} /></Link>
      </header>
      {lastReceipts.length === 0
        ? <p className="bar-muted">Приходов пока нет: занесите первую счёт-фактуру кнопкой «Приход».</p>
        : <Table density="compact" aria-label="Последние приходы поставщиков" plain>
            <thead><tr><th>Дата</th><th>Поставщик</th><th>№ документа</th><th>Товаров</th><th>Сумма</th><th>Статус</th></tr></thead>
            <tbody>{lastReceipts.map((receipt) => {
              const badge = receiptBadge(receipt);
              return <tr key={receipt.id}>
                <td>{dayRu(receipt.receivedDate.slice(0, 10))}</td>
                <td>{receipt.supplier.name}</td>
                <td>{receipt.documentNumber}</td>
                <td>{receipt._count.lines}</td>
                <td>{formatMoney(receipt.totalAmount)}</td>
                <td><Badge tone={badge.tone}>{badge.label}</Badge></td>
              </tr>;
            })}</tbody>
          </Table>}
    </section>
    <section className="panel bar-bottom-panel" aria-labelledby="bar-popular-title">
      <header className="bar-bottom-head bar-bottom-head--stack">
        <h2 id="bar-popular-title" className="bar-panel-title">Популярные товары</h2>
        <span className="bar-muted">За последний месяц</span>
      </header>
      {popular.length === 0
        ? <p className="bar-muted">Продаж за месяц нет: первая продажа заполнит список.</p>
        : <ol className="bar-popular">{popular.map((item, index) => (
            <li key={item.name}><span className="bar-popular-rank">{index + 1}</span><span className="bar-popular-name">{item.name}</span><b>{item.units} шт.</b></li>
          ))}</ol>}
    </section>
  </div>;
  return <Page width="full" className="bar-page" title="Бар" subtitle="Учёт товаров, закупки, продажи, остатки, себестоимость, наценка и долги поставщикам." actions={<>
    <Link className="btn" href="/bar?product=new" prefetch={false}><Icon name="plus" width={16} height={16} /> Добавить товар</Link>
    <Link className="btn btn--secondary" href="/bar/receipts/new" prefetch={false}><Icon name="plus" width={16} height={16} /> Приход</Link>
    <a className="btn btn--secondary" href="#bar-quick-sale"><Icon name="plus" width={16} height={16} /> Продажа</a>
    <Link className="btn btn--secondary" href="/bar/operations" prefetch={false}><Icon name="plus" width={16} height={16} /> Инвентаризация</Link>
    <ActionMenu label="Ещё разделы бара" items={[
      { label: 'Все товары и категории', href: '/bar/products' },
      { label: 'Все приходы', href: '/bar/receipts' },
      { label: 'Поставщики', href: '/bar/suppliers' },
      { label: 'Списания и инвентаризация', href: '/bar/operations' },
    ]} />
  </>}>
    <section className="bar-kpis" aria-label="Показатели бара">
      <Kpi icon="product" tone="primary" label="Товаров" value={String(active.length)} hint="активных позиций" />
      <Kpi icon="stock" tone="success" label="Остаток на складе" value={`${unitsTotal} шт.`} hint={`на сумму ${formatMoney(r.stockCostMinor)}`} />
      <Kpi icon="cart" tone="primary" label="Закуплено за месяц" value={formatMoney(r.month?.purchasesMinor ?? r.purchasesMinor)}
        growth={r.month?.purchasesGrowth ?? null} hint="в прошлом месяце закупок не было" />
      <Kpi icon="chart" tone="info" label="Выручка бара" value={formatMoney(monthRevenue)}
        growth={r.month?.revenueGrowth ?? null} hint="за текущий месяц" />
      <Kpi icon="coins" tone="warning" label="Валовая прибыль" value={formatMoney(monthProfit)} hint={margin === null ? 'продаж за месяц нет' : `маржинальность ${margin}%`} />
      <Kpi icon="truck" tone="danger" label="Долг поставщикам" value={formatMoney(r.supplierDebtMinor)} hint={debtors > 0 ? pluralRu(debtors, ['поставщик', 'поставщика', 'поставщиков']) : 'долгов нет'} />
      <Kpi icon="incidents" tone="danger" label="Заканчиваются" value={String(lowCount)} hint={pluralRu(lowCount, ['товар', 'товара', 'товаров'], false)} alarm={lowCount > 0} />
    </section>
    <div className="bar-quick">
      <section id="bar-quick-sale" className="panel bar-quick-panel" aria-labelledby="bar-quick-title">
        <header className="bar-quick-head">
          <span className="bar-quick-icon"><Icon name="cart" width={20} height={20} /></span>
          <div><h2 id="bar-quick-title" className="bar-panel-title">Быстрая продажа</h2><p className="bar-muted">Продайте товар гостю или напрямую</p></div>
        </header>
        <SaleForm stock={stock.value} />
      </section>
      <section className="panel bar-quick-panel" aria-labelledby="bar-folio-title">
        <header className="bar-quick-head">
          <span className="bar-quick-icon"><Icon name="receipt" width={20} height={20} /></span>
          <div><h2 id="bar-folio-title" className="bar-panel-title">Добавить в счёт гостя</h2><p className="bar-muted">Добавьте товары в счёт гостя</p></div>
        </header>
        {folios.value.length === 0
          ? <p className="bar-muted">Открытых счетов нет: продайте товар слева, без брони.</p>
          : <FolioSaleForm stock={stock.value} folios={folios.value} />}
      </section>
    </div>
    {stock.value.length === 0
      ? <>
          <EmptyState icon={<Icon name="product" />} title="Товаров пока нет">Добавьте первый товар кнопкой «Добавить товар» или загрузите фото накладной: «Приход».</EmptyState>
          {bottom}
        </>
      : <StockBoard key={productParam ?? 'first'} stock={stock.value} categories={categories.value} suppliers={suppliers.value} movements={movements.value}
          today={today} initialProduct={productParam ?? active[0]?.id ?? null} bottom={bottom} />}
  </Page>;
}
