import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRatePlanImportPlan, parseExelyRatePlans } from './rate-plans';

const md = readFileSync(new URL('./__fixtures__/spravochniki.md', import.meta.url), 'utf-8');

describe('parseExelyRatePlans', () => {
  it('parses the tariff table: id, name, enabled, channels, august arrivals', () => {
    const plans = parseExelyRatePlans(md);
    expect(plans).toHaveLength(3);
    expect(plans[0]).toEqual({
      exelyId: '800001',
      name: 'Тестовый базовый',
      enabled: true,
      pricePeriod: '01.01.2026 – 31.12.2026',
      channels: [],
      arrivalsAugust: 12,
    });
    expect(plans[1]!.channels).toEqual(['Booking.com', 'Agoda']);
    expect(plans[2]).toMatchObject({ exelyId: '800003', channels: [], arrivalsAugust: 0 });
  });
  it('fails without the tariff section', () => {
    expect(() => parseExelyRatePlans('# пусто')).toThrow(/Тарифные планы/);
  });
});

describe('buildRatePlanImportPlan', () => {
  it('codes plans as exely-<id>, marks dead tariffs inactive (Q-082 default), links every plan to every type', () => {
    const plan = buildRatePlanImportPlan(
      parseExelyRatePlans(md),
      ['exely-900001', 'exely-900003'],
      'KZT',
    );
    expect(plan.ratePlans.map((p) => [p.code, p.active])).toEqual([
      ['exely-800001', true],
      ['exely-800002', true],
      ['exely-800003', false],
    ]);
    expect(plan.ratePlans[1]!.note).toContain('Booking.com');
    expect(plan.links).toHaveLength(6);
    expect(plan.links).toContainEqual({
      ratePlanCode: 'exely-800003',
      accommodationTypeCode: 'exely-900003',
    });
  });
});
