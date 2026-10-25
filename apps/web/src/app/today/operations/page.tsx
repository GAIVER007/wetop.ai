import { requireFeature } from '../../../lib/vertical-guard';
import { BeautyToday } from '../beauty-today';
import { FoodToday } from '../food-today';
import { HospitalityToday } from '../hospitality-today';
import { TodayScopeContent } from '../scope-content';
import { serverT } from '../../../i18n/server';
export default async function OperationsPage() {
  const me = await requireFeature('/today/operations'),
    c = me.context;
  const t = await serverT();
  if (!c?.locationId || !c.businessId) return <p>{t('Выберите филиал для рабочих инструментов.')}</p>;
  const content =
    c.vertical === 'BEAUTY' ? (
      <BeautyToday operations />
    ) : c.vertical === 'FOOD_SERVICE' ? (
      <FoodToday />
    ) : c.vertical === 'HOSPITALITY' ? (
      <HospitalityToday />
    ) : (
      <p>{t('Направление не поддерживается')}</p>
    );
  return <TodayScopeContent key={`${c.businessId}:${c.locationId}`}>{content}</TodayScopeContent>;
}
