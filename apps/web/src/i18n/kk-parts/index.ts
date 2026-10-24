import { salonJournal } from './salon-journal';
import { salonCatalog } from './salon-catalog';
import { dayCustomers } from './day-customers';
import { portalTeam } from './portal-team';
import { finance } from './finance';
import { reportsStock } from './reports-stock';
import { components } from './components';
import type { KkPart } from './types';

export type { KkPart } from './types';

/** Области экранов KK2 (план `plans/desk-kk-2026-10-23.md`): у каждой свой файл словаря, правки не сталкиваются */
export const AREAS: Record<string, KkPart> = {
  'salon-journal': salonJournal,
  'salon-catalog': salonCatalog,
  'day-customers': dayCustomers,
  'portal-team': portalTeam,
  'finance': finance,
  'reports-stock': reportsStock,
  'components': components,
};

export const PARTS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(AREAS).map(([area, part]) => [area, part.phrases]),
);
