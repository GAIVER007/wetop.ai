import { salonJournal } from './salon-journal';
import { salonCatalog } from './salon-catalog';
import { dayCustomers } from './day-customers';
import { portalTeam } from './portal-team';
import { finance } from './finance';
import { reportsStock } from './reports-stock';
import { components } from './components';
import { marketingSite } from './marketing-site';
import { marketingAds } from './marketing-ads';
import { restaurantService } from './restaurant-service';
import { restaurantOps } from './restaurant-ops';
import { reservations } from './reservations';
import { hotelBoard } from './hotel-board';
import { hotelSetup } from './hotel-setup';
import { channelsMarket } from './channels-market';
import { activityOps } from './activity-ops';
import { platformOrg } from './platform-org';
import { sellerSite } from './seller-site';
import { analyticsEntry } from './analytics-entry';
import { libSellerSite } from './lib-seller-site';
import { libOps } from './lib-ops';
import { learn } from './learn';
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
  'marketing-site': marketingSite,
  'marketing-ads': marketingAds,
  'restaurant-service': restaurantService,
  'restaurant-ops': restaurantOps,
  'reservations': reservations,
  'hotel-board': hotelBoard,
  'hotel-setup': hotelSetup,
  'channels-market': channelsMarket,
  'activity-ops': activityOps,
  'platform-org': platformOrg,
  'seller-site': sellerSite,
  'analytics-entry': analyticsEntry,
  'lib-seller-site': libSellerSite,
  'lib-ops': libOps,
  'learn': learn,
};

export const PARTS: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(AREAS).map(([area, part]) => [area, part.phrases]),
);
