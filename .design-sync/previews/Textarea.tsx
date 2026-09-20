import { Field, Panel, Textarea } from '@pms/web';

export const Note = () => (
  <Panel title="Заметки по брони">
    <Field label="Заметка администратора">
      <Textarea
        rows={4}
        defaultValue={'Просил номер потише, подальше от кухни.\nЗаезд после 22:00 — предупредил ночную смену.'}
      />
    </Field>
  </Panel>
);

export const Empty = () => (
  <Field label="Комментарий к отмене">
    <Textarea rows={3} placeholder="Почему бронь отменяется — увидит ночная смена" />
  </Field>
);
