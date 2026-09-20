import { Button, LoadError, Panel, Row, Field, Input } from '@pms/web';

export const ScreenStaysAlive = () => (
  <Panel title="Деньги за период">
    <Row>
      <Field label="С" inline>
        <Input type="date" defaultValue="2026-09-01" />
      </Field>
      <Field label="По" inline>
        <Input type="date" defaultValue="2026-09-30" />
      </Field>
      <Button size="sm">Показать</Button>
    </Row>
    <LoadError status={503} message="Сервис отчётов не ответил" testId="finance-error" />
  </Panel>
);

export const Rejected = () => (
  <Panel title="Доступность">
    <LoadError
      status={400}
      message="Период больше 62 ночей — столько шахматка не считает"
      testId="availability-error"
    />
  </Panel>
);
