import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание журнала действий (D4): заголовок сразу, под ним строки будущей таблицы. */
export default function Loading() {
  return (
    <Page title="Журнал действий">
      <LoadingState label="Загружаем журнал действий…" data-testid="journal-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
