import { Panel, Stack, Stat, Stats } from '@pms/web';

export const Blocks = () => (
  <Stack>
    <Panel title="Начислено гостям">
      <Stats min={150}>
        <Stat label="Проживание" value="8,9 млн ₸" />
      </Stats>
    </Panel>
    <Panel title="Деньги на руках">
      <Stats min={150}>
        <Stat label="Оплачено" value="16,9 млн ₸" />
      </Stats>
    </Panel>
  </Stack>
);

export const Tight = () => (
  <Panel title="Услуги на счёте">
    <Stack gap="sm">
      <span>Ранний заезд — 4 000 ₸</span>
      <span>Трансфер — 6 500 ₸</span>
      <span>Стирка — 1 500 ₸</span>
    </Stack>
  </Panel>
);
