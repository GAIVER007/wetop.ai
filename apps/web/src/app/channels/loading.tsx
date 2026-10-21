import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Каналов» (D4): заголовок сразу, под ним плитки очереди и строки таблиц. */
export default function Loading() {
  return (
    <Page title="Каналы продаж — Channex">
      <LoadingState
        label="Загружаем очередь, webhook и события Channex…"
        data-testid="channels-loading"
      >
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
