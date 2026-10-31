'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, Textarea } from '../../../../components/ui';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';
import { submitStayReview } from './actions';

/** Оценка проживания 1–5 и комментарий (HOTEL-REVIEWS-20261031), вид как у отзыва салона */
export function StayReviewForm({ token }: { token: string }) {
  const t = useT();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <Alert tone="success" data-testid="stay-review-done">{t('Спасибо, отзыв отправлен.')}</Alert>;
  return (
    <form
      className="beauty-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (stars < 1) {
          setError(msg('Поставьте оценку от 1 до 5.'));
          return;
        }
        setError('');
        start(async () => {
          const result = await submitStayReview(token, stars, comment);
          if (result?.error) setError(result.error);
          else if (result?.submitted) setDone(true);
        });
      }}
    >
      <div className="beauty-review-stars" role="radiogroup" aria-label={t('Оценка проживания')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n}>
            <input type="radio" name="stars" value={n} checked={stars === n} onChange={() => setStars(n)} />
            <span aria-hidden="true" data-on={stars >= n}>★</span>
            <span className="sr-only">{t('{n} из 5', { n })}</span>
          </label>
        ))}
      </div>
      <Field label={t('Комментарий')} required={false}>
        <Textarea rows={4} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
      </Field>
      {error ? <Alert>{t(error)}</Alert> : null}
      <Button type="submit" disabled={pending} data-testid="stay-review-send">
        {pending ? t('Отправляем…') : t('Отправить отзыв')}
      </Button>
    </form>
  );
}
