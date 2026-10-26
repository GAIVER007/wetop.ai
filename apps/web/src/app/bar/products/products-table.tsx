'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { BarCategoryRow, BarStockRow } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { Badge, Button, Input, Select, Table } from '../../../components/ui';
import { IconField } from '../../../components/icon-field';
import { toggleBarCatalogAction } from '../actions';
import { BarCommandForm } from '../command-form';
import type { BarFormContext } from '../context';
import { ProductPriceForm } from '../product-price-form';
import { useT } from '../../../i18n/locale-provider';

/**
 * Таблица номенклатуры (владелец 25.10.2026): товар с кодом мелко под названием, категория, остаток и минимум
 * отдельными колонками, цена в строке, «В архив». Над таблицей поиск и категория, как в журналах.
 */
export function ProductsTable({
  rows,
  categories,
  context,
  rights,
  label,
}: {
  rows: BarStockRow[];
  categories: BarCategoryRow[];
  context: BarFormContext;
  rights: { updateCatalog: boolean; archiveCatalog: boolean };
  label: string;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const q = query.trim().toLocaleLowerCase('ru');
  const low = (item: BarStockRow) => BigInt(item.availableUnits) <= BigInt(item.minimumStockUnits);
  const shown = rows.filter(
    (item) =>
      (q === '' || item.name.toLocaleLowerCase('ru').includes(q) || item.code.toLocaleLowerCase('ru').includes(q)) &&
      (category === '' || (category === 'none' ? !item.categoryId : item.categoryId === category)),
  );
  return (
    <>
      <div className="bar-products-tools">
        <IconField icon="search">
          <Input aria-label={t('Поиск товара')} placeholder={t('Поиск товара')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </IconField>
        <Select aria-label={t('Категория')} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('Все категории')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">{t('Без категории')}</option>
        </Select>
      </div>
      {shown.length === 0 ? (
        <p className="bar-muted">{t('Ничего не найдено')}</p>
      ) : (
        <Table density="compact" sticky="header" className="bar-products-grid" aria-label={label}>
          <thead>
            <tr>
              <th className="bar-products-grid__name">{t('Товар')}</th>
              <th>{t('Категория')}</th>
              <th className="num">{t('Остаток')}</th>
              <th className="num">{t('Минимум')}</th>
              <th className="bar-products-grid__price">{t('Цена продажи')}</th>
              <th>{t('Действия')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.id} className={item.active ? undefined : 'is-void'}>
                <td className="bar-product-name">
                  {item.active && rights.updateCatalog ? (
                    <Link href={`/bar?product=${item.id}`} prefetch={false} title={t('Закупка, наценка и остатки')}>
                      <b>{item.name}</b>
                    </Link>
                  ) : (
                    <b>{item.name}</b>
                  )}
                  <small className="bar-product-code">{item.code}</small>
                </td>
                <td>{item.category?.name ?? <span className="bar-muted">{t('Без категории')}</span>}</td>
                <td className="num">
                  <Badge tone={!item.active ? 'neutral' : low(item) ? 'warn' : 'ok'}>{t('{n} шт.', { n: item.availableUnits })}</Badge>
                </td>
                <td className="num">{t('{n} шт.', { n: item.minimumStockUnits })}</td>
                <td className="bar-products-grid__price">
                  {item.active && rights.updateCatalog ? (
                    <ProductPriceForm productId={item.id} salePrice={item.salePrice} context={context} />
                  ) : (
                    formatMoney(item.salePrice, context.currency)
                  )}
                </td>
                <td>
                  {rights.archiveCatalog && (
                    <BarCommandForm context={context} action={toggleBarCatalogAction}>
                      <input type="hidden" name="kind" value="product" />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="active" value={String(!item.active)} />
                      <Button type="submit" tone="ghost" size="xs">
                        {item.active ? t('В архив') : t('Восстановить')}
                      </Button>
                    </BarCommandForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
