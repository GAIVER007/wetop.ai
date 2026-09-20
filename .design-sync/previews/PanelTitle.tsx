import { Button, PanelTitle, Panel, Row } from '@pms/web';

export const WithAction = () => (
  <Panel>
    <Row className="row--between">
      <PanelTitle>Очередь отправок в Channex</PanelTitle>
      <Button tone="secondary" size="sm">
        Показать все строки
      </Button>
    </Row>
  </Panel>
);

export const Large = () => (
  <Panel>
    <PanelTitle size="lg">Деньги за период</PanelTitle>
  </Panel>
);
