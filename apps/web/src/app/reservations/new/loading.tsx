import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание новой брони: заголовок свой, а не родительского раздела, поэтому при загрузке не прыгает (мастер-проход UI, этап 2) */
export default function Loading() {
  return (
    <Page title="Новая бронь">
      <LoadingState label="Готовим форму брони…" data-testid="booking-new-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
