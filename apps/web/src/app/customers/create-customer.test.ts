import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ createBeautyCustomerState: vi.fn() }));

import { CreateCustomer, customerFieldErrors } from './create-customer';

describe('«Добавить клиента» с пустыми полями (аудит салона 22.10.2026)', () => {
  it('пустые имя и телефон называются под полями', () => {
    expect(customerFieldErrors({ firstName: ' ', phone: '' })).toEqual({
      firstName: 'Укажите имя клиента',
      phone: 'Укажите телефон, например +7 701 000 00 00',
    });
    expect(customerFieldErrors({ firstName: 'Мария', phone: '+7 701 111 22 33' })).toEqual({});
  });

  it('форма без браузерных подсказок: своя проверка', () => {
    const html = renderToStaticMarkup(createElement(CreateCustomer, { businessId: 'b1', onSaved: () => {} }));
    expect(html.toLowerCase()).toContain('novalidate=""');
  });
});
