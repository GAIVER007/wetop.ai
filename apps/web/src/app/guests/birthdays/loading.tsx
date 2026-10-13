import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';

/** Ожидание «Дней рождения»: заголовок свой, а не родительского раздела, поэтому при загрузке не прыгает (мастер-проход UI, этап 2) */
export default function Loading() {
  return (
    <Page title="Дни рождения" subtitle="Гости с днём рождения сегодня и в ближайшие 7 дней">
      <LoadingState label="Загружаем дни рождения…" data-testid="birthdays-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
