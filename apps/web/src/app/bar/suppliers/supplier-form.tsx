'use client';
import { useActionState } from 'react';
import { Button, Field, Input } from '../../../components/ui';
import { createBarSupplierAction, type BarActionResult } from '../actions';
import { BarContextFields, type BarFormContext } from '../context';
import { phoneOnInput } from '../../../lib/phone';
import { useT } from '../../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };

export function SupplierForm({ context }: { context: BarFormContext }) {
  const t = useT();
  const [state, action, pending] = useActionState(createBarSupplierAction, initial);
  return <form action={action} className="bar-supplier-form bar-dialog-form">
    <BarContextFields context={context} />
    <Field label={t('Название')} controlId="bar-supplier-name"><Input name="name" id="bar-supplier-name" required /></Field>
    <Field label={t('Телефон')} controlId="bar-supplier-phone"><Input name="phone" id="bar-supplier-phone" type="tel" inputMode="tel" onInput={phoneOnInput} /></Field>
    {/* Email убран из формы (владелец 25.10.2026), поле API остаётся необязательным */}
    <Field label={t('Реквизиты')} hint={t('необязательно')} controlId="bar-supplier-details"><Input name="details" id="bar-supplier-details" /></Field>
    <Button type="submit" disabled={pending}>{pending ? t('Сохраняю…') : t('Добавить')}</Button>
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
    {state.message && <p role="status" className="bar-success">{state.message}</p>}
  </form>;
}
