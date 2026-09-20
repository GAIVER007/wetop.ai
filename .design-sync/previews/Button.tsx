import { Button, Row, Stack, SectionTitle } from '@pms/web';

export const Tones = () => (
  <Stack>
    <SectionTitle first>Залита только главная кнопка ряда</SectionTitle>
    <Row>
      <Button>Заселить</Button>
      <Button tone="secondary">Переселить</Button>
      <Button tone="danger">Отменить бронь</Button>
    </Row>
    <Row>
      <Button tone="warning">Незаезд</Button>
      <Button tone="success">Принять оплату</Button>
      <Button tone="info">Открыть счёт</Button>
      <Button tone="ghost">Сбросить фильтры</Button>
    </Row>
  </Stack>
);

export const Sizes = () => (
  <Row>
    <Button>38 px — обычная</Button>
    <Button size="sm">30 px — в панели</Button>
    <Button size="xs">24 px — в строке</Button>
  </Row>
);

export const States = () => (
  <Stack>
    <Row>
      <Button disabled>Продлить на ночь</Button>
      <Button tone="secondary" disabled>
        Переселить
      </Button>
    </Row>
    <Row>
      <Button disabled>Выполняю…</Button>
      <Button tone="secondary" disabled>
        Сохраняю…
      </Button>
    </Row>
  </Stack>
);
