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

/** Английские части словаря EN1: те же области, что kk-parts, каждая фраза в одной части */
export const EN_PARTS: Record<string, Record<string, string>> = {
  "salon-journal": salonJournal,
  "salon-catalog": salonCatalog,
  "day-customers": dayCustomers,
  "portal-team": portalTeam,
  "finance": finance,
  "reports-stock": reportsStock,
  "components": components,
  "marketing-site": marketingSite,
  "marketing-ads": marketingAds,
  "restaurant-service": restaurantService,
  "restaurant-ops": restaurantOps,
  "reservations": reservations,
  "hotel-board": hotelBoard,
  "hotel-setup": hotelSetup,
  "channels-market": channelsMarket,
  "activity-ops": activityOps,
  "platform-org": platformOrg,
  "seller-site": sellerSite,
  "analytics-entry": analyticsEntry,
  "lib-seller-site": libSellerSite,
  "lib-ops": libOps,
  "learn": learn,
};
