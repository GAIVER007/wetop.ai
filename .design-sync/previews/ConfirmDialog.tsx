import { ConfirmDialog } from '@pms/web';

const noop = () => {};

export const CancelWithPenalty = () => (
  <ConfirmDialog
    open
    title="Отменить бронь 20260920-0007?"
    confirmLabel="Отменить бронь"
    onConfirm={noop}
    onCancel={noop}
  >
    Начисление 33 000 ₸ сторнируется, вместо него штраф 11 000 ₸ останется на счёте гостя.
    Ночи 20.09 → 23.09 вернутся в продажу и уйдут в каналы.
  </ConfirmDialog>
);
