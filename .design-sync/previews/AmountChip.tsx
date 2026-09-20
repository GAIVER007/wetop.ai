import { AmountChip, Panel, Row, Stack } from '@pms/web';

export const Tones = () => (
  <Panel title="Слово перед суммой обязательно">
    <Stack gap="sm">
      <Row>
        <AmountChip minor="1640000" tone="due" />
        <AmountChip minor="3300000" tone="paid" />
      </Row>
      <Row>
        <AmountChip minor="850000" tone="refund" />
        <AmountChip minor="1250050" tone="neutral" />
      </Row>
    </Stack>
  </Panel>
);

export const CustomLabel = () => (
  <Row>
    <AmountChip minor="1100000" tone="due" label="штраф" />
    <AmountChip minor="400000" tone="neutral" label="ранний заезд" />
  </Row>
);

export const InBookingHead = () => (
  <Panel title="Полоса фактов брони">
    <Row gap="lg">
      <span>Иванов Пётр</span>
      <span>20.09.2026 → 23.09.2026, 3 ночи</span>
      <span>R01</span>
      <AmountChip minor="1600000" tone="due" />
    </Row>
  </Panel>
);
