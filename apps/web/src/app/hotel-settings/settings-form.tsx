'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, Grid, Input, Notice } from '../../components/ui';
import type { HotelSettings } from '../../lib/hotel-api';
import { saveHotelSettings, type SettingsActionResult } from './actions';

/**
 * «Общие» настройки для владельца организации (ТЗ ux-retention п. 3.1, UQ-1). Валюта и часовой пояс — только просмотр
 * рядом с формой: от них зависят суммы и границы ночей. Отказ API не стирает ввод (`values` + `attempt`).
 */
export function HotelSettingsForm({ property: p }: { property: HotelSettings['property'] }) {
  const [state, action, pending] = useActionState<SettingsActionResult | null, FormData>(
    saveHotelSettings,
    null,
  );
  const kept = state?.values;
  const value = (name: string, current: string | null | undefined) => kept?.[name] ?? current ?? '';
  return (
    <form action={action} key={state?.attempt ?? 0} data-testid="hotel-settings-form" noValidate>
      <Grid min={240}>
        <Field label="Название">
          <Input name="name" required maxLength={200} defaultValue={value('name', p.name)} />
        </Field>
        <Field label="Юридическое название">
          <Input name="legalName" maxLength={300} defaultValue={value('legalName', p.legalName)} />
        </Field>
        <Field label="ИИН/БИН">
          <Input name="bin" inputMode="numeric" maxLength={12} defaultValue={value('bin', p.bin)} />
        </Field>
        <Field label="Адрес">
          <Input name="address" maxLength={300} defaultValue={value('address', p.address)} />
        </Field>
        <Field label="Телефон">
          <Input name="phone" type="tel" defaultValue={value('phone', p.phone)} />
        </Field>
        <Field label="Почта">
          <Input name="email" type="email" defaultValue={value('email', p.email)} />
        </Field>
        <Field label="Заезд с">
          <Input
            name="checkInTime"
            type="time"
            required
            defaultValue={value('checkInTime', p.checkInTime)}
          />
        </Field>
        <Field label="Выезд до">
          <Input
            name="checkOutTime"
            type="time"
            required
            defaultValue={value('checkOutTime', p.checkOutTime)}
          />
        </Field>
      </Grid>
      <p className="settings-note">
        Валюта {p.currency} и часовой пояс {p.timezone} — только просмотр: от них зависят суммы и
        границы ночей, их меняет поддержка WETOP. Реквизиты и контакты идут в договор и счёт.
      </p>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.message && <Notice role="status">{state.message}</Notice>}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Сохраняю…' : 'Сохранить'}
      </Button>
    </form>
  );
}
