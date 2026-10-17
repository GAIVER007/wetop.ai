/**
 * Валюта Главной гостиницы (аудит платформы 17.10.2026, Д11): валюта долгов периода, а если они не загрузились, валюта
 * объекта. Раньше подставлялся KZT, и у объекта в другой валюте суммы дня подписывались тенге.
 */
export function homeCurrency(debts: { currency: string } | null, propertyCurrency: string): string {
  return debts?.currency ?? propertyCurrency;
}
