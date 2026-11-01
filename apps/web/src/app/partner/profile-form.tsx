'use client';
import { startTransition, useActionState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Notice, Textarea } from '../../components/ui';
import type { PartnerProfile } from '../../lib/api';
import { useT } from '../../i18n/locale-provider';
import { savePartnerProfileAction } from './profile-actions';

/** «Мой профиль»: специализация, город, опыт, телефон, описание; одна кнопка «Сохранить» */
export function PartnerProfileForm({ profile }: { profile: PartnerProfile }) {
  const t = useT();
  const [state, action, pending] = useActionState(savePartnerProfileAction, null);
  return (
    <form
      // введённое не стирается после ошибки
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="partner__profile-form"
      data-testid="partner-profile-form"
    >
      <Field label={t('Специализация')}>
        <Input name="specialization" maxLength={120} defaultValue={profile.specialization ?? ''} placeholder={t('Маркетолог, агентство, консультант')} />
      </Field>
      <Field label={t('Город')}>
        <Input name="city" maxLength={80} defaultValue={profile.city ?? ''} />
      </Field>
      <Field label={t('Опыт, лет')}>
        <Input name="experienceYears" inputMode="numeric" maxLength={2} defaultValue={profile.experienceYears ?? ''} />
      </Field>
      <Field label={t('Телефон')}>
        <Input name="phone" type="tel" maxLength={40} defaultValue={profile.phone ?? ''} />
      </Field>
      <Field label={t('О себе')} className="partner__profile-about">
        <Textarea name="about" maxLength={1000} rows={3} defaultValue={profile.about ?? ''} />
      </Field>
      <div className="partner__profile-save">
        {state?.error && <Alert role="alert" data-testid="partner-profile-error">{t(state.error)}</Alert>}
        {state?.saved && <Notice data-testid="partner-profile-saved">{t('Профиль сохранён.')}</Notice>}
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="partner-profile-save">
          {pending ? t('Сохраняю…') : t('Сохранить')}
        </Button>
      </div>
    </form>
  );
}
