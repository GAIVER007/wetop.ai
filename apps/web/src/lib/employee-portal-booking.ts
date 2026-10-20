/** Preserve the verified destination and master while choosing the clicked service. */
export function specialistServiceBookingUrl(base: string | null, serviceId: string): string | null {
  if (!base) return null;
  let url: URL;
  try { url = new URL(base); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  url.searchParams.set('serviceId', serviceId);
  return url.toString();
}
