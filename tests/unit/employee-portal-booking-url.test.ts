import { describe, expect, it } from 'vitest';
import { specialistServiceBookingUrl } from '../../apps/web/src/lib/employee-portal-booking';

describe('specialist service booking link', () => {
  it('keeps the bound employee and real destination while selecting the clicked service', () => {
    const href = specialistServiceBookingUrl('https://salon.example/booking?employeeId=master-a#form', 'service-a');
    const url = new URL(href!);
    expect(url.origin).toBe('https://salon.example'); expect(url.pathname).toBe('/booking');
    expect(url.searchParams.get('employeeId')).toBe('master-a'); expect(url.searchParams.get('serviceId')).toBe('service-a');
    expect(url.hash).toBe('#form');
  });
  it('does not invent an online booking destination', () => { expect(specialistServiceBookingUrl(null, 'service-a')).toBeNull(); });
  it.each(['javascript:alert(1)', 'http://salon.example/', 'https://user:password@salon.example/', 'not-a-url'])('does not turn an unsafe destination into an action: %s', base => {
    expect(specialistServiceBookingUrl(base, 'service-a')).toBeNull();
  });
});
