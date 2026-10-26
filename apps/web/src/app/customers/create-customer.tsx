'use client';
import { useActionState, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import { createBeautyCustomerState } from './actions';
import { formatPhoneInput } from '../../lib/phone';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type CustomerFieldErrors = { firstName?: string | undefined; phone?: string | undefined };

/** Пустые обязательные поля называются под полем (аудит салона 22.10.2026: кнопка молчала); формат номера проверяет сервер */
export function customerFieldErrors(draft: { firstName: string; phone: string }): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {};
  if (!draft.firstName.trim()) errors.firstName = msg('Укажите имя клиента');
  if (!draft.phone.trim()) errors.phone = msg('Укажите телефон');
  return errors;
}

export function CreateCustomer({ businessId, onSaved }: {
  businessId: string;
  onSaved: (id: string, created: boolean) => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createBeautyCustomerState, null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<CustomerFieldErrors>({});
  useEffect(() => {
    if (state?.id) onSaved(state.id, state.created === true);
  }, [state?.id, state?.created, onSaved]);
  const check = (event: FormEvent<HTMLFormElement>) => {
    const next = customerFieldErrors({ firstName, phone });
    setErrors(next);
    if (Object.keys(next).length) event.preventDefault();
  };
  return (
    <form action={action} className="beauty-form" noValidate onSubmit={check}>
      <input type="hidden" name="businessId" value={businessId} />
      <Field label={t('Имя')} controlId="create-customer-first-name" error={errors.firstName && t(errors.firstName)}><Input name="firstName" autoComplete="given-name" required maxLength={100}
        value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrors((current) => ({ ...current, firstName: undefined })); }} /></Field>
      <Field label={t('Фамилия')}><Input name="lastName" autoComplete="family-name" maxLength={100}
        value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
      <Field label={t('Телефон')} controlId="create-customer-phone" error={errors.phone && t(errors.phone)}><Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={32}
        value={phone} onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setErrors((current) => ({ ...current, phone: undefined })); }} /></Field>
      <p className="muted">{t('Номер можно ввести с +7, с 8 или как 10 цифр местного номера.')}</p>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? t('Сохраняем…') : t('Сохранить клиента')}</Button>
    </form>
  );
}
