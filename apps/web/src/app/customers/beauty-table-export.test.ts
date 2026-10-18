import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BeautyCustomersTable } from './beauty-table';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('server-only', () => ({}));

describe('D2: XLSX выгрузка текущего списка клиентов', () => {
  it('показывает выгрузку текущего отбора с ключом выбранного филиала', () => {
    const html = renderToStaticMarkup(
      createElement(BeautyCustomersTable, {
        items: [],
        canEdit: false,
        scopeKey: 'business-test:location-test',
      }),
    );
    expect(html).toContain('Скачать Excel');
    expect(html).toContain('business-test:location-test');
  });
});
