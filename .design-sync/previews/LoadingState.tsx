import { LoadingState, Panel, Skeleton } from '@pms/web';

export const Rows = () => (
  <Panel title="Брони">
    <LoadingState label="Загружаем брони на 20 сент.…" rows={5} />
  </Panel>
);

export const Dashboard = () => (
  <Panel title="Главная">
    <LoadingState label="Считаем показатели за этот месяц…">
      <Skeleton variant="title" />
      <Skeleton variant="stat" />
      <Skeleton variant="text" />
    </LoadingState>
  </Panel>
);
