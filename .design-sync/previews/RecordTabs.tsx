import { Fact, Grid, Panel, RecordTabs, Table } from '@pms/web';

export const BookingCard = () => (
  <RecordTabs
    tabs={[
      {
        id: 'overview',
        label: 'Обзор',
        content: (
          <Panel title="Факты брони">
            <Grid min={190}>
              <Fact label="Гость" value="Иванов Пётр" />
              <Fact label="Проживание" value="20.09.2026 → 23.09.2026, 3 ночи" />
              <Fact label="Место" value="R01" />
            </Grid>
          </Panel>
        ),
      },
      {
        id: 'stays',
        label: 'Проживания',
        content: (
          <Panel>
            <Table aria-label="Проживания">
              <tbody>
                <tr>
                  <td>R01</td>
                  <td>20 сент. → 23 сент.</td>
                </tr>
              </tbody>
            </Table>
          </Panel>
        ),
      },
      { id: 'folio', label: 'Счета', content: <Panel>Начислено 33 000 ₸, оплачено 17 000 ₸.</Panel> },
      { id: 'actions', label: 'Действия', content: <Panel>Переселить, продлить, отменить.</Panel> },
    ]}
  />
);
