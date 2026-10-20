'use client';
import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import { createBeautyCustomerState } from './actions';

export function CreateCustomer({ businessId, onSaved }: {
  businessId: string;
  onSaved: (id: string, created: boolean) => void;
}) {
  const [state, action, pending] = useActionState(createBeautyCustomerState, null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => {
    if (state?.id) onSaved(state.id, state.created === true);
  }, [state?.id, state?.created, onSaved]);
  return (
    <form action={action} className="beauty-form">
      <input type="hidden" name="businessId" value={businessId} />
      <Field label="Имя"><Input name="firstName" autoComplete="given-name" required maxLength={100}
        value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
      <Field label="Фамилия"><Input name="lastName" autoComplete="family-name" maxLength={100}
        value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
      <Field label="Телефон"><Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={32}
        value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <p className="muted">Номер можно ввести с +7, с 8 или как 10 цифр местного номера.</p>
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить клиента'}</Button>
    </form>
  );
}
