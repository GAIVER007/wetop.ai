import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./appointment-form', () => ({ AppointmentForm: () => createElement('div', null, 'Synthetic form') }));

import { AppointmentEditor } from './appointment-editor';

describe('AppointmentEditor modal placement', () => {
  it('renders the new appointment in a wide centered overlay and retains dirty-close protection', () => {
    const html = renderToStaticMarkup(createElement(AppointmentEditor, {
      open: true,
      onClose: vi.fn(),
      onDone: vi.fn(),
      day: {} as never,
      customers: [],
      scopeKey: 'synthetic-scope',
      employeeId: 'synthetic-master',
      time: '10:00',
    }));

    expect(html).toContain('class="ui-overlay  ui-overlay--xl appointment-editor"');
    expect(html).not.toContain('ui-drawer');
    expect(html).toContain('data-testid="confirm-dialog"');
  });
});
