'use client';
import { useActionState } from 'react';
import { Button, Field, Input } from '../../../components/ui';
import { createBarSupplierAction, type BarActionResult } from '../actions';

const initial: BarActionResult = { error: null, ok: 0 };

export function SupplierForm() {
  const [state, action, pending] = useActionState(createBarSupplierAction, initial);
  return <form action={action} className="bar-supplier-form">
    <Field label="Название" controlId="bar-supplier-name"><Input name="name" id="bar-supplier-name" required /></Field>
    <Field label="Телефон" controlId="bar-supplier-phone"><Input name="phone" id="bar-supplier-phone" /></Field>
    <Field label="Email" controlId="bar-supplier-email"><Input name="email" id="bar-supplier-email" type="email" /></Field>
    <Field label="Реквизиты" controlId="bar-supplier-details"><Input name="details" id="bar-supplier-details" /></Field>
    <Button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Добавить'}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
