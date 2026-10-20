import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { SalonHoursForm } from './hours-form';
import type { BeautyLocationHoursResponse } from '../../lib/api';
const initial: BeautyLocationHoursResponse = {
  location: { id: 'synthetic-location', name: 'Synthetic salon', timezone: 'Asia/Almaty' },
  configured: false,
  revision: 0,
  intervals: [],
  conflicts: [],
  conflictsTruncated: false,
};
it('opens an honest unset weekly salon schedule without inventing opening times', () => {
  const html = renderToStaticMarkup(
    createElement(SalonHoursForm, { initial, scopeKey: 'synthetic', canEdit: true }),
  );
  expect(html).toContain('Режим работы салона');
  expect(html).toContain('Понедельник');
  expect(html).toContain('Режим пока не настроен');
  expect(html).toContain('Добавить интервал');
  expect(html).toContain('Сохранить режим');
  expect(html).not.toContain('value="09:00"');
});
it('does not offer schedule changes to a reader', () => {
  const html = renderToStaticMarkup(
    createElement(SalonHoursForm, { initial, scopeKey: 'synthetic', canEdit: false }),
  );
  expect(html).toContain('Режим работы салона');
  expect(html).not.toContain('Сохранить режим');
});
