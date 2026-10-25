import { Badge } from '../../components/ui';
import type { FoodCustomer } from '../../lib/food-types';
import { msg } from '../../i18n';
import { T } from '../../i18n/locale-provider';

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** День рождения приходится на `day` (ГГГГ-ММ-ДД филиала); 29 февраля в невисокосный год — 28-го (§36) */
export function birthdayOn(birthDate: string | null | undefined, day: string): boolean {
  if (!birthDate) return false;
  let md = birthDate.slice(5);
  if (md === '02-29' && !leap(Number(day.slice(0, 4)))) md = '02-28';
  return md === day.slice(5);
}

/** Метки гостя в бронях и панели брони: VIP и день рождения в день брони (§36, ADR-166) */
export function GuestMarks({ customer, day }: { customer: FoodCustomer; day: string }) {
  const birthday = birthdayOn(customer.birthDate, day);
  if (!customer.isVip && !birthday) return null;
  return (
    <span className="food-inline-actions" data-testid="guest-marks">
      {customer.isVip && <Badge tone="warn">VIP</Badge>}
      {birthday && <Badge tone="info"><T text={msg('День рождения')} /></Badge>}
    </span>
  );
}
