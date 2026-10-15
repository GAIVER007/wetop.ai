import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RenderContext } from '../render/context';
import type { PublicFacts, RuntimeCurrent, SiteSpec } from '../types';

/** Пример SiteSpec v0 из документации: 11 секций Hospitality, гостиница вымышленная (ADR-010) */
export const exampleSpec = (): SiteSpec =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8')) as SiteSpec;

export const facts = (patch: Partial<PublicFacts> = {}): PublicFacts => ({
  loadedAt: '2026-10-06T10:00:00.000Z',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  categories: [
    { code: 'standard-double', active: true, capacityAdults: 2 },
    { code: 'dorm-bed', active: true, capacityAdults: 1 },
  ],
  ...patch,
});

export function ctx(patch: Partial<RenderContext> = {}): RenderContext {
  const spec = patch.spec ?? exampleSpec();
  return {
    spec,
    locale: 'ru',
    page: spec.pages.find((p) => p.isHome)!,
    facts: facts(),
    publicKey: 'pms_0123456789ab',
    bookingLive: true,
    apiOrigin: 'https://api.example.test',
    assets: {},
    ...patch,
  };
}

export const SITE_ID = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';

export function current(patch: Partial<RuntimeCurrent> = {}): RuntimeCurrent {
  return {
    siteId: SITE_ID,
    state: 'PUBLISHED',
    primaryHost: null,
    defaultLocale: 'ru',
    versionId: '5b3e4c12-5d6f-4071-8c8d-9e0f1a2b3c4d',
    schemaVersion: 'site-spec/0',
    specHash: 'a'.repeat(64),
    spec: exampleSpec(),
    publicKey: 'pms_0123456789ab',
    bookingEnabled: true,
    publicApiUrl: 'https://api.example.test',
    assets: {},
    publicFacts: facts(),
    ...patch,
  };
}
