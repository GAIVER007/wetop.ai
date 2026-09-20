import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание «Неисправностей» (D4): заголовок сразу, под ним плитки сторожа и строки таблиц. */
export default function Loading() {
  return (
    <Page title="Неисправности">
      <LoadingState
        label="Читаем состояние сторожа и список неисправностей…"
        data-testid="incidents-loading"
      >
        <div className="stats">
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
