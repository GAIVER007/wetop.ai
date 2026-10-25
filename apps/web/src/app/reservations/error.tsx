'use client';
import { Page } from '../../components/page';
import { ErrorState } from '../../components/error-state';
import { useT } from '../../i18n/locale-provider';

/** Сбой экрана «Брони» вне запроса списка (тот ловит сама страница): заголовок экрана остаётся. */
export default function ReservationsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  return (
    <Page title={t('Брони')} subtitle={t('Экран не загрузился')} width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
