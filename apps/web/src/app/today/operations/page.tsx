import { requireVertical } from '../../../lib/vertical-guard';
import { BeautyToday } from '../beauty-today';
import { FoodToday } from '../food-today';
import { HospitalityToday } from '../hospitality-today';
import { TodayScopeContent } from '../scope-content';
import { TODAY_VERTICALS } from '../dispatch';
export default async function OperationsPage() {
  const me = await requireVertical(TODAY_VERTICALS),
    c = me.context;
  if (!c?.locationId || !c.businessId) return <p>Выберите филиал для рабочих инструментов.</p>;
  const content =
    c.vertical === 'BEAUTY' ? (
      <BeautyToday />
    ) : c.vertical === 'FOOD_SERVICE' ? (
      <FoodToday />
    ) : c.vertical === 'HOSPITALITY' ? (
      <HospitalityToday />
    ) : (
      <p>Направление не поддерживается</p>
    );
  return <TodayScopeContent key={`${c.businessId}:${c.locationId}`}>{content}</TodayScopeContent>;
}
