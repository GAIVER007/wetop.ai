'use client';
import { Page } from '../components/page';
import { ErrorState } from '../components/error-state';
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Page title="Не удалось загрузить данные" width="narrow">
      <ErrorState error={error} retry={retry} />
    </Page>
  );
}
