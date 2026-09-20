import { Button, EmptyState, Icon, Panel } from '@pms/web';

export const NoResults = () => (
  <Panel title="Брони">
    <EmptyState
      icon={<Icon name="guests" width={32} height={32} />}
      title="По запросу «Иванов» броней нет"
      actions={
        <>
          <Button tone="secondary" size="sm">
            Убрать поиск
          </Button>
          <Button size="sm">Новая бронь</Button>
        </>
      }
    >
      Поиск идёт по фамилии гостя и номеру брони.
    </EmptyState>
  </Panel>
);

export const NothingYet = () => (
  <Panel title="Аналитика сайта">
    <EmptyState
      icon={<Icon name="analytics" width={32} height={32} />}
      title="Счётчик не подключён"
      actions={<Button size="sm">Подключить счётчик</Button>}
    >
      Пока счётчика нет, сессии и просмотры не собираются.
    </EmptyState>
  </Panel>
);

export const SourceExplained = () => (
  <Panel title="Тарифы">
    <EmptyState
      icon={<Icon name="rates" width={32} height={32} />}
      title="Тарифных планов нет"
      actions={
        <Button tone="secondary" size="sm">
          Список тарифных планов
        </Button>
      }
    >
      Категории и тарифы приходят из Exely. Пока их нет, календарь цен пуст.
    </EmptyState>
  </Panel>
);
