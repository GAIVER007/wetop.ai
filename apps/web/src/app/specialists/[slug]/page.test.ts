import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicEmployeeDto } from '@pms/domain';
import { publicEmployee } from '../../../lib/employee-portal-api';
import { formatMoney } from '../../../lib/money';
import SpecialistPage from './page';
vi.mock('../../../lib/employee-portal-api', () => ({ publicEmployee: vi.fn() }));
const service = { id: 'service', name: 'Synthetic service', durationMinutes: 75, priceMinor: '12345', currency: 'KZT' };
const base = {
  name: 'Synthetic specialist', headline: '', biography: '', practiceSinceYear: null,
  slug: 'synthetic-specialist', businessName: 'Synthetic salon', avatar: null, portfolio: [],
  locations: [{ id: 'location', name: 'Synthetic centre', currency: 'KZT' }], locationId: 'location',
  services: [service], bookingUrl: 'https://synthetic.example/?employeeId=employee#booking',
} satisfies PublicEmployeeDto;
async function screen(over: Record<string, unknown>) {
  vi.mocked(publicEmployee).mockResolvedValue({ ...base, services: [{ ...service, ...over }] } as PublicEmployeeDto);
  return renderToStaticMarkup(await SpecialistPage({
    params: Promise.resolve({ slug: base.slug }), searchParams: Promise.resolve({ locationId: 'location' }),
  }));
}
beforeEach(() => vi.clearAllMocks());
describe('public specialist shows existing master price types honestly', () => {
  it('retains fixed price, effective duration and the exact specialist booking target', async () => {
    const html = await screen({ priceType: 'FIXED' });
    expect(html).toContain(formatMoney('12345', 'KZT'));
    expect(html).toContain('75 мин');
    expect(html).toContain('aria-label="Выбрать время: Synthetic service"');
    expect(html).toContain('employeeId=employee');
  });
  it('shows the existing FREE setting as free, not a paid catalog price', async () => {
    expect(await screen({ priceType: 'FREE', priceMinor: '0' })).toContain('Бесплатно');
  });
  it('shows both RANGE endpoints without offering a fixed-price booking', async () => {
    const html = await screen({ priceType: 'RANGE', priceMinor: '10000', priceMaxMinor: '20000' });
    expect(html).toContain(formatMoney('10000', 'KZT'));
    expect(html).toContain(formatMoney('20000', 'KZT'));
    expect(html).not.toContain('aria-label="Выбрать время:');
  });
  it('asks for the price instead of crashing or inventing zero for UNFIXED', async () => {
    const html = await screen({ priceType: 'UNFIXED', priceMinor: null });
    expect(html).toContain('Цена уточняется');
    expect(html).not.toContain('aria-label="Выбрать время:');
  });
});
