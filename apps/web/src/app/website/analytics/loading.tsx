import { Page } from '../../../components/page';
import { LoadingState, Skeleton } from '../../../components/ui';
import { WEBSITE_TITLE } from '../../../lib/website';
import { MarketingCrumb, WebsiteTabs } from '../parts';
import '../website.css';

/** Ожидание аналитики сайта (D4): заголовок сразу, под ним плитки показателей и строки таблиц. */
export default function Loading() {
  return (
    <Page crumbs={<MarketingCrumb />} title={WEBSITE_TITLE}>
      <WebsiteTabs current="analytics" />
      <LoadingState label="Считаем отчёт по сайту…" data-testid="an-loading">
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
