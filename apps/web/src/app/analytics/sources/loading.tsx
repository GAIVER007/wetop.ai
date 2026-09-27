import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание отчёта по источникам (D4): заголовок сразу, под ним плитки и строки будущей таблицы. */
export default function Loading() {
  return (
    <Page title="Источники продаж">
      <LoadingState label="Загружаем отчёт по источникам…" data-testid="sources-loading">
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
