import { FeaturePending, Stack } from '@pms/web';

export const Pending = () => (
  <Stack>
    <FeaturePending
      icon="analytics"
      text="Отчёт по акциям появится, когда акции заведут в системе."
    />
    <FeaturePending
      icon="mail"
      text="Письма гостям не подключены: отправителя почты у объекта пока нет."
    />
  </Stack>
);
