import type { UnitCard } from './api';

type Stay = UnitCard['stays'][number];

/**
 * Что с местом сейчас и какое проживание следующее — для панели места (ADR-108, срез I2).
 * Проживание держит место с ночи заезда до ночи выезда, не включая её; выселенное досрочно — не держит.
 */
export function unitNow(stays: Stay[], today: string): { current: Stay | null; next: Stay | null } {
  const current =
    stays.find((s) => s.startDate <= today && today < s.endDate && s.status !== 'CHECKED_OUT') ??
    null;
  const next =
    stays
      .filter((s) => s.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  return { current, next };
}
