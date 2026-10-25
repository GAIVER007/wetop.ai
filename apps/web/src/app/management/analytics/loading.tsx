import { Page } from '../../../components/page';
import { OverviewSkeleton } from './overview';
import './analytics.css';
import { msg } from '../../../i18n';
import { T } from '../../../i18n/locale-provider';

export default function Loading() {
  return (
    <Page title={<T text={msg('Аналитика')} />}>
      <OverviewSkeleton />
    </Page>
  );
}
