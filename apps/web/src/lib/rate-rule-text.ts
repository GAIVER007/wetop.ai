/**
 * Слова для производных тарифов и промокодов на стойке (DATA_MODEL §20, срез D4): условия — фразой, без кодов и
 * без «null». Правила считает API; здесь только подпись.
 */
export interface DerivedRuleView {
  parentName: string;
  discountPercent: number;
  minDaysBeforeArrival: number | null;
  maxDaysBeforeArrival: number | null;
  minNights: number | null;
}

export function derivedRuleText(rule: DerivedRuleView): string {
  const parts = [`−${rule.discountPercent}% от «${rule.parentName}»`];
  const { minDaysBeforeArrival: min, maxDaysBeforeArrival: max } = rule;
  if (min !== null && max !== null) parts.push(`заезд за ${min}–${max} дн.`);
  else if (min !== null) parts.push(`заезд не раньше чем за ${min} дн.`);
  else if (max !== null) parts.push(`заезд не позже чем за ${max} дн.`);
  if (rule.minNights !== null) parts.push(`от ${rule.minNights} ноч.`);
  return parts.join('; ');
}

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function promoPeriodText(from: string | null, to: string | null): string {
  if (from && to) return `Проживание с ${dmy(from)} по ${dmy(to)}`;
  if (from) return `Проживание с ${dmy(from)}`;
  if (to) return `Проживание по ${dmy(to)}`;
  return 'Любые даты проживания';
}

export function promoUsesText(uses: number, maxUses: number | null): string {
  return maxUses === null ? String(uses) : `${uses} из ${maxUses}`;
}
