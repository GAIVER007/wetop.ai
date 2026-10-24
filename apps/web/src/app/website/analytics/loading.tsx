import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { WEBSITE_TITLE } from '../../../lib/website';
import { MarketingCrumb, WebsiteTabs } from '../parts';
import '../website.css';
import { serverT } from '../../../i18n/server';

/** Ожидание аналитики сайта (D4): заголовок сразу, под ним плитки показателей и строки таблиц. */
export default async function Loading() {
  const t = await serverT();
  return (
    <Page crumbs={<MarketingCrumb />} title={t(WEBSITE_TITLE)}>
      <WebsiteTabs current="analytics" />
      <LoadingState label={t('Считаем отчёт по сайту…')} data-testid="an-loading">
        <div className="stats">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
        <Skeleton variant="row" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </LoadingState>
    </Page>
  );
}
