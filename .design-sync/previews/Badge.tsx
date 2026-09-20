import { Badge, Panel, Row, Stack } from '@pms/web';

export const Tones = () => (
  <Panel title="Тон дублирует слово, а не заменяет его">
    <Stack gap="sm">
      <Row>
        <Badge>Ещё не подключено</Badge>
        <Badge tone="info">подтверждена</Badge>
        <Badge tone="ok">оплачено</Badge>
      </Row>
      <Row>
        <Badge tone="warn">грязно</Badge>
        <Badge tone="danger">продано сверх мест</Badge>
      </Row>
    </Stack>
  </Panel>
);

export const InContext = () => (
  <Panel title="Ячейка M03">
    <Row>
      <span>Мужской общий номер</span>
      <Badge tone="warn">грязно</Badge>
      <Badge tone="danger">заблокирована</Badge>
    </Row>
  </Panel>
);
