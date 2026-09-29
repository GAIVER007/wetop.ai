'use client';
import { useRouter } from 'next/navigation';
import { ErrorState } from './error-state';

/**
 * Данные экрана не пришли, а сам экран остаётся (B5, D2): заголовок, фильтры и адрес с условиями на
 * месте, вместо чисел и строк — экран сбоя со следующим шагом. «Повторить загрузку» перечитывает
 * страницу с теми же условиями (`router.refresh()`), ничего не сбрасывая. `Error` собирается здесь: из
 * серверного компонента в клиентский он не передаётся.
 */
export function LoadError({
  status,
  message,
  testId,
  title,
}: {
  status: number | undefined;
  message: string;
  testId: string;
  /** заголовок ошибки для экрана (передаётся в `ErrorState`) */
  title?: string;
}) {
  const router = useRouter();
  const error: Error & { digest?: string } = new Error(message);
  if (status) error.digest = `API_${status}`;
  return (
    <div data-testid={testId}>
      <ErrorState error={error} retry={() => router.refresh()} title={title} />
    </div>
  );
}
