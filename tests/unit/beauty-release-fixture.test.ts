import { describe, expect, it } from 'vitest';
import { beautyReleaseFixtureUrl } from '../tools/beauty-release-fixture';
const local = 'postgresql://salon_core@127.0.0.1:55983/salon_schema_release_20261018';
const ci = 'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';

describe('release fixture rejects libpq URL overrides before any connection', () => {
  it('accepts the exact owned local URL', () => expect(beautyReleaseFixtureUrl(local,false).toString()).toBe(local));
  it('accepts the dedicated CI URL only with both CI selectors', () => {
    expect(beautyReleaseFixtureUrl(ci,true,'owner-home-ci').toString()).toBe(ci);
    expect(() => beautyReleaseFixtureUrl(ci,false,'owner-home-ci')).toThrow();
    expect(() => beautyReleaseFixtureUrl(ci,true,'different')).toThrow();
  });
  it.each(['?host=example.invalid','?port=5432','?user=postgres','?database=production',
    '?host=%2Fvar%2Frun%2Fpostgresql','?options=-csearch_path%3Dother','?application_name=override'])('rejects %s even with an allowed URL authority', query => {
    expect(() => beautyReleaseFixtureUrl(local+query,false)).toThrow();
    expect(() => beautyReleaseFixtureUrl(ci+query,true,'owner-home-ci')).toThrow();
  });
  it.each([local.replace('postgresql:','https:'),local.replace('postgresql:','http:'),local+'#override',
    local.replace('127.0.0.1','example.invalid'),local.replace(':55983',':5432'),local.replace('salon_core@','postgres@'),
    local.replace('salon_schema_release_20261018','shared_database')])('rejects an unsupported or unowned endpoint %s', raw => {
    expect(() => beautyReleaseFixtureUrl(raw,false)).toThrow();
  });
});
