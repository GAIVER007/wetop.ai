import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание отчёта по каналам (D4): заголовок сразу, под ним плитки и строки будущей таблицы. */
export default function Loading() {
  return (
    <Page title="Менеджер каналов">
      <LoadingState label="Загружаем отчёт по каналам…" data-testid="channel-manager-loading">
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
