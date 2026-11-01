'use client';
import { startTransition, useActionState, type FormEvent } from 'react';
import { Button, Field, Input } from '../../../../components/ui';
import { useT } from '../../../../i18n/locale-provider';
import { joinPartnerAction } from './actions';

/** Имя, почта, телефон, пароль и повтор пароля партнёра (ТЗ 01.11.2026); одна кнопка «Создать кабинет» */
export function JoinForm({ token, email }: { token: string; email: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState(joinPartnerAction.bind(null, token), null);
  return (
    <form
      // поля не стираются после ошибки (React 19 сбрасывает форму после action): отправка через onSubmit
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="stack"
      data-testid="partner-join-form"
    >
      <Field label={t('Имя и фамилия')} required>
        <Input name="name" autoComplete="name" maxLength={200} required />
      </Field>
      <Field label={t('Почта')} required>
        <Input name="email" type="email" autoComplete="email" defaultValue={email ?? ''} maxLength={320} required />
      </Field>
      <Field label={t('Телефон')}>
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} placeholder="+7 701 000 00 00" />
      </Field>
      <Field label={t('Пароль')} required controlId="partner-join-password" hint={t('Не короче 8 знаков')}>
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={t('Повторите пароль')} required>
        <Input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="row">
        <input type="checkbox" name="privacyAccepted" required />
        <span>
          {t('Согласен с')} <a href="https://wetop.ai/privacy" target="_blank" rel="noreferrer">{t('политикой конфиденциальности')}</a>
        </span>
      </label>
      {state?.error && (
        <p className="alert" role="alert" data-testid="partner-join-error">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-join-submit">
        {pending ? t('Создаём…') : t('Создать кабинет')}
      </Button>
    </form>
  );
}
