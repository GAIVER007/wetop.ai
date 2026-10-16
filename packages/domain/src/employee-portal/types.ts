// Approved employee-portal boundary: private and public responses intentionally use distinct types.
export type PortalVertical = 'BEAUTY' | 'FOOD_SERVICE';
export type PortalPercentBasis = 'COMPLETED_SERVICES' | 'PAID_COMPLETED_SERVICES';
export type PortalPayModel = 'FIXED' | 'PERCENT' | 'FIXED_PLUS_PERCENT' | 'BONUS_ONLY';
export interface PortalImage { id: string; url: string; width: number; height: number }
export interface PortalProfile {
  headline: string; biography: string; practiceSinceYear: number | null;
  slug: string; published: boolean; publicationConsent: boolean; revision: string;
}
export interface PortalWork {
  id: string; title: string; description: string; serviceId: string | null;
  image: PortalImage; published: boolean; publicationConsent: boolean;
}
export interface PortalService {
  id: string; name: string; durationMinutes: number; priceMinor: string; currency: string;
  assigned: boolean; available: boolean;
}
export interface PortalWeekDay { weekday: number; intervals: Array<{ timeFrom: string; timeTo: string }> }
export interface PortalTimeOff { id: string; dateFrom: string; dateTo: string; reason: string | null }
export interface PortalAppointment {
  id: string; date: string; startsAt: string; endsAt: string;
  customerName: string; serviceName: string; status: string; priceMinor: string; currency: string;
}
export interface PortalOrder { id: string; number: string; status: string; totalMinor: string; currency: string; tableName: string | null }
export interface PortalPay {
  status: 'NOT_CONFIGURED' | 'AVAILABLE' | 'SELECT_LOCATION' | 'UNSUPPORTED_POLICY';
  month: string; currency: string; model: PortalPayModel | null; fixedMinor: string | null;
  percent: number | null; percentBasis: PortalPercentBasis | null; policyRevision: string | null;
  earnedMinor: string | null; bonusMinor: string | null; penaltyMinor: string | null;
  paidMinor: string | null; remainingMinor: string | null; explanation: string;
  adjustments: Array<{ id: string; amountMinor: string; reason: string }>;
}
export interface PortalScheduleConflict {
  id: string; date: string; startsAt: string; endsAt: string;
  locationId: string; locationName: string; timezone: string; serviceName: string;
  reason: 'OUTSIDE_WORKING_HOURS' | 'TIME_OFF';
}
export interface EmployeePortalDto {
  access: 'MANAGER' | 'SELF';
  employee: { id: string; name: string; phone: string | null; email: string | null; active: boolean; accountLinked: boolean };
  business: { id: string; name: string; vertical: PortalVertical };
  location: { id: string; name: string; timezone: string; currency: string } | null;
  profile: PortalProfile; avatar: PortalImage | null; portfolio: PortalWork[];
  services: PortalService[]; servicesRevision: string | null; week: PortalWeekDay[]; weekRevision: string | null;
  scheduleConflicts: { items: PortalScheduleConflict[]; checkedFrom: string; checkedCount: number; truncated: boolean };
  timeOffs: PortalTimeOff[]; appointments: PortalAppointment[]; orders: PortalOrder[];
  pay: PortalPay;
}
// Public projection has no private Employee, account, schedule reasons, orders, pay or customer fields.
export interface PublicEmployeeDto {
  name: string; headline: string; biography: string; practiceSinceYear: number | null; slug: string;
  businessName: string; avatar: PortalImage | null;
  portfolio: Array<{ id: string; title: string; description: string; image: PortalImage }>;
  locations: Array<{ id: string; name: string; currency: string }>;
  locationId: string | null;
  services: Array<{ id: string; name: string; durationMinutes: number; priceMinor: string; currency: string }>;
  bookingUrl: string | null;
}
export interface PortalProfileInput {
  name?: string; phone?: string | null; email?: string | null;
  headline?: string; biography?: string; practiceSinceYear?: number | null;
  expectedRevision: string;
}
export interface PortalPublicationInput { published: boolean; publicationConsent: boolean; expectedRevision: string }
export interface PortalPortfolioInput { title: string; description?: string; serviceId?: string | null; publicationConsent?: boolean; published?: boolean }
