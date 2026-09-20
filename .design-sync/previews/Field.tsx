import { Field, Input, Panel, Row, Select, Stack } from '@pms/web';

export const Above = () => (
  <Panel title="Подпись над полем">
    <Stack>
      <Field label="Фамилия и имя">
        <Input defaultValue="Ким Алия" />
      </Field>
      <Field label="Гражданство">
        <Select defaultValue="kz">
          <option value="kz">Казахстан</option>
          <option value="other">Другое</option>
        </Select>
      </Field>
    </Stack>
  </Panel>
);

export const Inline = () => (
  <Panel title="Подпись слева — для ряда фильтров">
    <Row>
      <Field label="С" inline>
        <Input type="date" defaultValue="2026-09-20" />
      </Field>
      <Field label="По" inline>
        <Input type="date" defaultValue="2026-09-23" />
      </Field>
      <Field label="Только свободные" inline>
        <Input type="checkbox" defaultChecked />
      </Field>
    </Row>
  </Panel>
);
