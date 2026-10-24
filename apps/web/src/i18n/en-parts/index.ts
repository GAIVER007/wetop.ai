import { salonJournal } from './salon-journal';
import { salonCatalog } from './salon-catalog';
import { dayCustomers } from './day-customers';
import { portalTeam } from './portal-team';
import { finance } from './finance';
import { reportsStock } from './reports-stock';
import { components } from './components';

/** Английские части словаря EN1: те же области, что kk-parts, каждая фраза в одной части */
export const EN_PARTS: Record<string, Record<string, string>> = {
  "salon-journal": salonJournal,
  "salon-catalog": salonCatalog,
  "day-customers": dayCustomers,
  "portal-team": portalTeam,
  "finance": finance,
  "reports-stock": reportsStock,
  "components": components,
};
