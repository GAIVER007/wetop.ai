'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import type { BarCategoryRow, BarStockRow } from '../../lib/api';
import { formatMoney, minorToInput } from '../../lib/money';
import { Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { toggleBarCatalogAction, updateBarProductAction, type BarActionResult } from './actions';
import { STATUS_LABEL, STATUS_TONE, stockStatusOf, type StockStatus } from './stock-status';

/**
 * «Товары и остатки» на обзоре бара (ADR-154, макет владельца 09.10.2026): поиск, отбор по категории и
 * статусу, статус словом и цветом, карточка товара боковой панелью (§1 п. 5: контекст остаётся на экране).
 */

/** Средняя закупка остатка, в тиынах с округлением к ближайшему: нет остатка, нет и средней */
const averageCost = (item: Pick<BarStockRow, 'availableUnits' | 'stockCostMinor'>): string | null => {
  const units = BigInt(item.availableUnits);
  if (units <= 0n) return null;
  return ((BigInt(item.stockCostMinor) + units / 2n) / units).toString();
};

const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

export function StockBoard({ stock, categories }: { stock: BarStockRow[]; categories: BarCategoryRow[] }) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const needle = normalized(query);
    return stock
      .filter((item) => item.active)
      .filter((item) => !needle || normalized(`${item.name} ${item.code} ${item.barcode ?? ''}`).includes(needle))
      .filter((item) => !categoryId || item.categoryId === categoryId)
      .filter((item) => !status || stockStatusOf(item) === status)
      .sort((a, b) => {
        const order: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 };
        const byStatus = order[stockStatusOf(a)] - order[stockStatusOf(b)];
        return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name, 'ru');
      });
  }, [stock, query, categoryId, status]);
  const selected = selectedId ? stock.find((item) => item.id === selectedId) ?? null : null;
  return (
    <section className="bar-board" aria-label="Товары и остатки">
      <div className="bar-board-head">
        <h2 className="section-title">Товары и остатки</h2>
        <div className="bar-board-filters">
          <Input
            aria-label="Поиск товара"
            placeholder="Поиск по названию, коду или штрихкоду"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select aria-label="Категория" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Все категории</option>
            {categories.filter((category) => category.active).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Select aria-label="Статус остатка" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Все статусы</option>
            <option value="ok">В норме</option>
            <option value="low">Заканчивается</option>
            <option value="out">Нет в наличии</option>
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="bar-muted" role="status">По такому отбору товаров нет. Снимите фильтры или добавьте товар.</p>
      ) : (
        <Table density="compact" sticky="header" aria-label="Товары и остатки бара">
          <thead><tr><th>Товар</th><th>Категория</th><th>Остаток</th><th>Мин. остаток</th><th>Ед.</th><th>Закуп. цена</th><th>Цена продажи</th><th>Наценка</th><th>Себестоимость</th><th>Статус</th><th /></tr></thead>
          <tbody>{rows.map((item) => {
            const state = stockStatusOf(item);
            const average = averageCost(item);
            const markup = item.markupBasis ?? item.category?.defaultMarkupBasis ?? null;
            return <tr key={item.id} className={selectedId === item.id ? 'is-active' : undefined}>
              <td><b>{item.name}</b><small>{item.code}</small></td>
              <td>{item.category?.name ?? 'нет'}</td>
              <td>{item.availableUnits} шт.</td>
              <td>{item.minimumStockUnits} шт.</td>
              <td>шт.</td>
              <td>{average === null ? 'нет' : formatMoney(average)}</td>
              <td>{formatMoney(item.salePrice)}</td>
              <td>{markup === null ? 'нет' : `${markup / 100}%`}</td>
              <td>{formatMoney(item.stockCostMinor)}</td>
              <td><Badge tone={STATUS_TONE[state]}>{STATUS_LABEL[state]}</Badge></td>
              <td><Button type="button" tone="ghost" size="xs" onClick={() => setSelectedId(item.id)}>Изменить</Button></td>
            </tr>;
          })}</tbody>
        </Table>
      )}
      {selected && <ProductPanel key={selected.id} product={selected} categories={categories} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function ProductPanel({ product, categories, onClose }: { product: BarStockRow; categories: BarCategoryRow[]; onClose: () => void }) {
  const initial: BarActionResult = { error: null, ok: 0 };
  const [state, action, pending] = useActionState(updateBarProductAction, initial);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const stateOf = stockStatusOf(product);
  return (
    <aside className="bar-product-panel" role="dialog" aria-label={`Карточка товара ${product.name}`}>
      <header className="bar-product-panel-head">
        <div>
          <h3>{product.name}</h3>
          <Badge tone={STATUS_TONE[stateOf]}>{STATUS_LABEL[stateOf]}</Badge>
        </div>
        <Button type="button" tone="ghost" size="xs" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close" /></Button>
      </header>
      <dl className="bar-product-facts">
        <div><dt>Текущий остаток</dt><dd>{product.availableUnits} шт.</dd></div>
        <div><dt>Себестоимость остатка</dt><dd>{formatMoney(product.stockCostMinor)}</dd></div>
        <div><dt>Код</dt><dd>{product.code}</dd></div>
      </dl>
      <form action={action} className="bar-product-panel-form">
        <input type="hidden" name="id" value={product.id} />
        <Field label="Название товара" controlId="bar-card-name"><Input name="name" id="bar-card-name" defaultValue={product.name} required /></Field>
        <div className="bar-product-panel-grid">
          <Field label="Категория" controlId="bar-card-category">
            <Select name="categoryId" id="bar-card-category" defaultValue={product.categoryId ?? ''}>
              <option value="">Без категории</option>
              {categories.filter((category) => category.active).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Штрихкод" controlId="bar-card-barcode"><Input name="barcode" id="bar-card-barcode" defaultValue={product.barcode ?? ''} /></Field>
          <Field label="Штук в упаковке" controlId="bar-card-units"><Input name="unitsPerPackage" id="bar-card-units" inputMode="numeric" defaultValue={String(product.unitsPerPackage)} required /></Field>
          <Field label="Мин. остаток" controlId="bar-card-min"><Input name="minimumStockUnits" id="bar-card-min" inputMode="numeric" defaultValue={product.minimumStockUnits} required /></Field>
          <Field label="Своя наценка, %" controlId="bar-card-markup"><Input name="markup" id="bar-card-markup" inputMode="decimal" defaultValue={product.markupBasis === null ? '' : (product.markupBasis / 100).toFixed(2)} placeholder="Из категории" /></Field>
          <Field label="Цена продажи, ₸" controlId="bar-card-price"><Input name="salePrice" id="bar-card-price" inputMode="decimal" defaultValue={minorToInput(product.salePrice)} required /></Field>
        </div>
        {state.error && <p role="alert" className="bar-error">{state.error}</p>}
        {state.message && <p role="status" className="bar-success">{state.message}</p>}
        <div className="bar-product-panel-actions">
          <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Сохранить'}</Button>
          <Link className="btn btn--secondary" href="/bar/operations" prefetch={false}>Списать</Link>
        </div>
      </form>
      <form action={toggleBarCatalogAction} className="bar-product-panel-archive">
        <input type="hidden" name="kind" value="product" />
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="active" value="false" />
        <Button type="submit" tone="ghost" size="xs">В архив</Button>
      </form>
    </aside>
  );
}
