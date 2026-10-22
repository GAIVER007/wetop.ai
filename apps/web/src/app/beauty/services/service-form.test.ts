import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ saveBeautyService: vi.fn(), saveLocationService: vi.fn(), moveLocationServices: vi.fn() }));
vi.mock('./materials', () => ({ ServiceMaterials: () => null }));
// окно рисуем сразу, чтобы увидеть форму внутри
vi.mock('../../../components/overlay', () => ({
  Overlay: ({ open, children }: { open: boolean; children: unknown }) => (open ? createElement('div', null, children as never) : null),
}));
const opened = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    // первый useState доски это editing: открываем форму заданным режимом
    useState: ((initial: unknown) => {
      if (opened.value !== null) {
        const value = opened.value;
        opened.value = null;
        return react.useState(value);
      }
      return react.useState(initial);
    }) as typeof react.useState,
  };
});

import { ServicesBoard } from './board';

const render = (editing: unknown) => {
  opened.value = editing;
  return renderToStaticMarkup(createElement(ServicesBoard, {
    canEdit: true, locationCurrency: 'KZT', scopeKey: 'business:location', items: [],
  }));
};

describe('окно новой услуги (аудит 21.10.2026 п.5, п.22)', () => {
  it('«Добавить услугу» из шапки: «Сразу в этом филиале» отмечено, есть выбор типовой услуги', () => {
    const html = render({ mode: 'new', enableForLocation: true });
    expect(html).toContain('name="enableForLocation" checked=""');
    expect(html).toContain('Сразу в этом филиале');
    expect(html).toContain('Типовая услуга');
  });
  it('«Добавить» у типовой услуги: второго списка из 14 типовых услуг нет', () => {
    const html = render({ mode: 'new', preset: { name: 'Маникюр', category: 'Ногти', minutes: 60 }, enableForLocation: true });
    expect(html).not.toContain('Типовая услуга');
    expect(html).toContain('value="Маникюр"');
  });
  it('аудит 22.10.2026: форма без браузерных подсказок на английском, свои сообщения под полями', () => {
    const html = render({ mode: 'new', enableForLocation: true });
    expect(html.toLowerCase()).toContain('novalidate=""');
  });
});
