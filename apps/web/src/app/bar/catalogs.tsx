'use client';
import { useActionState } from 'react';
import type { BarCategoryRow, BarProductRow, BarSupplierRow } from '../../lib/api';
import { Button, Field, Input, Select } from '../../components/ui';
import { createBarCategoryAction, createBarProductAction, createBarSupplierAction, toggleBarCatalogAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };
const Feedback = ({ state }: { state: BarActionResult }) => <>{state.error && <p role="alert" className="bar-error">{state.error}</p>}{state.message && <p role="status" className="bar-success">{state.message}</p>}</>;
export function BarCatalogs({ categories, products, suppliers }: { categories: BarCategoryRow[]; products: BarProductRow[]; suppliers: BarSupplierRow[] }) {
  const [categoryState, categoryAction, categoryPending] = useActionState(createBarCategoryAction, initial);
  const [productState, productAction, productPending] = useActionState(createBarProductAction, initial);
  const [supplierState, supplierAction, supplierPending] = useActionState(createBarSupplierAction, initial);
  return <div className="bar-catalogs">
    <section className="panel"><h3>Категории</h3><form action={categoryAction} className="bar-catalog-form"><Field label="Название"><Input name="name" required /></Field><Field label="Наценка, %"><Input name="markup" inputMode="decimal" required /></Field><Button type="submit" disabled={categoryPending}>Добавить</Button><Feedback state={categoryState} /></form><CatalogList kind="category" rows={categories.map((x) => ({ id: x.id, label: `${x.name}, ${x.defaultMarkupBasis / 100}%`, active: x.active }))} /></section>
    <section className="panel"><h3>Поставщики</h3><form action={supplierAction} className="bar-catalog-form"><Field label="Название"><Input name="name" required /></Field><Field label="Телефон"><Input name="phone" /></Field><Field label="Email"><Input name="email" type="email" /></Field><Field label="Реквизиты"><Input name="details" /></Field><Button type="submit" disabled={supplierPending}>Добавить</Button><Feedback state={supplierState} /></form><CatalogList kind="supplier" rows={suppliers.map((x) => ({ id: x.id, label: x.name, active: x.active }))} /></section>
    <section className="panel bar-products-catalog"><h3>Товары</h3><form action={productAction} className="bar-product-form"><Field label="Код"><Input name="code" required /></Field><Field label="Название"><Input name="name" required /></Field><Field label="Категория"><Select name="categoryId" defaultValue=""><option value="">Без категории</option>{categories.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field><Field label="Штрихкод"><Input name="barcode" /></Field><Field label="Штук в упаковке"><Input name="unitsPerPackage" inputMode="numeric" defaultValue="1" required /></Field><Field label="Своя наценка, %"><Input name="markup" inputMode="decimal" placeholder="Из категории" /></Field><Field label="Начальная цена, ₸"><Input name="salePrice" inputMode="decimal" required /></Field><Field label="Мин. остаток"><Input name="minimumStockUnits" inputMode="numeric" defaultValue="0" required /></Field><Button type="submit" disabled={productPending}>Добавить товар</Button><Feedback state={productState} /></form><CatalogList kind="product" rows={products.map((x) => ({ id: x.id, label: `${x.code}: ${x.name}`, active: x.active }))} /></section>
  </div>;
}
function CatalogList({ kind, rows }: { kind: 'category' | 'product' | 'supplier'; rows: Array<{ id: string; label: string; active: boolean }> }) {
  return <ul className="bar-catalog-list">{rows.map((row) => <li key={row.id}><span>{row.label}</span><form action={toggleBarCatalogAction}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="active" value={String(!row.active)} /><Button type="submit" tone="ghost" size="xs">{row.active ? 'В архив' : 'Восстановить'}</Button></form></li>)}</ul>;
}
