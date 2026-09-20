import { Panel, Stack, StatusBadge, Row } from '@pms/web';

export const AllStatuses = () => (
  <Panel title="Статусы брони словами стойки">
    <Stack gap="sm">
      <Row>
        <StatusBadge status="TENTATIVE" label="не подтверждена" />
        <StatusBadge status="CONFIRMED" label="подтверждена" />
        <StatusBadge status="CHECKED_IN" label="живёт" />
      </Row>
      <Row>
        <StatusBadge status="CHECKED_OUT" label="выехал" />
        <StatusBadge status="CANCELLED" label="отменена" />
        <StatusBadge status="NO_SHOW" label="незаезд" />
      </Row>
    </Stack>
  </Panel>
);

export const InRow = () => (
  <Panel title="В строке справочника">
    <Row gap="lg">
      <span>20260920-0007</span>
      <span>Иванов Пётр</span>
      <StatusBadge status="CHECKED_IN" label="живёт" />
    </Row>
  </Panel>
);
