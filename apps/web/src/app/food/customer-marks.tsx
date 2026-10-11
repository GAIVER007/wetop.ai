'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input } from '../../components/ui';
import { Switch } from '../../components/switch';
import { markCustomer } from './restaurant-actions';

/** Правка VIP-метки и даты рождения клиента (§36, ADR-166) */
export function CustomerMarks({
  scopeKey,
  customer,
}: {
  scopeKey: string;
  customer: { id: string; name: string; isVip: boolean; birthDate: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  function submit(form: FormData) {
    const birthDate = String(form.get('birthDate') ?? '');
    start(async () => {
      const result = await markCustomer(scopeKey, customer.id, {
        isVip: form.getAll('isVip').at(-1) === 'true',
        birthDate: birthDate || null,
      });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  return (
    <>
      <Button tone="ghost" onClick={() => setOpen(true)}>
        Изменить
      </Button>
      {open && (
        <Overlay open onClose={() => setOpen(false)} title={customer.name} drawer className="food-drawer" trapFocus>
          <form className="food-form" action={submit} data-testid="customer-marks">
            {error && <Alert>{error}</Alert>}
            <Switch name="isVip" label="VIP-гость" hint="Метку видно всей смене" defaultChecked={customer.isVip} />
            <Field label="Дата рождения">
              <Input type="date" name="birthDate" defaultValue={customer.birthDate ?? ''} />
            </Field>
            <div className="food-actions">
              <Button type="submit" disabled={pending}>
                Сохранить
              </Button>
              <Button tone="secondary" disabled={pending} onClick={() => setOpen(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </Overlay>
      )}
    </>
  );
}
