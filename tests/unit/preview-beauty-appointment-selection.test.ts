import { describe, expect, it } from 'vitest';
import { previewBeautySingleSelection } from '../../scripts/preview/beauty-appointment-selection';

describe('explicit single-item boundary of the generic synthetic Beauty fixture', () => {
  it('retains the existing legacy selection for existing resource guards', () => {
    expect(previewBeautySingleSelection({ employeeId: 'employee', serviceId: 'service' }))
      .toEqual({ ok: true, employeeId: 'employee', serviceId: 'service' });
  });
  it('accepts exactly the current unadjusted single-item UI payload without mutating it', () => {
    const body = { startsAt: '2036-10-06T05:00:00Z', items: [{ employeeId: 'employee', serviceId: 'service' }] };
    const before = JSON.stringify(body);
    expect(previewBeautySingleSelection(body)).toEqual({ ok: true, employeeId: 'employee', serviceId: 'service' });
    expect(JSON.stringify(body)).toBe(before);
  });
  it.each([
    null, {}, [], 'items', [null], [[]], ['item'],
    [{ employeeId: '', serviceId: 'service' }],
    [{ employeeId: 'employee', serviceId: '' }],
    [{ employeeId: 1, serviceId: 'service' }],
    [{ employeeId: 'employee' }],
    [{ employeeId: 'employee', serviceId: 'service' }, { employeeId: 'other', serviceId: 'service' }],
    [{ employeeId: 'employee', serviceId: 'service', basePriceMinor: '1' }],
    [{ employeeId: 'employee', serviceId: 'service', durationMinutes: 15 }],
    [{ employeeId: 'employee', serviceId: 'service', discountMinor: '1' }],
  ])('refuses unsupported or malformed items explicitly: %j', items => {
    expect(previewBeautySingleSelection({ items })).toMatchObject({ ok: false });
  });
  it.each(['employeeId', 'serviceId'])('refuses mixed legacy/%s and items rather than choosing a silent authority', field => {
    expect(previewBeautySingleSelection({ [field]: 'other', items: [{ employeeId: 'employee', serviceId: 'service' }] }))
      .toMatchObject({ ok: false });
  });
});
