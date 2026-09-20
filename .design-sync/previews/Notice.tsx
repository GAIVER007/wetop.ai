import { Notice, Panel, Stack } from '@pms/web';

export const Result = () => (
  <Stack>
    <Notice>Оплата принята: 12 500 ₸</Notice>
    <Notice>Ушло в очередь каналов: 4 строки</Notice>
  </Stack>
);

export const Muted = () => (
  <Panel title="Тарифы">
    <Notice tone="muted">
      Категории и тарифы приходят из Exely — здесь они только читаются.
    </Notice>
  </Panel>
);
