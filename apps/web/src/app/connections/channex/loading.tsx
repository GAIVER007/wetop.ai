import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { serverT } from '../../../i18n/server';

/** Ожидание «Подключения каналов»: заголовок тот же, что у страницы, проверка объекта идёт в Channex живьём */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page title={t('Подключение каналов')}>
      <LoadingState label={t('Проверяем соединение с менеджером каналов…')} data-testid="channex-loading">
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
