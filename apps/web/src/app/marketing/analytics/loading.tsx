import { LoadingState, Skeleton } from '../../../components/ui';
import { msg } from '../../../i18n';

/** Ожидание аналитики маркетинга: без своего `<Page>` (один `h1` на странице даёт сама страница), читалке говорит `LoadingState` */
export default function Loading() {
  return (
    <div className="page" data-testid="marketing-analytics-loading">
      <LoadingState label={msg('Загружаем аналитику маркетинга…')}>
        <Skeleton variant="title" />
        <Skeleton variant="stat" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </div>
  );
}
