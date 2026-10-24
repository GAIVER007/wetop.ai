'use client';
import { useActionState, useState } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import { issueReviewInvitation } from './review-invitation-actions';
import { intlLocale } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { dateFormat } from '../../i18n/dates';

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
  const t = useT();
  const locale = useLocale();
  const path = state?.invitation?.reviewPath;
  const url =
    path && typeof window !== 'undefined' ? new URL(path, window.location.origin).href : '';
  return (
    <section aria-label={t('Ссылка на отзыв')}>
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
          {pending ? t('Создаём ссылку…') : path ? t('Создать новую ссылку') : t('Создать ссылку на отзыв')}
        </Button>
      </form>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.invitation && (
        <div>
          <p>
            {t('Ссылка готова до {date}. Отправьте её клиенту вручную.', {
              date: dateFormat(intlLocale(locale), { dateStyle: 'long' }).format(
                new Date(state.invitation.expiresAt),
              ),
            })}
          </p>
          <p>
            {t('Можно оценить мастеров: {n}. Новая ссылка заменяет предыдущую.', {
              n: state.invitation.masterCount,
            })}
          </p>
          <Field label={t('Ссылка на отзыв')}>
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
            {copied ? t('Скопировано') : t('Копировать ссылку')}
          </Button>
          {copied && <p role="status">{t('Ссылка скопирована.')}</p>}
          {copyError && <Alert>{t('Выделите и скопируйте ссылку из поля.')}</Alert>}
        </div>
      )}
    </section>
  );
}
