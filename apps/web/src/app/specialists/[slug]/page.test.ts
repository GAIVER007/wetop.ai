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
  reviews: { averageStars: null, count: 0, items: [] },
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

// карточка мастера для клиента (владелец 28.10.2026): инициалы без фото, рейтинг, отзывы без имён, кнопка записи
describe('public specialist card for clients', () => {
  it('shows initials, rating with count, reviews and the big booking button', async () => {
    vi.mocked(publicEmployee).mockResolvedValue({ ...base, reviews: { averageStars: 4.66, count: 3, items: [
      { stars: 5, comment: 'Очень аккуратно', submittedAt: '2026-10-27T10:00:00.000Z' },
      { stars: 4, comment: null, submittedAt: '2026-10-24T10:00:00.000Z' },
    ] } });
    const html = renderToStaticMarkup(await SpecialistPage({ params: Promise.resolve({ slug: base.slug }), searchParams: Promise.resolve({ locationId: 'location' }) }));
    expect(html).toContain('portal-avatar--initials');
    expect(html).toContain('>SS<');
    expect(html).toMatch(/data-testid="specialist-rating"[^>]*>★ 4,7, 3 отзыва</);
    expect(html).toContain('Очень аккуратно');
    expect(html).toContain('★★★★☆');
    expect(html).toContain('Записаться к Synthetic specialist');
  });
  it('hides rating and reviews when there are none yet', async () => {
    vi.mocked(publicEmployee).mockResolvedValue(base);
    const html = renderToStaticMarkup(await SpecialistPage({ params: Promise.resolve({ slug: base.slug }), searchParams: Promise.resolve({ locationId: 'location' }) }));
    expect(html).not.toContain('specialist-rating');
    expect(html).not.toContain('specialist-reviews');
  });
});
