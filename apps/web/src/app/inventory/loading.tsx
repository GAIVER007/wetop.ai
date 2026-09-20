import { Page } from '../../components/page';
import { LoadingState, Skeleton } from '../../components/ui';

export default function Loading() {
  return (
    <Page title="Номерной фонд">
      <LoadingState label="Загружаем номерной фонд…">
        <Skeleton variant="stat" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </Page>
  );
}
