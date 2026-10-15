import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSiteFacts, starterSpecFromFacts } from '@pms/domain';
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

export const MASTER_ID = '0b0e6a1c-0000-4000-8000-0000000000a1';
export const DISH_IMAGE = '0b0e6a1c-0000-4000-8000-0000000000f1';

/**
 * SITE-2: документ салона или ресторана из заготовки домена (`starterSpecFromFacts`) по вымышленным фактам; тот же путь,
 * что у мгновенного превью стойки
 */
export function verticalSpec(vertical: 'BEAUTY' | 'FOOD_SERVICE'): SiteSpec {
  const facts = buildSiteFacts({
    vertical,
    location: {
      id: MASTER_ID,
      name: vertical === 'BEAUTY' ? 'Салон «Вымышленный»' : 'Кафе «Пример»',
      address: 'Алматы, ул. Тестовая, 1',
      phone: '+77000000001',
      whatsapp: '+77000000002',
      city: null,
    },
    catalog:
      vertical === 'BEAUTY'
        ? {
            kind: 'services',
            items: [
              { code: 'svc-1', name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60, category: 'Ногти' },
              { code: 'svc-2', name: 'Стрижка', price: { minor: '550050', currency: 'KZT' }, durationMin: 45, category: 'Волосы' },
            ],
          }
        : {
            kind: 'menu',
            items: [
              { code: 'dish-1', name: 'Борщ', price: { minor: '250000', currency: 'KZT' }, category: 'Супы', weightGrams: 300 },
              { code: 'dish-2', name: 'Плов', price: { minor: '350000', currency: 'KZT' }, category: 'Горячее' },
            ],
          },
    staff: vertical === 'BEAUTY' ? [{ id: MASTER_ID, name: 'Мастер Айгерим', specialization: 'Маникюр' }] : [],
    hours: {
      days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: '10:00', close: '20:00' })).concat([{ weekday: 6, open: '11:00', close: '18:00' }]),
      checkInTime: null,
      checkOutTime: null,
    },
    photosCount: 0,
    reviews: null,
  });
  return starterSpecFromFacts(facts) as unknown as SiteSpec;
}
