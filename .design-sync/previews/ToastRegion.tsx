import { ToastRegion } from '@pms/web';

export const Tones = () => (
  <ToastRegion
    items={[
      { id: 1, text: 'Гость заселён, R01', tone: 'success' },
      { id: 2, text: 'Продлено до 24 сент., +8 000 ₸ на счёт', tone: 'info' },
      { id: 3, text: 'Бронь не подтверждена — проверьте тариф', tone: 'warning' },
      { id: 4, text: 'Ячейка 6 уже занята', tone: 'danger' },
    ]}
    dismiss={() => {}}
  />
);
