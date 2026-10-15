import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание бюджета маркетинга: без своего `<Page>` (один `h1` на странице даёт сама страница), читалке говорит `LoadingState` */
export default function Loading() {
  return (
    <div className="page" data-testid="marketing-budget-loading">
      <LoadingState label="Загружаем бюджет маркетинга…">
        <Skeleton variant="title" />
        <Skeleton variant="stat" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </div>
  );
}
