import { Button, PanelTitle, Panel, Row, Stat, StatusBadge } from '@pms/web';

export const Actions = () => (
  <Panel>
    <Row>
      <Button>Заселить</Button>
      <Button tone="secondary">Переселить</Button>
      <Button tone="secondary">Продлить на ночь</Button>
    </Row>
  </Panel>
);

export const Between = () => (
  <Panel>
    <Row className="row--between">
      <PanelTitle>Проживания</PanelTitle>
      <Button size="sm">Добавить проживание</Button>
    </Row>
  </Panel>
);

export const AlignEnd = () => (
  <Panel title="align=&quot;end&quot; — по нижнему краю, элементы разной высоты">
    <Row align="end">
      <Stat label="Загрузка" value="79,5 %" />
      <Button tone="secondary" size="sm">Показать за месяц</Button>
    </Row>
  </Panel>
);

export const WideGap = () => (
  <Panel>
    <Row gap="lg">
      <StatusBadge status="CHECKED_IN" label="живёт" />
      <span>R01</span>
      <span>выезд 23.09.2026</span>
    </Row>
  </Panel>
);
