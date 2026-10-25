'use client';
import { Page } from '../components/page';
import { ErrorState } from '../components/error-state';
import { useT } from '../i18n/locale-provider';
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  return (
    <Page title={t('Не удалось загрузить данные')} width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
