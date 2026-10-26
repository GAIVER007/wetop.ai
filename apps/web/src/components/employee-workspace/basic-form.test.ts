import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmployeeBasicForm } from './basic-form';
const render = (emailRequired = false) =>
  renderToStaticMarkup(
    createElement(EmployeeBasicForm, {
      draft: { name: '', phone: '', email: '', active: true },
      onChange: () => {},
      onSave: () => {},
      onCancel: () => {},
      creating: true,
      pending: false,
      disabled: false,
      error: null,
      current: null,
      formRef: { current: null },
      personnelKind: 'SPECIALIST',
      onPersonnelKindChange: () => {},
      emailRequired,
    }),
  );
describe('compact employee creation', () => {
  it('matches approved reference: contacts, separate names and personnel cards', () => {
    const html = render();
    expect(html).toContain('Контакты');
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="lastName"');
    expect(html).toContain('Тип специалиста');
    expect(html).not.toContain('Кто это');
    expect(html).toContain('Код страны');
  });
  it('requires email only when application access is selected', () => {
    expect(render(true)).toMatch(
      /<input[^>]*name="email"[^>]*required=""|<input[^>]*required=""[^>]*name="email"/,
    );
    expect(render(false)).not.toMatch(
      /<input[^>]*name="email"[^>]*required=""|<input[^>]*required=""[^>]*name="email"/,
    );
  });
});
