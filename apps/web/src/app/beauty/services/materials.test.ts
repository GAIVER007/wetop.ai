import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyServiceMaterials } from '../../../lib/api';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useActionState: () => [null, vi.fn(), false],
}));
vi.mock('./material-actions', () => ({
  loadBeautyServiceMaterials: vi.fn(),
  saveBeautyServiceMaterials: vi.fn(),
}));
vi.mock('../../../components/ui', () => ({
  Alert: ({ children }: { children: ReactNode }) => createElement('div', { role: 'alert' }, children),
  Button: ({ children, ...props }: { children: ReactNode }) => createElement('button', props, children),
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) => createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Select: ({ children, ...props }: { children: ReactNode }) => createElement('select', props, children),
}));

import { ServiceMaterials } from './materials';

const view = (patch: Partial<BeautyServiceMaterials> = {}): BeautyServiceMaterials => ({
  serviceId: '11111111-1111-4111-8111-111111111111',
  revision: 2,
  locationId: '21111111-1111-4111-8111-111111111111',
  currency: 'KZT',
  totalCostMinor: '12345',
  missingCost: false,
  items: [{
    productId: '31111111-1111-4111-8111-111111111111',
    productName: 'Синтетический шампунь',
    unit: 'г',
    normQty: '0.125',
    onHand: '4.5',
    costMinor: '12345',
    active: true,
  }],
  products: [{
    id: '31111111-1111-4111-8111-111111111111',
    name: 'Синтетический шампунь',
    unit: 'г',
    onHand: '4.5',
    active: true,
  }],
  ...patch,
});

const render = (initial: BeautyServiceMaterials) => renderToStaticMarkup(createElement(ServiceMaterials, {
  serviceId: initial.serviceId,
  serviceName: 'Синтетический уход',
  scopeKey: initial.locationId,
  initial,
}));

describe('техкарта услуги салона', () => {
  it('сохраняет точную decimal-норму и показывает стоимость только из ответа API', () => {
    const html = render(view());
    expect(html).toContain('value="0.125"');
    expect(html).toContain('Себестоимость нормы');
    expect(html).toContain('123,45');
    expect(html).toContain('Плановая себестоимость услуги');
  });

  it('показывает пустой состав без выдуманной нулевой себестоимости', () => {
    const html = render(view({ items: [], products: [], totalCostMinor: null }));
    expect(html).toContain('Материалы не добавлены');
    expect(html).toContain('Себестоимость не рассчитана');
    expect(html).not.toContain('0,00');
    // аудит 21.10.2026 п.23: путь на склад, где заводят расходники
    expect(html).toContain('href="/bar/consumables"');
    expect(html).toContain('Добавить расходник');
  });

  it('объясняет отсутствующую стоимость партии или остаток', () => {
    const original = view();
    const html = render(view({
      totalCostMinor: null,
      missingCost: true,
      items: [{ ...original.items[0]!, costMinor: null }],
    }));
    expect(html).toContain('Нет цены или остатка');
    expect(html).toContain('Для части материалов нет цены партии или не хватает остатка');
    expect(html).toContain('Себестоимость не рассчитана');
  });
});

describe('маржа услуги (владелец 31.10.2026 «Да делай»: себестоимость и маржа)', () => {
  const withPrice = (initial: BeautyServiceMaterials, priceMinor: string) => renderToStaticMarkup(createElement(ServiceMaterials, {
    serviceId: initial.serviceId, serviceName: 'Синтетический уход', scopeKey: initial.locationId, initial, priceMinor,
  }));
  it('цена минус себестоимость и процент от цены, целыми', () => {
    const html = withPrice(view({ totalCostMinor: '150000' }), '500000');
    expect(html).toContain('data-testid="service-margin"');
    expect(html).toMatch(/3\s?500/);
    expect(html).toContain('70%');
  });
  it('себестоимость не рассчитана: маржу не выдумываем', () => {
    expect(withPrice(view({ totalCostMinor: null }), '500000')).not.toContain('data-testid="service-margin"');
  });
});

