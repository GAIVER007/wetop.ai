import { Panel, Skeleton, Stack } from '@pms/web';

export const Variants = () => (
  <Panel title="Формы скелетона">
    <Stack gap="sm">
      <Skeleton variant="title" />
      <Skeleton variant="stat" />
      <Skeleton />
      <Skeleton variant="text" />
    </Stack>
  </Panel>
);

export const TableShape = () => (
  <Panel title="Вместо строк таблицы">
    <Stack gap="sm">
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </Stack>
  </Panel>
);
