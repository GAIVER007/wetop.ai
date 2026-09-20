import { AmountChip, Button, Page, Panel, Row, Stat, Stats } from '@pms/web';

export const Screen = () => (
  <Page
    title="Брони"
    subtitle="9 бронирований на 20 сент., статус «Проживают»"
    actions={
      <Row>
        <Button tone="secondary" size="sm">
          Все брони дня
        </Button>
        <Button size="sm">Новая бронь</Button>
      </Row>
    }
  >
    <Stats min={170}>
      <Stat label="Заезды" value="24" />
      <Stat label="Выезды" value="27" />
      <Stat label="Проживают" value="55" />
    </Stats>
    <Panel title="Остаток к сбору">
      <Row>
        <AmountChip minor="1640000" tone="due" />
      </Row>
    </Panel>
  </Page>
);

export const WithCrumbs = () => (
  <Page
    title="Цены и ограничения"
    width="wide"
    crumbs={<a href="/management">Управление отелем</a>}
    subtitle="Октябрь 2026, категория «Мужской общий номер»"
  >
    <Panel>Календарь цен на месяц.</Panel>
  </Page>
);
