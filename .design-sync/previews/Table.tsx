import { Table, Panel, AmountChip, StatusBadge } from '@pms/web';

export const Stays = () => (
  <Panel title="Проживания брони 20260920-0007">
    <Table aria-label="Проживания брони">
      <thead>
        <tr>
          <th>Гость</th>
          <th>Проживание</th>
          <th>Место</th>
          <th>Статус</th>
          <th>Стоимость</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Иванов Пётр</td>
          <td>
            <time dateTime="2026-09-20">20 сент. → 23 сент.</time>, 3 ночи
          </td>
          <td>R01</td>
          <td>
            <StatusBadge status="CHECKED_IN" label="живёт" />
          </td>
          <td className="num">33 000 ₸</td>
        </tr>
        <tr>
          <td>Ким Алия</td>
          <td>
            <time dateTime="2026-09-21">21 сент. → 23 сент.</time>, 2 ночи
          </td>
          <td>M03</td>
          <td>
            <StatusBadge status="CONFIRMED" label="ждём" />
          </td>
          <td className="num">16 000 ₸</td>
        </tr>
        <tr>
          <td>Сатпаев Ерлан</td>
          <td>
            <time dateTime="2026-09-21">21 сент. → 22 сент.</time>, 1 ночь
          </td>
          <td>—</td>
          <td>
            <StatusBadge status="TENTATIVE" label="не подтверждена" />
          </td>
          <td className="num">8 000 ₸</td>
        </tr>
      </tbody>
    </Table>
  </Panel>
);

export const Dense = () => (
  <Panel title="Очередь отправок в Channex">
    <Table size="sm" dense nowrap aria-label="Очередь отправок">
      <thead>
        <tr>
          <th>Что</th>
          <th>Категории</th>
          <th>Ночи</th>
          <th>Статус</th>
          <th>Попыток</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>остатки</td>
          <td>Мужской общий номер</td>
          <td>20.09 → 23.09</td>
          <td>отправлено</td>
          <td className="num">1</td>
        </tr>
        <tr>
          <td>цены и ограничения</td>
          <td>Двухместный номер</td>
          <td>20.09 → 30.09</td>
          <td>в очереди</td>
          <td className="num">0</td>
        </tr>
        <tr>
          <td>остатки</td>
          <td>Женский общий номер</td>
          <td>21.09 → 21.09</td>
          <td>ошибка</td>
          <td className="num">3</td>
        </tr>
      </tbody>
    </Table>
  </Panel>
);

export const RowStates = () => (
  <Panel title="Строка выбрана, строка отменена">
    <Table aria-label="Состояния строк">
      <thead>
        <tr>
          <th>Бронь</th>
          <th>Гость</th>
          <th>Источник</th>
          <th>К оплате</th>
        </tr>
      </thead>
      <tbody>
        <tr className="is-active">
          <td>20260920-0007</td>
          <td>Иванов Пётр</td>
          <td>Стойка</td>
          <td>
            <AmountChip minor="1600000" tone="due" />
          </td>
        </tr>
        <tr>
          <td>20260920-0008</td>
          <td>Ким Алия</td>
          <td>Booking.com</td>
          <td>
            <AmountChip minor="1600000" tone="paid" />
          </td>
        </tr>
        <tr className="is-void">
          <td>20260919-0004</td>
          <td>Сатпаев Ерлан</td>
          <td>Trip.com</td>
          <td>—</td>
        </tr>
      </tbody>
    </Table>
  </Panel>
);
