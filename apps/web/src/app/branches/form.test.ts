import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { BranchForm } from './form';
vi.mock('./actions', () => ({ createBranch: vi.fn() }));
it('offers restaurant, only approved currencies and advanced timezone settings', () => {
  const html = renderToStaticMarkup(createElement(BranchForm, { id: 'test' }));
  expect(html).toContain('FOOD_SERVICE');
  expect(html.match(/<option/g)).toHaveLength(2);
  expect(html).toContain('Дополнительные настройки');
  expect(html).toContain('Asia/Almaty');
});
