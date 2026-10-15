import { describe, expect, it } from 'vitest';
import { beautyReadiness } from './beauty-readiness';
import { onboardingFlow } from './registry';

describe('Beauty onboarding contract', () => {
  it('uses the complete Beauty v2 flow while other adapters stay v1', () => {
    expect(onboardingFlow('BEAUTY').version).toBe(2);
    expect(onboardingFlow('BEAUTY').steps.map((s) => s.id)).toEqual([
      'welcome',
      'profile',
      'services',
      'masters',
      'skills',
      'schedule',
      'review',
    ]);
    expect(onboardingFlow('HOSPITALITY').version).toBe(1);
    expect(onboardingFlow('FOOD_SERVICE').version).toBe(1);
  });
});

const service = {
  id: 's1',
  active: true,
  priceMinor: 0n,
  currency: 'KZT',
  durationMinutes: 60,
  location: { enabled: true },
};
const employee = {
  id: 'e1',
  active: true,
  worksHere: true,
  serviceIds: ['s1'],
  hours: [{ weekday: 1, timeFrom: '09:00', timeTo: '10:00' }],
};
const input = { currency: 'KZT', profileApplied: true, services: [service], employees: [employee] };
describe('linked configuration readiness', () => {
  it('accepts a free service and any suitable weekly day', () =>
    expect(beautyReadiness(input)).toMatchObject({
      ready: true,
      chain: { employeeId: 'e1', serviceId: 's1' },
    }));
  it('requires the applied profile', () =>
    expect(beautyReadiness({ ...input, profileApplied: false }).ready).toBe(false));
  it('does not combine another employee skills with a different employee hours', () => {
    const result = beautyReadiness({
      ...input,
      employees: [
        { ...employee, hours: [] },
        { ...employee, id: 'e2', serviceIds: [] },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.steps[2]?.done).toBe(true);
    expect(result.steps[3]?.done).toBe(false);
  });
  it.each([{ active: false }, { worksHere: false }, { serviceIds: [] }])(
    'ignores unusable employee %j',
    (patch) =>
      expect(beautyReadiness({ ...input, employees: [{ ...employee, ...patch }] }).ready).toBe(
        false,
      ),
  );
  it.each([
    { active: false },
    { currency: 'USD' },
    { location: { enabled: false } },
    { location: null },
  ])('ignores unusable service %j', (patch) =>
    expect(beautyReadiness({ ...input, services: [{ ...service, ...patch }] }).ready).toBe(false),
  );
  it('uses the Location duration override rather than the catalogue duration', () =>
    expect(
      beautyReadiness({
        ...input,
        services: [{ ...service, location: { enabled: true, durationOverrideMinutes: 90 } }],
      }).ready,
    ).toBe(false));
  it('does not add intervals through a break or accept an overlapping template', () => {
    for (const hours of [
      [
        { weekday: 1, timeFrom: '09:00', timeTo: '09:30' },
        { weekday: 1, timeFrom: '10:00', timeTo: '10:30' },
      ],
      [
        { weekday: 1, timeFrom: '09:00', timeTo: '11:00' },
        { weekday: 1, timeFrom: '10:00', timeTo: '12:00' },
      ],
    ])
      expect(beautyReadiness({ ...input, employees: [{ ...employee, hours }] }).ready).toBe(false);
  });
});
