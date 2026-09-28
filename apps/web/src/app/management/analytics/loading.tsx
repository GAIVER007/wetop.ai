import { Page } from '../../../components/page';
import { OverviewSkeleton } from './overview';
import './analytics.css';

export default function Loading() {
  return (
    <Page title="Аналитика">
      <OverviewSkeleton />
    </Page>
  );
}
