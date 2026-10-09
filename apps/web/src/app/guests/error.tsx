'use client';
import { Page } from '../../components/page';
import { ErrorState } from '../../components/error-state';

/** Сбой экрана «Гости и бронирования» вне запроса списка (тот ловит сама страница): заголовок экрана остаётся. */
export default function GuestsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Page title="Гости и бронирования" subtitle="Экран не загрузился" width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
