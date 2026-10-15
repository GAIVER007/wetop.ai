import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание хаба продаж: без своего `<Page>` (один `h1` на странице даёт сама страница), читалке говорит `LoadingState` */
export default function Loading() {
  return (
    <div className="page" data-testid="sales-loading">
      <LoadingState label="Загружаем продажи…">
        <Skeleton variant="title" />
        <Skeleton variant="stat" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </div>
  );
}
