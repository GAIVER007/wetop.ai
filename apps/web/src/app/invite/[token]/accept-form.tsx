'use client';
import { useState, useTransition } from 'react';
import { Icon } from '../../../components/icon';
import { acceptInviteAction } from '../../login/actions';
import { useT } from '../../../i18n/locale-provider';

/** Одна кнопка: принять. При удаче действие само уводит на форму входа на шаге кода. */
export function AcceptForm({ token }: { token: string }) {
  const t = useT();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        startTransition(async () => {
          const r = await acceptInviteAction(token);
          if (r?.error) setError(r.error);
        });
      }}
    >
      {error && (
        <p className="alert" role="alert">
          {t(error)}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {t('Принять приглашение')}
        <Icon name="arrow" width={16} />
      </button>
    </form>
  );
}
