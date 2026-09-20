import { Fact, Grid, Panel } from '@pms/web';

export const Facts = () => (
  <Panel title="Факты брони">
    <Grid min={190}>
      <Fact label="Гость" value="Иванов Пётр" />
      <Fact label="Проживание" value="20.09.2026 → 23.09.2026, 3 ночи" />
      <Fact label="Место" value="R01" />
      <Fact label="Гостей" value="2" />
      <Fact label="Источник" value="Booking.com" />
      <Fact label="Гражданство" value="—" />
    </Grid>
  </Panel>
);

export const Cards = () => (
  <Grid min={210} gap="sm">
    <Panel title="R01">Иванов Пётр, выезд 23 сент.</Panel>
    <Panel title="R02">Свободен до 19 сент.</Panel>
    <Panel title="R03">Закрыт: ремонт душевой</Panel>
    <Panel title="M03">Ким Алия, выезд 23 сент.</Panel>
  </Grid>
);
