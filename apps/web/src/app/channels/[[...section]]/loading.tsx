import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание «Каналов продаж» (D4): заголовок сразу, под ним плитки состояния и строки таблиц. */
export default function Loading() {
  return (
    <Page title="Каналы продаж">
      <LoadingState
        label="Загружаем состояние обмена с каналами…"
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
