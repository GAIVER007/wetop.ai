import { ActionMenu, Panel, StatusBadge, Table } from '@pms/web';

const items = [
  { label: 'Открыть карточку', href: '/reservations/20260920-0007' },
  { label: 'Продлить на ночь', onSelect: () => {} },
  { label: 'Переселить', onSelect: () => {} },
  { label: 'Отменить бронь', onSelect: () => {}, tone: 'danger' as const },
];

export const InRow = () => (
  <Panel title="Меню действий в строке списка">
    <Table aria-label="Брони">
      <thead>
        <tr>
          <th>Бронь</th>
          <th>Гость</th>
          <th>Статус</th>
          <th aria-label="Действия" />
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>20260920-0007</td>
          <td>Иванов Пётр</td>
          <td>
            <StatusBadge status="CHECKED_IN" label="живёт" />
          </td>
          <td>
            <ActionMenu items={items} label="Действия по брони 20260920-0007" size="sm" />
          </td>
        </tr>
        <tr>
          <td>20260920-0008</td>
          <td>Ким Алия</td>
          <td>
            <StatusBadge status="CONFIRMED" label="ждём" />
          </td>
          <td>
            <ActionMenu items={items} label="Действия по брони 20260920-0008" size="sm" />
          </td>
        </tr>
      </tbody>
    </Table>
  </Panel>
);
