import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Page } from '../../components/page';
import { Badge, EmptyState, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { SaleForm } from './sale-form';
import { FolioSaleForm } from './folio-sale-form';
import { BarTabs } from './tabs';
import './bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/**
 * Обзор бара (ADR-152): показатели, продажа и остатки одним экраном. Журналы и справочники живут
 * на своих вкладках: «Приходы», «Товары», «Поставщики», «Операции».
 */
export default async function BarPage() {
  await requireVertical(['HOSPITALITY']);
  const [products, stock, folios, report] = await Promise.all([
    settle(barApi.products()), settle(barApi.stock()), settle(barApi.folios()), settle(barApi.report()),
  ]);
  const failed = [products, stock, folios, report].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!products.ok || !stock.ok || !folios.ok || !report.ok) return null;
  const low = (item: { availableUnits: string; minimumStockUnits: string }) =>
    BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits);
  const active = stock.value.filter((item) => item.active);
  const lowCount = active.filter(low).length;
  // товары, где остаток на минимуме или ниже, идут первыми: за ними и приходят на этот экран
  const rows = [...active].sort((a, b) => (low(a) === low(b) ? a.name.localeCompare(b.name, 'ru') : low(a) ? -1 : 1));
  return <Page width="wide" title="Бар" subtitle="Выручка, продажа и остатки на одном экране. Приходы, товары и поставщики: на вкладках." actions={<>
    <Link className="btn btn--secondary" href="/bar/products" prefetch={false}>Новый товар</Link>
    <Link className="btn" href="/bar/receipts/new" prefetch={false}>Новый приход</Link>
  </>}>
    <BarTabs current="overview" />
    <Stats min={190} className="bar-stats">
      <Stat label="Товары" value={products.value.filter((item) => item.active).length} hint={lowCount > 0 ? `мало на складе: ${lowCount}` : 'активных позиций'} {...(lowCount > 0 ? { hintTone: 'warn' as const } : {})} />
      <Stat label="Выручка бара" value={formatMoney(report.value.revenueMinor)} hint={`валовая прибыль ${formatMoney(report.value.grossProfitMinor)}`} />
      <Stat label="Закупки получено" value={formatMoney(report.value.purchasesMinor)} hint={`оплачено ${formatMoney(report.value.supplierPaidMinor)}`} />
      <Stat label="Долг поставщикам" value={formatMoney(report.value.supplierDebtMinor)} tone={BigInt(report.value.supplierDebtMinor) > 0n ? 'warn' : undefined} hint="оплата, во вкладке «Приходы»" />
      <Stat label="Стоимость остатка" value={formatMoney(report.value.stockCostMinor)} hint={`списано ${formatMoney(report.value.writeOffMinor)}`} />
    </Stats>
    <div className="bar-quick">
      <section>
        <SectionTitle>Продажа без брони</SectionTitle>
        <SaleForm stock={stock.value} />
      </section>
      <section>
        <SectionTitle>В счёт гостя</SectionTitle>
        {folios.value.length === 0
          ? <EmptyState icon={<Icon name="guests" />} title="Нет открытых счетов">Продажу можно записать без брони слева.</EmptyState>
          : <FolioSaleForm stock={stock.value} folios={folios.value} />}
      </section>
    </div>
    <section className="bar-overview-stock">
      <SectionTitle>Остатки</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="inventory" />} title="Склад пуст">Занесите приход: вкладка «Приходы» или кнопка «Новый приход».</EmptyState>
        : <Table density="compact" sticky="header" aria-label="Остатки бара">
            <thead><tr><th>Товар</th><th>Остаток</th><th>Минимум</th><th>Цена продажи</th><th>Себестоимость остатка</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id}>
              <td><b>{item.name}</b><small>{item.code}</small></td>
              <td><Badge tone={low(item) ? 'warn' : 'ok'}>{item.availableUnits} шт.</Badge></td>
              <td>{item.minimumStockUnits} шт.</td>
              <td>{formatMoney(item.salePrice)}</td>
              <td>{formatMoney(item.stockCostMinor)}</td>
            </tr>)}</tbody>
          </Table>}
    </section>
  </Page>;
}
