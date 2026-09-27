import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание обзора каналов (D4): заголовок сразу, под ним полоса состояния и будущие карточки. */
export default function Loading() {
  return (
    <Page title="Каналы продаж">
      <LoadingState label="Загружаем состояние каналов…" data-testid="channel-manager-loading">
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
