import { Alert, Field, Input, Panel, Stack } from '@pms/web';

export const Tones = () => (
  <Stack>
    <Alert>Цена не может быть 0</Alert>
    <Alert tone="warning">Тариф не сопоставлен с Channex — цена в каналы не уйдёт</Alert>
    <Alert tone="success">Остатки отправлены: 31 ночь</Alert>
  </Stack>
);

export const Boxed = () => (
  <Alert tone="warning" boxed>
    Продано сверх мест: 1 проживание без ячейки на 21 сент. Разберите на шахматке — иначе гостю
    некуда заселяться.
  </Alert>
);

export const InForm = () => (
  <Panel title="Цена за ночь">
    <Stack gap="sm">
      <Field label="Цена, ₸">
        <Input defaultValue="0" aria-invalid />
      </Field>
      <Alert>Цена не может быть 0</Alert>
    </Stack>
  </Panel>
);
