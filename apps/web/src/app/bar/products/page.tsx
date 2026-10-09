import { requireVertical } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { toggleBarCatalogAction } from '../actions';
import { ProductPriceForm } from '../product-price-form';
import { CategoryForm, ProductForm } from './catalog-forms';
import { BarTabs } from '../tabs';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Товары бара (ADR-152): каталог с остатками, ценой и минимумом; новый товар и категории здесь же. */
export default async function BarProductsPage() {
  await requireVertical(['HOSPITALITY']);
  const [categories, stock] = await Promise.all([settle(barApi.categories()), settle(barApi.stock())]);
  const failed = [categories, stock].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!categories.ok || !stock.ok) return null;
  const low = (item: { availableUnits: string; minimumStockUnits: string }) =>
    BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits);
  const rows = [...stock.value].sort((a, b) =>
    a.active === b.active ? a.name.localeCompare(b.name, 'ru') : a.active ? -1 : 1);
  return <Page width="wide" title="Бар: товары" subtitle="Карточки товаров с остатками и ценой. Цена правится прямо в строке.">
    <BarTabs current="products" />
    <div className="bar-catalog-grid">
      <section className="panel">
        <h3>Новый товар</h3>
        <ProductForm categories={categories.value.filter((category) => category.active)} />
      </section>
      <section className="panel">
        <h3>Категории и наценка</h3>
        <p className="bar-muted">Наценка категории наследуется товаром, у товара её можно переопределить.</p>
        <CategoryForm />
        {categories.value.length > 0 && <ul className="bar-catalog-list">{categories.value.map((category) => <li key={category.id}>
          <span>{category.name}, {category.defaultMarkupBasis / 100}%</span>
          <form action={toggleBarCatalogAction}>
            <input type="hidden" name="kind" value="category" />
            <input type="hidden" name="id" value={category.id} />
            <input type="hidden" name="active" value={String(!category.active)} />
            <Button type="submit" tone="ghost" size="xs">{category.active ? 'В архив' : 'Восстановить'}</Button>
          </form>
        </li>)}</ul>}
      </section>
    </div>
    <section className="bar-products-table">
      <SectionTitle>Каталог и остатки</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="inventory" />} title="Товаров пока нет">Добавьте первый товар в форме выше или загрузите накладную во вкладке «Приходы».</EmptyState>
        : <Table density="compact" sticky="header" aria-label="Товары бара">
            <thead><tr><th>Код</th><th>Товар</th><th>Остаток</th><th>Минимум</th><th>Наценка</th><th>Цена продажи</th><th>Себестоимость остатка</th><th /></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id} className={item.active ? undefined : 'is-void'}>
              <td>{item.code}</td>
              <td><b>{item.name}</b>{item.category && <small>{item.category.name}</small>}</td>
              <td><Badge tone={!item.active ? 'neutral' : low(item) ? 'warn' : 'ok'}>{item.availableUnits} шт.</Badge></td>
              <td>{item.minimumStockUnits} шт.</td>
              <td>{item.markupBasis === null ? (item.category ? `${item.category.defaultMarkupBasis / 100}% из категории` : 'нет') : `${item.markupBasis / 100}%`}</td>
              <td>{item.active ? <ProductPriceForm productId={item.id} salePrice={item.salePrice} /> : formatMoney(item.salePrice)}</td>
              <td>{formatMoney(item.stockCostMinor)}</td>
              <td><form action={toggleBarCatalogAction}>
                <input type="hidden" name="kind" value="product" />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="active" value={String(!item.active)} />
                <Button type="submit" tone="ghost" size="xs">{item.active ? 'В архив' : 'Восстановить'}</Button>
              </form></td>
            </tr>)}</tbody>
          </Table>}
    </section>
  </Page>;
}
