import { Panel, SectionTitle, Stat, Stats } from '@pms/web';

export const Sections = () => (
  <>
    <SectionTitle first>Начислено гостям</SectionTitle>
    <Stats min={170}>
      <Stat label="Проживание" value="8,9 млн ₸" />
      <Stat label="Услуги" value="0,76 млн ₸" />
    </Stats>
    <SectionTitle>Деньги на руках</SectionTitle>
    <Stats min={170}>
      <Stat label="Оплачено" value="16,9 млн ₸" />
      <Stat label="Возвращено" value="240 000 ₸" hint="3 возврата" />
    </Stats>
    <SectionTitle>Остаток к сбору</SectionTitle>
    <Panel>Не собрано 164 000 ₸ по 7 броням.</Panel>
  </>
);
