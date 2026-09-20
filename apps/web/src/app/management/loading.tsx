import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание статистики загрузки (D4): заголовок сразу, под ним плитки и строки категорий. */
export default function Loading() {
  return (
    <Page title="Статистика">
      <LoadingState label="Считаем загрузку по шахматке…" data-testid="statistics-loading">
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
