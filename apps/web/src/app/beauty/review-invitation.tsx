'use client';
import { useActionState, useState } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import { issueReviewInvitation } from './review-invitation-actions';

export function ReviewInvitation({
  appointmentId,
  scopeKey = '',
}: {
  appointmentId: string;
  scopeKey?: string;
}) {
  const [state, action, pending] = useActionState(issueReviewInvitation, null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const path = state?.invitation?.reviewPath;
  const url =
    path && typeof window !== 'undefined' ? new URL(path, window.location.origin).href : '';
  return (
    <section aria-label="Ссылка на отзыв">
      <form action={action}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="scopeKey" value={scopeKey} />
        <Button
          type="submit"
          tone="secondary"
          disabled={pending}
          onClick={() => {
            setCopied(false);
            setCopyError(false);
          }}
        >
          {pending ? 'Создаём ссылку…' : path ? 'Создать новую ссылку' : 'Создать ссылку на отзыв'}
        </Button>
      </form>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.invitation && (
        <div>
          <p>
            Ссылка готова до{' '}
            {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(
              new Date(state.invitation.expiresAt),
            )}
            . Отправьте её клиенту вручную.
          </p>
          <p>
            Можно оценить мастеров: {state.invitation.masterCount}. Новая ссылка заменяет
            предыдущую.
          </p>
          <Field label="Ссылка на отзыв">
            <Input value={url} readOnly onFocus={(event) => event.target.select()} />
          </Field>
          <Button
            type="button"
            tone="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            {copied ? 'Скопировано' : 'Копировать ссылку'}
          </Button>
          {copied && <p role="status">Ссылка скопирована.</p>}
          {copyError && <Alert>Выделите и скопируйте ссылку из поля.</Alert>}
        </div>
      )}
    </section>
  );
}
