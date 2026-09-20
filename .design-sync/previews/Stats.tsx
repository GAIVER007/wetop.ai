import { Stat, Stats } from '@pms/web';

export const Dashboard = () => (
  <Stats min={180}>
    <Stat label="Загрузка" value="79,5 %" hint="+4,1 п.п. к прошлой неделе" />
    <Stat label="Начислено" value="9,66 млн ₸" hint="+12 % к прошлому месяцу" />
    <Stat label="Заезды" value="573" hint="+8 %" />
    <Stat label="Не собрано" value="164 000 ₸" tone="alarm" hint="7 броней" hintTone="warn" />
  </Stats>
);

export const Narrow = () => (
  <Stats min={130}>
    <Stat label="Заезды" value="24" size="compact" />
    <Stat label="Выезды" value="27" size="compact" />
    <Stat label="Проживают" value="55" size="compact" />
    <Stat label="Свободно" value="33" size="compact" />
  </Stats>
);
