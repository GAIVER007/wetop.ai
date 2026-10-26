import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./organization-locale-actions', () => ({ saveOrganizationLocale: vi.fn() }));

import { OrganizationLocaleField } from './organization-locale';
import { LocaleProvider } from '../i18n/locale-provider';

/**
 * Язык организации (ORG-LOCALE-20261026): владелец выбирает его в настройке салона и на странице «Организация». На нём
 * уходят приглашения, открываются экраны приглашения и пароля, новый сотрудник входит с ним.
 */
describe('язык организации: поле', () => {
  it('три языка, выбран текущий, подсказка объясняет, на что он влияет', () => {
    const html = renderToStaticMarkup(h(OrganizationLocaleField, { value: 'en', canEdit: true }));
    expect(html).toContain('Язык салона для сотрудников');
    expect(html).toMatch(/<option value="en" selected="">English<\/option>/);
    expect(html).toContain('Русский');
    expect(html).toContain('Қазақша');
    expect(html).toContain('приглашения');
  });
  it('на английском экране подписи английские', () => {
    const html = renderToStaticMarkup(
      h(LocaleProvider, { locale: 'en', children: h(OrganizationLocaleField, { value: 'en', canEdit: true }) }),
    );
    expect(html).toContain('Business language for staff');
    expect(html.replace(/Русский|Қазақша/g, '')).not.toMatch(/[А-Яа-яЁё]/);
  });
  it('без права владельца выбор только для чтения', () => {
    const html = renderToStaticMarkup(h(OrganizationLocaleField, { value: 'ru', canEdit: false }));
    expect(html).toMatch(/<select[^>]*disabled/);
  });
});
