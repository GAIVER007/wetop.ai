'use client';
import { Page } from '../../components/page';
import { useT } from '../../i18n/locale-provider';
import { LoadingState, Skeleton } from '../../components/ui';

/** Ожидание журнала действий (D4): заголовок сразу, под ним строки будущей таблицы. */
export default function Loading() {
  const t = useT();
  return (
    <Page title={t('История действий')}>
      <LoadingState label={t('Загружаем журнал действий…')} data-testid="journal-loading">
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
