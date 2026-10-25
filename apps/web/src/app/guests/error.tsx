'use client';
import { Page } from '../../components/page';
import { ErrorState } from '../../components/error-state';
import { useT } from '../../i18n/locale-provider';

/** Сбой экрана «Гости и бронирования» вне запроса списка (тот ловит сама страница): заголовок экрана остаётся. */
export default function GuestsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  return (
    <Page title={t('Гости и бронирования')} subtitle={t('Экран не загрузился')} width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
