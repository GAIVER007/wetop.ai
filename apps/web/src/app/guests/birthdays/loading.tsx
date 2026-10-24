import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { serverT } from '../../../i18n/server';

/** Ожидание «Дней рождения»: заголовок свой, а не родительского раздела, поэтому при загрузке не прыгает (мастер-проход UI, этап 2) */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Дни рождения')} subtitle={t('Гости с днём рождения сегодня и в ближайшие 7 дней')}>
      <LoadingState label={t('Загружаем дни рождения…')} data-testid="birthdays-loading">
        <Skeleton variant="row" />
        <Skeleton variant="text" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
