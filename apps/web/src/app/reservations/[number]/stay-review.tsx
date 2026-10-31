'use client';
import { useActionState, useState } from 'react';
import type { StayReview } from '../../../lib/api';
import { Alert, Button, Field, Input } from '../../../components/ui';
import { messengerLinks } from '../../../lib/format';
import { useT } from '../../../i18n/locale-provider';
import { issueStayReviewAction } from './stay-review-actions';

/**
 * Отзыв гостя после выезда (HOTEL-REVIEWS-20261031): как у записи салона. После выезда стойка создаёт ссылку,
 * копирует или отправляет в WhatsApp; отзыв, когда гость ответил, виден здесь же.
 */
export function StayReviewPanel({
  number,
  review,
  checkedOut,
  canMutate,
  phone,
}: {
  number: string;
  review: StayReview | null;
  checkedOut: boolean;
  canMutate: boolean;
  phone: string | null;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(issueStayReviewAction, null);
  const [copied, setCopied] = useState(false);
  if (review?.status === 'SUBMITTED')
    return (
      <section className="stay-review" data-testid="stay-review" aria-label={t('Отзыв гостя')}>
        <h3>{t('Отзыв гостя')}</h3>
        <p className="stay-review__stars" data-testid="stay-review-stars" role="img" aria-label={t('Оценка {n} из 5', { n: review.stars ?? 0 })}>
          {'★'.repeat(review.stars ?? 0)}
          <span className="muted">{'★'.repeat(5 - (review.stars ?? 0))}</span>
        </p>
        {review.comment ? <p data-testid="stay-review-comment">{review.comment}</p> : null}
      </section>
    );
  if (!checkedOut || !canMutate) return null;
  const url = state?.reviewPath && typeof window !== 'undefined' ? new URL(state.reviewPath, window.location.origin).href : '';
  const wa = messengerLinks(phone);
  return (
    <section className="stay-review" data-testid="stay-review" aria-label={t('Отзыв гостя')}>
      <h3>{t('Отзыв гостя')}</h3>
      <form action={action}>
        <input type="hidden" name="number" value={number} />
        <Button type="submit" tone="secondary" disabled={pending} data-testid="stay-review-issue">
          {pending ? t('Создаём ссылку…') : url ? t('Создать новую ссылку') : t('Создать ссылку на отзыв')}
        </Button>
      </form>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {url ? (
        <div className="stay-review__link">
          <Field label={t('Ссылка на отзыв')}>
            <Input value={url} readOnly data-testid="stay-review-url" onFocus={(e) => e.target.select()} />
          </Field>
          <Button
            type="button"
            tone="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url).then(() => setCopied(true), () => setCopied(false));
            }}
          >
            {copied ? t('Скопировано') : t('Копировать ссылку')}
          </Button>
          {wa ? (
            <a
              className="btn btn--secondary"
              href={`${wa.whatsapp}?text=${encodeURIComponent(t('Спасибо, что были у нас! Оцените, пожалуйста, проживание: {url}', { url }))}`}
              target="_blank"
              rel="noreferrer"
              data-testid="stay-review-whatsapp"
            >
              {t('Отправить в WhatsApp')}
            </a>
          ) : null}
        </div>
      ) : review?.status === 'ISSUED' ? (
        <p className="muted">{t('Ссылка уже выдана. Новая заменит прежнюю.')}</p>
      ) : null}
    </section>
  );
}
