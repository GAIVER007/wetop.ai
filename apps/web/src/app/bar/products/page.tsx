import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { barApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { Button, EmptyState, SectionTitle } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { toggleBarCatalogAction } from '../actions';
import { loadBarContext } from '../load-context';
import { BarCommandForm } from '../command-form';
import { CategoryForm, ProductForm } from './catalog-forms';
import { ProductsTable } from './products-table';
import { BarTabs } from '../tabs';
import { CatalogDialog } from '../catalog-dialog';
import { deskShell } from '../../../lib/desk-shell';
import { barActionAccess } from '../action-access';
import '../bar.css';
import { serverT } from '../../../i18n/server';

const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), (error: unknown) => { unstable_rethrow(error); return { ok: false as const, error }; });

/** Товары бара (ADR-157): каталог с остатками, ценой и минимумом; новый товар и категории здесь же. */
export default async function BarProductsPage() {
  await requireFeature('/bar/products');
  const t = await serverT();
  const [categories, stock, shell] = await Promise.all([settle(barApi.categories()), settle(barApi.stock()), deskShell()]);
  // UI-FIX-01: каталог правит право settings, в режиме чтения команд нет.
  const rights = barActionAccess(shell, shell.vertical);
  const failed = [categories, stock].find((result) => !result.ok);
  if (failed && !failed.ok) throw failed.error;
  if (!categories.ok || !stock.ok) return null;
  // контекст денежных форм: сервер сверяет объект и валюту (D-CUR); у салона вместо объекта филиал
  const context = await loadBarContext();
  const rows = [...stock.value].sort((a, b) =>
    a.active === b.active ? a.name.localeCompare(b.name, 'ru') : a.active ? -1 : 1);
  // раздел меню «Склад» у всех направлений (решение владельца 19.10.2026)
  return <Page width="wide" className="bar-subpage" title={t('Склад: номенклатура')} subtitle={t('Карточки товаров с остатками и ценой. Цена правится прямо в строке.')} actions={rights.createCatalog ? <>
      <CatalogDialog label={t('Категории и наценка')} tone="secondary">
        <p className="bar-muted">{t('Наценка категории наследуется товаром, у товара её можно переопределить.')}</p>
        <CategoryForm context={context} />
        {categories.value.length > 0 && <ul className="bar-catalog-list">{categories.value.map((category) => <li key={category.id}>
          <span>{category.name}, {category.defaultMarkupBasis / 100}%</span>
          {rights.archiveCatalog && <BarCommandForm context={context} action={toggleBarCatalogAction}>
            <input type="hidden" name="kind" value="category" />
            <input type="hidden" name="id" value={category.id} />
            <input type="hidden" name="active" value={String(!category.active)} />
            <Button type="submit" tone="ghost" size="xs">{category.active ? t('В архив') : t('Восстановить')}</Button>
          </BarCommandForm>}
        </li>)}</ul>}
      </CatalogDialog>
      <CatalogDialog label={t('Новый товар')} hash="new-product">
        <ProductForm categories={categories.value.filter((category) => category.active)} context={context} />
      </CatalogDialog>
    </> : undefined}>
    <BarTabs current="products" />
    <section className="bar-products-table">
      <SectionTitle>{t('Каталог и остатки')}</SectionTitle>
      {rows.length === 0
        ? <EmptyState icon={<Icon name="inventory" />} title={t('Товаров пока нет')}>{t('Добавьте первый товар кнопкой «Новый товар» вверху или загрузите накладную во вкладке «Приходы».')}</EmptyState>
        : <ProductsTable rows={rows} categories={categories.value} context={context} rights={{ updateCatalog: rights.updateCatalog, archiveCatalog: rights.archiveCatalog }} label={shell.vertical === 'BEAUTY' ? t('Товары склада') : t('Товары бара')} />}
    </section>
  </Page>;
}
