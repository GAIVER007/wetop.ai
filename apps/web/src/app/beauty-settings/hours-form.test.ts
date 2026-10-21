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

it('аудит 21.10.2026 пп. 8, 37: пояс словами, копирование на все дни и «Сохранить» внутри карточки', () => {
  const html = renderToStaticMarkup(
    createElement(SalonHoursForm, { initial: { ...initial, configured: true, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] }, scopeKey: 'synthetic', canEdit: true }),
  );
  expect(html).not.toContain('Asia/Almaty');
  expect(html).toMatch(/Алматы, UTC\+\d/);
  expect(html).toContain('Скопировать понедельник на все дни');
  const week = html.slice(html.indexOf('salon-hours-week'));
  expect(week.indexOf('Сохранить режим')).toBeLessThan(week.indexOf('</fieldset>'));
});

it('аудит 21.10.2026 п. 2: из настроек салона есть путь к профилю, специалистам, доступу и истории', async () => {
  const { SettingsLinks } = await import('./settings-links');
  const html = renderToStaticMarkup(createElement(SettingsLinks));
  for (const href of ['/branches', '/employees', '/team', '/journal']) expect(html).toContain(`href="${href}"`);
});
