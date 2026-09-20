import { Field, Panel, Row, Select } from '@pms/web';

export const Filters = () => (
  <Panel title="Фильтры шахматки">
    <Row>
      <Field label="Категория" inline>
        <Select defaultValue="dorm-m">
          <option value="all">Все категории</option>
          <option value="dorm-m">Мужской общий номер</option>
          <option value="dorm-f">Женский общий номер</option>
          <option value="twin">Двухместный номер</option>
          <option value="single">Одноместная комната с окном и балконом</option>
        </Select>
      </Field>
      <Field label="Статус" inline>
        <Select defaultValue="all">
          <option value="all">Все статусы</option>
          <option value="in">Проживают</option>
          <option value="wait">Ждём заезда</option>
        </Select>
      </Field>
    </Row>
  </Panel>
);

export const Disabled = () => (
  <Field label="Тариф (приходит из Exely)">
    <Select disabled defaultValue="ota">
      <option value="ota">ОТА невозвратный</option>
    </Select>
  </Field>
);
