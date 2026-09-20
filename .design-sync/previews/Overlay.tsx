import { Fact, Grid, Overlay, Panel } from '@pms/web';

export const Drawer = () => (
  <Overlay open onClose={() => {}} title="Бронь 20260920-0007" drawer>
    <Panel title="Факты брони">
      <Grid min={170}>
        <Fact label="Гость" value="Иванов Пётр" />
        <Fact label="Проживание" value="20.09.2026 → 23.09.2026, 3 ночи" />
        <Fact label="Место" value="R01" />
        <Fact label="Источник" value="Booking.com" />
      </Grid>
    </Panel>
  </Overlay>
);
