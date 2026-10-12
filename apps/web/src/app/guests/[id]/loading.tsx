import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание карточки гостя: заголовок свой, а не родительского раздела, поэтому при загрузке не прыгает (мастер-проход UI, этап 2) */
export default function Loading() {
  return (
    <Page title="Карточка гостя">
      <LoadingState label="Загружаем карточку гостя…" data-testid="guest-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
