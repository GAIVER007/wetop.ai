import { Field, Input, Panel, Stack, Alert } from '@pms/web';

export const Fields = () => (
  <Panel title="Гость">
    <Stack>
      <Field label="Фамилия и имя">
        <Input name="guest" defaultValue="Иванов Пётр" />
      </Field>
      <Field label="Телефон">
        <Input name="phone" type="tel" defaultValue="+7 701 000 00 00" />
      </Field>
      <Field label="Дата заезда">
        <Input name="from" type="date" defaultValue="2026-09-20" />
      </Field>
    </Stack>
  </Panel>
);

export const States = () => (
  <Panel title="Состояния поля">
    <Stack>
      <Field label="Обычное">
        <Input defaultValue="20260920-0007" />
      </Field>
      <Field label="Только чтение">
        <Input defaultValue="Booking.com" readOnly />
      </Field>
      <Field label="Отключено">
        <Input defaultValue="Тариф из Exely" disabled />
      </Field>
      <Field label="С ошибкой">
        <Input defaultValue="0" aria-invalid />
      </Field>
      <Alert>Цена не может быть 0</Alert>
    </Stack>
  </Panel>
);
