/** Exact owned fixture selection. Pure parsing, no connection or credential logging. */
export function beautyReleaseFixtureUrl(raw: string | undefined, ci: boolean, portalFixture?: string): URL {
  const url = new URL(raw || '');
  // pg/libpq permits query keys to override the authority; reject them BEFORE any client connects.
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.search || url.hash)
    throw new Error('Beauty release fixture rejects protocol, query and fragment overrides');
  const local = url.hostname === '127.0.0.1' && url.port === '55983' && url.username === 'salon_core' && url.pathname === '/salon_schema_release_20261018';
  const dedicatedCi = ci && portalFixture === 'owner-home-ci'
    && url.hostname === '127.0.0.1' && url.port === '55516' && url.username === 'owner_home_test' && url.pathname === '/wetop_owner_home';
  if (!local && !dedicatedCi) throw new Error('Beauty release proof requires the exact owned local or dedicated ephemeral CI fixture');
  return url;
}
