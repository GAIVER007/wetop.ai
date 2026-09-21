'use client';
import { Page } from '../../components/page';
import { ErrorState } from '../../components/error-state';

/** Сбой экрана «Брони» вне запроса списка (тот ловит сама страница): заголовок экрана остаётся. */
export default function ReservationsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Page title="Брони" subtitle="Экран не загрузился" width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
