'use client';
import { useActionState, useState, type FormEvent } from 'react';
import { suggestCode } from '../product-code';
import type { BarCategoryRow } from '../../../lib/api';
import { Button, Field, Input, Select } from '../../../components/ui';
import { createBarCategoryAction, createBarProductAction, type BarActionResult } from '../actions';
import { BarContextFields, type BarFormContext } from '../context';

const initial: BarActionResult = { error: null, ok: 0 };
const Feedback = ({ state }: { state: BarActionResult }) => <>
  {state.error && <p role="alert" className="bar-error">{state.error}</p>}
  {state.message && <p role="status" className="bar-success">{state.message}</p>}
</>;

type ProductField = 'name' | 'salePrice' | 'unitsPerPackage' | 'minimumStockUnits';

/** Своя проверка «Нового товара» по-русски вместо браузерного «Please fill out this field.» (аудит салона 22.10.2026) */
export function productFieldErrors(draft: Record<ProductField, string>): Partial<Record<ProductField, string>> {
  const errors: Partial<Record<ProductField, string>> = {};
  if (!draft.name.trim()) errors.name = 'Укажите название товара';
  const price = draft.salePrice.replace(/\s/g, '');
  if (!price) errors.salePrice = 'Укажите цену продажи, например 4500';
  else if (!/^\d+(?:[.,]\d{1,2})?$/.test(price)) errors.salePrice = 'Цена продажи: число, например 4500 или 4500,50';
  const units = draft.unitsPerPackage.trim();
  if (!units) errors.unitsPerPackage = 'Укажите, сколько штук в упаковке, например 1';
  else if (!/^\d+$/.test(units) || Number(units) <= 0) errors.unitsPerPackage = 'Штук в упаковке: целое число больше нуля';
  const minimum = draft.minimumStockUnits.trim();
  if (!minimum) errors.minimumStockUnits = 'Укажите минимальный остаток, например 0';
  else if (!/^\d+$/.test(minimum)) errors.minimumStockUnits = 'Мин. остаток: целое число, 0 или больше';
  return errors;
}

/** Карточка товара: код, категория с наследуемой наценкой, штрихкод, цена и минимальный остаток. */
export function ProductForm({ categories, context }: { categories: BarCategoryRow[]; context: BarFormContext }) {
  const [state, action, pending] = useActionState(createBarProductAction, initial);
  const [errors, setErrors] = useState<Partial<Record<ProductField, string>>>({});
  const check = (event: FormEvent<HTMLFormElement>) => {
    const fd = new FormData(event.currentTarget);
    const text = (key: ProductField) => String(fd.get(key) ?? '');
    const next = productFieldErrors({ name: text('name'), salePrice: text('salePrice'), unitsPerPackage: text('unitsPerPackage'), minimumStockUnits: text('minimumStockUnits') });
    setErrors(next);
    if (Object.keys(next).length) event.preventDefault();
  };
  // код подставляется из названия, как в карточке на обзоре; пустой код сервер тоже возьмёт из названия (аудит 21.10.2026 п.2)
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  return <form action={action} className="bar-product-form bar-dialog-form" noValidate onSubmit={check}>
    <BarContextFields context={context} />
    <Field label="Название" controlId="bar-product-name" error={errors.name}><Input name="name" id="bar-product-name" required onChange={(event) => { if (!codeTouched) setCode(suggestCode(event.target.value)); }} /></Field>
    <Field label="Код" controlId="bar-product-code" hint="Заполняется из названия, можно изменить"><Input name="code" id="bar-product-code" value={code} onChange={(event) => { setCodeTouched(true); setCode(event.target.value); }} /></Field>
    <Field label="Категория" controlId="bar-product-category"><Select name="categoryId" id="bar-product-category" defaultValue=""><option value="">Без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
    <Field label="Штрихкод" controlId="bar-product-barcode"><Input name="barcode" id="bar-product-barcode" /></Field>
    <Field label="Штук в упаковке" controlId="bar-product-units" error={errors.unitsPerPackage}><Input name="unitsPerPackage" id="bar-product-units" inputMode="numeric" defaultValue="1" required /></Field>
    <Field label="Своя наценка, %" controlId="bar-product-markup"><Input name="markup" id="bar-product-markup" inputMode="decimal" placeholder="Из категории" /></Field>
    <Field label={`Начальная цена, ${context.currency === 'KZT' ? '₸' : context.currency}`} controlId="bar-product-price" error={errors.salePrice}><Input name="salePrice" id="bar-product-price" inputMode="decimal" required /></Field>
    <Field label="Мин. остаток" controlId="bar-product-min" error={errors.minimumStockUnits}><Input name="minimumStockUnits" id="bar-product-min" inputMode="numeric" defaultValue="0" required /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Добавить товар'}</Button>
    <Feedback state={state} />
  </form>;
}

export function CategoryForm({ context }: { context: BarFormContext }) {
  const [state, action, pending] = useActionState(createBarCategoryAction, initial);
  return <form action={action} className="bar-category-form bar-dialog-form">
    <BarContextFields context={context} />
    <Field label="Название" controlId="bar-category-name"><Input name="name" id="bar-category-name" required /></Field>
    <Field label="Наценка, %" controlId="bar-category-markup"><Input name="markup" id="bar-category-markup" inputMode="decimal" required /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Добавить'}</Button>
    <Feedback state={state} />
  </form>;
}
