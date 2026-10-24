import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Page } from '../../../components/page';
import { Badge, Button, EmptyState, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { toggleBarCatalogAction } from '../actions';
import { loadBarContext } from '../load-context';
import { BarCommandForm } from '../command-form';
import { ProductPriceForm } from '../product-price-form';
import { CategoryForm, ProductForm } from './catalog-forms';
import { BarTabs } from '../tabs';
import { CatalogDialog } from '../catalog-dialog';
import Link from 'next/link';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import '../bar.css';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Товары бара (ADR-157): каталог с остатками, ценой и минимумом; новый товар и категории здесь же. */
export default async function BarProductsPage() {
  await requireFeature('/bar/products');
  const [categories, stock, shell] = await Promise.all([settle(barApi.categories()), settle(barApi.stock()), deskShell()]);
  // UI-FIX-01: каталог правит право settings, в режиме чтения команд нет.
  const rights = barActionAccess(shell, shell.vertical);
  const failed = [categories, stock].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!categories.ok || !stock.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  const low = (item: { availableUnits: string; minimumStockUnits: string }) =>
    BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits);
  const rows = [...stock.value].sort((a, b) =>
    a.active === b.active ? a.name.localeCompare(b.name, 'ru') : a.active ? -1 : 1);
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  const sectionName = 'Склад';
  return <Page width="wide" className="bar-subpage" title={`${sectionName}: номенклатура`} subtitle="Карточки товаров с остатками и ценой. Цена правится прямо в строке." actions={rights.createCatalog ? <>
      <CatalogDialog label="Категории и наценка" tone="secondary">
        <p className="bar-muted">Наценка категории наследуется товаром, у товара её можно переопределить.</p>
        <CategoryForm context={context} />
        {categories.value.length > 0 && <ul className="bar-catalog-list">{categories.value.map((category) => <li key={category.id}>
          <span>{category.name}, {category.defaultMarkupBasis / 100}%</span>
          {rights.archiveCatalog && <BarCommandForm context={context} action={toggleBarCatalogAction}>
            <input type="hidden" name="kind" value="category" />
            <input type="hidden" name="id" value={category.id} />
            <input type="hidden" name="active" value={String(!category.active)} />
            <Button type="submit" tone="ghost" size="xs">{category.active ? 'В архив' : 'Восстановить'}</Button>
          </BarCommandForm>}
        </li>)}</ul>}
      </CatalogDialog>
      <CatalogDialog label="Новый товар" hash="new-product">
        <ProductForm categories={categories.value.filter((category) => category.active)} context={context} />
      </CatalogDialog>
    </> : undefined}>
    <BarTabs current="products" />
    <section className="bar-products-table">
      <SectionTitle>Каталог и остатки</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="inventory" />} title="Товаров пока нет">Добавьте первый товар кнопкой «Новый товар» вверху или загрузите накладную во вкладке «Приходы».</EmptyState>
        : <Table density="compact" sticky="header" aria-label={`Товары ${shell.vertical === 'BEAUTY' ? 'склада' : 'бара'}`}>
            <thead><tr><th>Товар</th><th>Остаток</th><th>Цена продажи</th><th>Действия</th></tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id} className={item.active ? undefined : 'is-void'}>
              {/* название и код на разных строках (п.17); закупка и наценка в карточке товара на обзоре (п.16) */}
              <td className="bar-product-name">
                {item.active && rights.updateCatalog
                  ? <Link href={`/bar?product=${item.id}`} prefetch={false} title="Закупка, наценка и остатки"><b>{item.name}</b></Link>
                  : <b>{item.name}</b>}
                <small>Код {item.code}{item.category ? `, ${item.category.name}` : ''}</small>
              </td>
              <td><Badge tone={!item.active ? 'neutral' : low(item) ? 'warn' : 'ok'}>{item.availableUnits} шт.</Badge><small>Минимум: {item.minimumStockUnits} шт.</small></td>
              <td>{item.active && rights.updateCatalog ? <ProductPriceForm productId={item.id} salePrice={item.salePrice} context={context} /> : formatMoney(item.salePrice, context.currency)}</td>
              <td>{rights.archiveCatalog && <BarCommandForm context={context} action={toggleBarCatalogAction}>
                <input type="hidden" name="kind" value="product" />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="active" value={String(!item.active)} />
                <Button type="submit" tone="ghost" size="xs">{item.active ? 'В архив' : 'Восстановить'}</Button>
              </BarCommandForm>}</td>
            </tr>)}</tbody>
          </Table>}
    </section>
  </Page>;
}
