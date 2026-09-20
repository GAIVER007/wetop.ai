import { Stat, Stats } from '@pms/web';

export const Tones = () => (
  <Stats min={180}>
    <Stat label="Загрузка" value="79,5 %" hint="+4,1 п.п. к прошлой неделе" />
    <Stat label="Не собрано" value="164 000 ₸" tone="alarm" hint="7 броней" hintTone="warn" />
    <Stat label="Без ячейки" value="2" tone="warn" hint="проживания на сегодня" />
  </Stats>
);

export const Sizes = () => (
  <Stats min={200}>
    <Stat label="Начислено за месяц" value="9,66 млн ₸" size="big" />
    <Stat label="Заезды" value="24" size="compact" />
  </Stats>
);
