import { can } from '@pms/domain';
import { deskShellOf } from '../../lib/desk-person';
import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../lib/api';
import { hotelToday } from '../../lib/hotel-api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { ReceiptForm } from './receipt-form';
import { SaleForm } from './sale-form';
import { postBarReceiptAction, reverseBarSaleAction } from './actions';
import { WriteOffForm } from './write-off-form';
import { SupplierPaymentForm } from './supplier-payment-form';
import { FolioSaleForm } from './folio-sale-form';
import { InventoryCountForm } from './inventory-count-form';
import { BarCatalogs } from './catalogs';
import { ProductPriceForm } from './product-price-form';
import './bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });
export default async function BarPage() {
  const me = await requireVertical(['HOSPITALITY']);
  const shell = deskShellOf(me);
  const scope = `${me.user?.id ?? 'local-stand'}:${me.context?.businessId ?? 'unresolved'}:${me.context?.locationId ?? 'unresolved'}`;
  const maySettings = !shell.readOnly && (me.user ? can(me.user.role, 'settings') : true);
  const mayReverse = !shell.readOnly && (me.user ? can(me.user.role, 'refunds') : true);
  const [categories, products, suppliers, receipts, stock, sales, folios, movements, report, today] = await Promise.all([
    settle(barApi.categories()), settle(barApi.products()), settle(barApi.suppliers()), settle(barApi.receipts()), settle(barApi.stock()), settle(barApi.sales()), settle(barApi.folios()), settle(barApi.movements()), settle(barApi.report()), hotelToday(),
  ]);
  const error = [categories, products, suppliers, receipts, stock, sales, folios, movements, report].find((result) => !result.ok);
  if (error && !error.ok) throw error.error;
  if (!categories.ok || !products.ok || !suppliers.ok || !receipts.ok || !stock.ok || !sales.ok || !folios.ok || !movements.ok || !report.ok) return null;
  const posted = receipts.value.filter((x) => x.status === 'POSTED');
  return <Page width="wide" title="Бар" subtitle="Приходы, закупочная стоимость, наценка, остатки и долги поставщикам в одном разделе.">
    <Stats min={190}>
      <Stat label="Товары" value={products.value.filter((x) => x.active).length} hint="активных позиций" />
      <Stat label="Закупки получено" value={formatMoney(report.value.purchasesMinor)} hint={`${posted.length} проведенных приходов`} />
      <Stat label="Расходы поставщикам" value={formatMoney(report.value.supplierPaidMinor)} hint="фактически оплачено из кассы" />
      <Stat label="Долг поставщикам" value={formatMoney(report.value.supplierDebtMinor)} tone={BigInt(report.value.supplierDebtMinor) > 0n ? 'warn' : undefined} />
      <Stat label="Выручка бара" value={formatMoney(report.value.revenueMinor)} hint={`валовая прибыль ${formatMoney(report.value.grossProfitMinor)}`} />
      <Stat label="Стоимость остатка" value={formatMoney(report.value.stockCostMinor)} hint={`списано ${formatMoney(report.value.writeOffMinor)}`} />
      <Stat label="Убыток без возврата товара" value={formatMoney(report.value.nonRestockedLossMinor)} hint="исходная FIFO-себестоимость" />
    </Stats>
    <SectionTitle>Продажа без брони</SectionTitle>
    <SaleForm key={`retail:${scope}`} scope={scope} readOnly={shell.readOnly} stock={stock.value} />
    <SectionTitle>Добавить в счет гостя</SectionTitle>
    {folios.value.length === 0 && <EmptyState icon={<Icon name="guests" />} title="Нет открытых счетов">Продажу можно записать без брони выше.</EmptyState>}
    {<FolioSaleForm key={`folio:${scope}`} scope={scope} readOnly={shell.readOnly} stock={stock.value} folios={folios.value} />}
    <SectionTitle>Остатки</SectionTitle>
    <Table><thead><tr><th>Товар</th><th>Остаток</th><th>Минимум</th><th>Своя цена продажи</th><th>Себестоимость остатка</th></tr></thead><tbody>{stock.value.map((item) => <tr key={item.id}><td><b>{item.name}</b><small>{item.code}</small></td><td><Badge tone={BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits) ? 'warn' : 'ok'}>{item.availableUnits} шт.</Badge></td><td>{item.minimumStockUnits} шт.</td><td><fieldset className="bar-intent-fields" disabled={!maySettings}><ProductPriceForm productId={item.id} salePrice={item.salePrice} /></fieldset></td><td>{formatMoney(item.stockCostMinor)}</td></tr>)}</tbody></Table>
    <SectionTitle>Списание</SectionTitle>
    <WriteOffForm key={`write-off:${scope}`} scope={scope} readOnly={shell.readOnly} stock={stock.value} />
    <SectionTitle>Инвентаризация</SectionTitle>
    <fieldset className="bar-intent-fields" disabled={shell.readOnly}><InventoryCountForm stock={stock.value} /></fieldset>
    <SectionTitle>Продажи</SectionTitle>
    {sales.value.length === 0 ? <EmptyState icon={<Icon name="receipt" />} title="Продаж пока нет">Первую продажу можно записать выше.</EmptyState> : <Table><thead><tr><th>Дата</th><th>Товар</th><th>Выручка</th><th>Себестоимость</th><th>Прибыль</th><th>Статус</th><th /></tr></thead><tbody>{sales.value.map((sale) => <tr key={sale.id}><td>{sale.createdAt.slice(0, 10)}</td><td>{sale.lines.map((line) => `${line.product.name} × ${line.quantityUnits}`).join(', ')}</td><td>{formatMoney(sale.totalRevenue)}</td><td>{formatMoney(sale.totalCost)}</td><td>{formatMoney(BigInt(sale.totalRevenue) - BigInt(sale.totalCost))}</td><td><Badge tone={sale.status === 'POSTED' ? 'ok' : 'neutral'}>{sale.status === 'POSTED' ? 'Продано' : 'Возврат'}</Badge></td><td>{mayReverse && sale.status === 'POSTED' && <div className="bar-return"><form action={reverseBarSaleAction}><input type="hidden" name="id" value={sale.id} /><input type="hidden" name="restock" value="true" /><input type="hidden" name="reason" value="Возврат гостя, товар пригоден" /><Button type="submit" tone="ghost" size="xs">Вернуть на склад</Button></form><form action={reverseBarSaleAction}><input type="hidden" name="id" value={sale.id} /><input type="hidden" name="restock" value="false" /><input type="hidden" name="reason" value="Возврат гостя, товар непригоден" /><Button type="submit" tone="ghost" size="xs">Без возврата на склад</Button></form></div>}</td></tr>)}</tbody></Table>}
    <SectionTitle>Новый приход</SectionTitle>
    <p className="bar-accounting-note"><b>Как учитываются деньги:</b> проведение прихода увеличивает склад и фиксирует закупку. Расход в кассе появляется только после оплаты поставщику, включая частичную оплату.</p>
    {products.value.length === 0 || suppliers.value.length === 0 ? <EmptyState icon={<Icon name="receipt" />} title="Сначала добавьте товары и поставщиков">Справочники доступны в настройках бара.</EmptyState> : <fieldset className="bar-intent-fields" disabled={shell.readOnly}><ReceiptForm products={products.value} suppliers={suppliers.value} today={today} /></fieldset>}
    <SectionTitle>Приходы и долги</SectionTitle>
    {receipts.value.length === 0 ? <EmptyState icon={<Icon name="receipt" />} title="Приходов пока нет">Занесите первую счет-фактуру выше.</EmptyState> : <Table><thead><tr><th>Документ</th><th>Поставщик</th><th>Позиций</th><th>Сумма</th><th>Оплачено</th><th>Долг</th><th>Статус</th><th /></tr></thead><tbody>{receipts.value.map((receipt) => <tr key={receipt.id}><td><b>{receipt.documentNumber}</b><small>{receipt.receivedDate.slice(0, 10)}</small></td><td>{receipt.supplier.name}</td><td>{receipt._count.lines}</td><td>{formatMoney(receipt.totalAmount)}</td><td>{formatMoney(receipt.paidAmount)}</td><td>{formatMoney(receipt.dueAmount)}</td><td><Badge tone={receipt.status === 'POSTED' ? 'ok' : 'neutral'}>{receipt.status === 'POSTED' ? 'Проведен' : 'Черновик'}</Badge></td><td>{receipt.status === 'DRAFT' ? <form action={postBarReceiptAction}><input type="hidden" name="id" value={receipt.id} /><Button size="xs" type="submit" disabled={shell.readOnly}>Провести</Button></form> : <SupplierPaymentForm key={`${scope}:${receipt.id}`} scope={scope} readOnly={shell.readOnly} receiptId={receipt.id} dueAmount={receipt.dueAmount} />}</td></tr>)}</tbody></Table>}
    <SectionTitle>Движения</SectionTitle>
    <Table><thead><tr><th>Время</th><th>Товар</th><th>Тип</th><th>Кол-во</th><th>Себестоимость</th><th>Причина</th></tr></thead><tbody>{movements.value.map((movement) => <tr key={movement.id}><td>{movement.createdAt.slice(0, 16).replace('T', ' ')}</td><td>{movement.product.name}</td><td>{movement.kind}</td><td>{movement.units}</td><td>{formatMoney(movement.amountMinor)}</td><td>{movement.note ?? '–'}</td></tr>)}</tbody></Table>
    <SectionTitle>Справочники бара</SectionTitle>
    <fieldset className="bar-intent-fields" disabled={!maySettings}><BarCatalogs categories={categories.value} products={products.value} suppliers={suppliers.value} /></fieldset>
  </Page>;
}
