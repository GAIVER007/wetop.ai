'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, Textarea } from '../../../components/ui';
import { submitBeautyReview } from './actions';
import type { BeautyReviewMaster } from './review-types';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';

type Draft = { selected: boolean; stars: number; comment: string };

export function BeautyReviewForm({ token, masters }: { token: string; masters: BeautyReviewMaster[] }) {
  const t = useT();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(masters.map((master) => [master.key, { selected: false, stars: 0, comment: '' }])),
  );
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const patch = (key: string, value: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [key]: { ...current[key]!, ...value } }));

  if (done)
    return <Alert tone="success" data-testid="beauty-review-done">{t('Спасибо, отзыв отправлен.')}</Alert>;

  return (
    <form
      className="beauty-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        const reviews = masters.flatMap((master) => {
          const draft = drafts[master.key];
          return draft?.selected
            ? [{ masterKey: master.key, stars: draft.stars, ...(draft.comment.trim() ? { comment: draft.comment } : {}) }]
            : [];
        });
        if (!reviews.length || reviews.some((review) => review.stars < 1)) {
          setError(msg('Выберите хотя бы одного мастера и поставьте оценку.'));
          return;
        }
        setError('');
        startTransition(async () => {
          const result = await submitBeautyReview(token, reviews);
          if (result?.error) setError(result.error);
          else if (result?.submitted) setDone(true);
        });
      }}
    >
      <p className="beauty-review-hint">{t('Выберите мастеров, которым хотите оставить отзыв. Достаточно оценить одного.')}</p>
      {masters.map((master) => {
        const draft = drafts[master.key]!;
        return (
          <fieldset className="beauty-review-master" key={master.key}>
            <label className="beauty-review-choice">
              <input
                type="checkbox"
                checked={draft.selected}
                onChange={(event) => patch(master.key, { selected: event.target.checked })}
              />
              <span>{t('Оценить {name}', { name: master.name })}</span>
            </label>
            <div className="beauty-review-stars" role="radiogroup" aria-label={t('Оценка для {name}', { name: master.name })}>
              {[1, 2, 3, 4, 5].map((stars) => (
                <label key={stars}>
                  <input
                    type="radio"
                    name={`stars-${master.key}`}
                    value={stars}
                    checked={draft.stars === stars}
                    disabled={!draft.selected}
                    onChange={() => patch(master.key, { stars })}
                  />
                  <span aria-hidden="true" data-on={draft.stars >= stars}>★</span>
                  <span className="sr-only">{t('{n} из 5', { n: stars })}</span>
                </label>
              ))}
            </div>
            <Field label={t('Комментарий для {name}', { name: master.name })} required={false}>
              <Textarea
                rows={3}
                value={draft.comment}
                disabled={!draft.selected}
                onChange={(event) => patch(master.key, { comment: event.target.value })}
              />
            </Field>
          </fieldset>
        );
      })}
      {error && <Alert>{t(error)}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? t('Отправляем…') : t('Отправить отзыв')}</Button>
    </form>
  );
}
