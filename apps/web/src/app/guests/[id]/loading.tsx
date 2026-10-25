import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { serverT } from '../../../i18n/server';

/** Ожидание карточки гостя: заголовок свой, а не родительского раздела, поэтому при загрузке не прыгает (мастер-проход UI, этап 2) */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Карточка гостя')}>
      <LoadingState label={t('Загружаем карточку гостя…')} data-testid="guest-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
