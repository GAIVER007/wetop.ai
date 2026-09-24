import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание разделов «Номера» (D4): заголовок сразу, под ним плитки и строки будущего содержимого. */
export default function Loading() {
  return (
    <Page title="Номера">
      <LoadingState label="Загружаем номерной фонд…" data-testid="rooms-loading">
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </Page>
  );
}
