'use client';
import { useActionState } from 'react';
import type { BarCategoryRow } from '../../../lib/api';
import { Button, Field, Input, Select } from '../../../components/ui';
import { createBarCategoryAction, createBarProductAction, type BarActionResult } from '../actions';

const initial: BarActionResult = { error: null, ok: 0 };
const Feedback = ({ state }: { state: BarActionResult }) => <>
  {state.error && <p role="alert" className="bar-error">{state.error}</p>}
  {state.message && <p role="status" className="bar-success">{state.message}</p>}
</>;

/** Карточка товара: код, категория с наследуемой наценкой, штрихкод, цена и минимальный остаток. */
export function ProductForm({ categories }: { categories: BarCategoryRow[] }) {
  const [state, action, pending] = useActionState(createBarProductAction, initial);
  return <form action={action} className="bar-product-form">
    <Field label="Код" controlId="bar-product-code"><Input name="code" id="bar-product-code" required /></Field>
    <Field label="Название" controlId="bar-product-name"><Input name="name" id="bar-product-name" required /></Field>
    <Field label="Категория" controlId="bar-product-category"><Select name="categoryId" id="bar-product-category" defaultValue=""><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
    <Field label="Штрихкод" controlId="bar-product-barcode"><Input name="barcode" id="bar-product-barcode" /></Field>
    <Field label="Штук в упаковке" controlId="bar-product-units"><Input name="unitsPerPackage" id="bar-product-units" inputMode="numeric" defaultValue="1" required /></Field>
    <Field label="Своя наценка, %" controlId="bar-product-markup"><Input name="markup" id="bar-product-markup" inputMode="decimal" placeholder="Из категории" /></Field>
    <Field label="Начальная цена, ₸" controlId="bar-product-price"><Input name="salePrice" id="bar-product-price" inputMode="decimal" required /></Field>
    <Field label="Мин. остаток" controlId="bar-product-min"><Input name="minimumStockUnits" id="bar-product-min" inputMode="numeric" defaultValue="0" required /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Добавить товар'}</Button>
    <Feedback state={state} />
  </form>;
}

export function CategoryForm() {
  const [state, action, pending] = useActionState(createBarCategoryAction, initial);
  return <form action={action} className="bar-category-form">
    <Field label="Название" controlId="bar-category-name"><Input name="name" id="bar-category-name" required /></Field>
    <Field label="Наценка, %" controlId="bar-category-markup"><Input name="markup" id="bar-category-markup" inputMode="decimal" required /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Добавить'}</Button>
    <Feedback state={state} />
  </form>;
}
