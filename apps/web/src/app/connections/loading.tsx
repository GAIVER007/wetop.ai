import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Подключений» (D4): заголовок тот же, что у страницы, под ним место карточки подключения. */
export default function Loading() {
  return (
    <Page title="Подключения">
      <LoadingState label="Проверяем подключения…" data-testid="connections-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
