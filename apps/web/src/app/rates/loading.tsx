import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание календаря цен (D4): заголовок сразу, под ним строки будущей таблицы. */
export default function Loading() {
  return (
    <Page width="wide" title="Цены и ограничения">
      <LoadingState
        label="Загружаем категории, тарифы и календарь цен…"
        data-testid="rates-loading"
      >
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
