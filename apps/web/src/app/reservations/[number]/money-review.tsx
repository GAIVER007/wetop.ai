'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';

/** Проверка ввода не вызывает финансовую команду. Любая правка требует новой проверки. */
export function useMoneyReview(pending: boolean, onDraftChange?: (dirty: boolean) => void) {
  const [review, setReview] = useState<Record<string, string> | null>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (!pending) {
      submitted.current = false;
      setReview(null);
    }
  }, [pending]);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (pending || submitted.current) {
      event.preventDefault();
      return;
    }
    if (!review) {
      event.preventDefault();
      setReview(Object.fromEntries(Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value)])));
      onDraftChange?.(true);
      return;
    }
    submitted.current = true;
  };
  const onChange = () => {
    setReview(null);
    onDraftChange?.(true);
  };
  return { review, onSubmit, onChange };
}
