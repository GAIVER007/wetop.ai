import { Fact, Grid, Panel } from '@pms/web';

export const Facts = () => (
  <Panel title="Гость">
    <Grid min={190}>
      <Fact label="Телефон" value="+7 701 000 00 00" />
      <Fact label="Гражданство" value="Казахстан" />
      <Fact label="Email" value="—" />
      <Fact label="Проживаний" value="4" />
    </Grid>
  </Panel>
);

export const WithTime = () => (
  <Panel title="Счётчик сайта">
    <Grid min={220}>
      <Fact label="Ключ счётчика" value="wetop-ai-001" />
      <Fact
        label="Последнее событие"
        value={<time dateTime="2026-09-20T10:12">20.09.2026, 10:12</time>}
      />
    </Grid>
  </Panel>
);
