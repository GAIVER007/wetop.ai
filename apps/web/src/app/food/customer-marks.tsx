'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input } from '../../components/ui';
import { Switch } from '../../components/switch';
import { markCustomer } from './restaurant-actions';
import { useT } from '../../i18n/locale-provider';

/** Правка VIP-метки и даты рождения клиента (§36, ADR-166) */
export function CustomerMarks({
  scopeKey,
  customer,
  save,
}: {
  scopeKey: string;
  customer: { id: string; name: string; isVip: boolean; birthDate: string | null };
  /** своё сохранение направления (салон, §36); без него ресторанное */
  save?: (id: string, body: { isVip: boolean; birthDate: string | null }) => Promise<{ error: string | null }>;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  function submit(form: FormData) {
    const birthDate = String(form.get('birthDate') ?? '');
    start(async () => {
      const body = { isVip: form.getAll('isVip').at(-1) === 'true', birthDate: birthDate || null };
      const result = save ? await save(customer.id, body) : await markCustomer(scopeKey, customer.id, body);
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
        {t('Изменить')}
      </Button>
      {open && (
        <Overlay open onClose={() => setOpen(false)} title={customer.name} drawer className="food-drawer" trapFocus>
          <form className="food-form" action={submit} data-testid="customer-marks">
            {error && <Alert>{error}</Alert>}
            <Switch name="isVip" label={t('VIP-гость')} hint={t('Метку видно всей смене')} defaultChecked={customer.isVip} />
            <Field label={t('Дата рождения')}>
              <Input type="date" lang="ru" name="birthDate" defaultValue={customer.birthDate ?? ''} />
            </Field>
            <div className="food-actions">
              <Button type="submit" disabled={pending}>
                {t('Сохранить')}
              </Button>
              <Button tone="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t('Отмена')}
              </Button>
            </div>
          </form>
        </Overlay>
      )}
    </>
  );
}
