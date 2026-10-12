'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Field, Textarea } from '../../../components/ui';
import { StarsInput } from '../../food/rating-parts';
import { submitRating } from './actions';

export function RateForm({ token }: { token: string }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done)
    return (
      <Alert tone="success" data-testid="rate-done">
        Спасибо! Оценка отправлена.
      </Alert>
    );
  return (
    <form
      className="rest-rating"
      onSubmit={(e) => {
        e.preventDefault();
        if (!stars) return setError('Выберите от 1 до 5 звёзд');
        start(async () => {
          const r = await submitRating(token, stars, comment);
          if (r.error) setError(r.error);
          else setDone(true);
        });
      }}
    >
      {error && <Alert>{error}</Alert>}
      <StarsInput value={stars} onChange={setStars} />
      <Field label="Комментарий, если хотите">
        <Textarea value={comment} maxLength={500} rows={3} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending}>
        Отправить оценку
      </Button>
    </form>
  );
}
