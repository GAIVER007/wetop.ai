import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { BranchForm } from './form';
vi.mock('./actions', () => ({ createBranch: vi.fn() }));
it('offers restaurant, only approved currencies and advanced timezone settings', () => {
  const html = renderToStaticMarkup(createElement(BranchForm, { id: 'test' }));
  expect(html).toContain('FOOD_SERVICE');
  // валюты и пояса из одного списка домена: страны партнёров (17.10.2026)
  for (const code of ['KZT', 'USD', 'AED', 'QAR']) expect(html).toContain(`value="${code}"`);
  expect(html.match(/<option/g)).toHaveLength(7);
  expect(html).toContain('Дополнительные настройки');
  expect(html).toContain('value="Asia/Almaty"');
});
