import { hostMatches, siteSpecHash, validateSiteSpec } from '@pms/domain';

interface BookingSite {
  id: string; locationId: string; state: string;
  publishedVersion: { siteId: string; spec: unknown; specHash: string } | null;
  trackedSite: { locationId: string | null; status: string; publicKey: string; hosts: string[] } | null;
  domains: Array<{ host: string }>;
}
interface BookingPage {
  slug: string; isHome: boolean;
  sections: Array<{ id: string; type: string; mode?: string }>;
}

/** Existing published Beauty form only: no new sites, first-branch defaults, hotel widgets or arbitrary URLs. */
export function employeeBookingTarget(site: BookingSite | null, locationId: string, employeeId: string): string | null {
  if (!site || site.locationId !== locationId || site.state !== 'PUBLISHED' || site.domains.length !== 1) return null;
  const tracked = site.trackedSite;
  const version = site.publishedVersion;
  if (!tracked || tracked.status !== 'ACTIVE' || tracked.locationId !== locationId || !/^pms_[a-f0-9]{12}$/.test(tracked.publicKey)) return null;
  if (!version || version.siteId !== site.id || version.specHash !== siteSpecHash(version.spec)) return null;
  const validated = validateSiteSpec(version.spec);
  if (!validated.ok || (validated.spec.site as Record<string, unknown>).vertical !== 'BEAUTY') return null;
  const pages = validated.spec.pages as unknown as BookingPage[];
  const forms = pages.map(page => ({ page, form: page.sections.find(s => s.type === 'leadForm' && s.mode === 'BEAUTY_APPOINTMENT') })).filter(entry => entry.form);
  // Same home-page preference as the existing BOOK action; an ambiguous non-home destination stays unavailable.
  const chosen = forms.find(entry => entry.page.isHome) ?? (forms.length === 1 ? forms[0] : undefined);
  if (!chosen?.form) return null;
  const host = site.domains[0]!.host.toLowerCase();
  let url: URL;
  try { url = new URL(`https://${host}`); } catch { return null; }
  if (url.hostname !== host || url.host !== host || url.pathname !== '/' || url.search || url.hash || url.username || url.password || !hostMatches(tracked.hosts, host)) return null;
  url.pathname = chosen.page.isHome ? '/' : `/${chosen.page.slug}`;
  url.searchParams.set('employeeId', employeeId);
  url.hash = chosen.form.id;
  return url.toString();
}
