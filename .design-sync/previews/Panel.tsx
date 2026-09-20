import { Button, Fact, Grid, Panel, Row, Stack } from '@pms/web';

export const WithTitle = () => (
  <Panel title="Подключение к Channex">
    <Grid min={200}>
      <Fact label="Адрес webhook" value="api.wetop.ai" />
      <Fact label="Последнее событие" value="20.09.2026, 10:12" />
      <Fact label="Очередь" value="0 / 0" />
    </Grid>
  </Panel>
);

export const Large = () => (
  <Panel size="lg" title="Счёт проживания">
    <Stack gap="sm">
      <Row className="row--between">
        <span>Проживание, 3 ночи</span>
        <span className="num">33 000 ₸</span>
      </Row>
      <Row className="row--between">
        <span>Ранний заезд</span>
        <span className="num">4 000 ₸</span>
      </Row>
    </Stack>
  </Panel>
);

export const Danger = () => (
  <Panel className="panel--danger" title="Отмена брони">
    <Stack gap="sm">
      <p>
        Начисление 33 000 ₸ сторнируется, вместо него штраф 11 000 ₸ останется на счёте. Ночи
        вернутся в продажу и уйдут в каналы.
      </p>
      <Row>
        <Button tone="danger">Отменить бронь</Button>
      </Row>
    </Stack>
  </Panel>
);
