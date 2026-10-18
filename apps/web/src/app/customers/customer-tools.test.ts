import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BeautyCustomerTools } from './customer-tools';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('server-only', () => ({}));

describe('D1/D2: действия над клиентами', () => {
  it('показывает ручное добавление и импорт CSV/XLSX только с правом записи', () => {
    const editable = renderToStaticMarkup(createElement(BeautyCustomerTools, { canEdit: true, scopeKey: 'business:location' }));
    expect(editable).toContain('Добавить клиента');
    expect(editable).toContain('Импортировать клиентов');
    expect(editable).toContain('Имя');
    expect(editable).toContain('Телефон');

    const readOnly = renderToStaticMarkup(createElement(BeautyCustomerTools, { canEdit: false, scopeKey: 'business:location' }));
    expect(readOnly).not.toContain('Добавить клиента');
    expect(readOnly).not.toContain('Импортировать клиентов');
  });
});
