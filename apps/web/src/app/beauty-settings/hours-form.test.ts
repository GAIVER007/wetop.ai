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
  // заголовок раздела один, у страницы (владелец 26.10.2026: «двойной заголовок»); форма его не повторяет
  expect(html).not.toContain('>Режим работы салона<');
  expect(html).toContain('aria-label="Режим работы салона"');
  // дни идут вторым уровнем сразу за заголовком страницы (axe heading-order)
  expect(html).toContain('<h2>Понедельник</h2>');
  expect(html).not.toContain('<h3');
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
  expect(html).not.toContain('<h2>Режим работы салона</h2>');
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
  // путь идёт через хаб «Настройки» (21.10.2026): одна ссылка отсюда, а в хабе салона все четыре экрана
  const { SettingsLinks } = await import('./settings-links');
  const html = renderToStaticMarkup(createElement(SettingsLinks));
  expect(html).toContain('href="/settings"');
  const { settingsGroupsFor } = await import('../../lib/settings-hub');
  const { CLOSED_ACCESS } = await import('../../lib/navigation');
  const hub = settingsGroupsFor({ ...CLOSED_ACCESS, role: 'OWNER' }, 'BEAUTY').flatMap((g) => g.links.map((l) => l.href));
  for (const href of ['/branches', '/employees', '/team', '/journal']) expect(hub).toContain(href);
});

it('разделы настроек салона без второго заголовка: напоминания и бонусы тоже (владелец 26.10.2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const loyalty = readFileSync('apps/web/src/app/beauty-settings/loyalty-forms.tsx', 'utf8');
  expect(loyalty).not.toContain("<h2>{t('Напоминания клиентам')}</h2>");
  expect(loyalty).not.toContain("<h2>{t('Бонусы')}</h2>");
});
