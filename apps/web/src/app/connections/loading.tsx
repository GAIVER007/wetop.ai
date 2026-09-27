import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Интеграций» (D4): заголовок сразу, под ним место карточки подключения. */
export default function Loading() {
  return (
    <Page title="Интеграции">
      <LoadingState label="Проверяем подключения…" data-testid="connections-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
