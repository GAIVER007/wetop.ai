import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание сопоставлений (D4): заголовок сразу, под ним строки будущих таблиц. */
export default function Loading() {
  return (
    <Page title="Каналы продаж">
      <LoadingState label="Загружаем сопоставления…" data-testid="mapping-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
