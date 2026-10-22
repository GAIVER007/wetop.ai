import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// «Рабочий день» салона, аудит живого сайта 21.10.2026: п. 11 (свой заголовок и путь назад к обзору), п. 12 (без плиток)
vi.mock('next/navigation', () => ({ unstable_rethrow() {} }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}));
vi.mock('./vertical-load', () => ({
  loadBeautyToday: async () => ({
    day: { date: '2026-10-21', location: { name: 'Тестовый салон', currency: 'KZT' } },
    metrics: {
      total: 3, clients: 2, onShift: 1, masters: 2, awaitingConfirmation: 0, noShow: 0,
      revenue: [{ minor: '500000', currency: 'KZT' }], upcoming: [], shift: [],
    },
  }),
}));

import { BeautyToday } from './beauty-today';

describe('салон: Рабочий день', () => {
  it('/today/operations: заголовок «Рабочий день», вкладки Обзор и Рабочий день, без плиток', async () => {
    const html = renderToStaticMarkup(await BeautyToday({ operations: true }));
    expect(html).toContain('>Рабочий день</h1>');
    expect(html).toMatch(/<a[^>]*href="\/today"[^>]*>Обзор<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/today\/operations"[^>]*aria-current="page"[^>]*>Рабочий день<\/a>/);
    expect(html).not.toContain('class="stats');
    expect(html).toMatch(/data-testid="today-total"[^>]*>3</);
    expect(html).toMatch(/data-testid="today-shift"[^>]*>1 из 2</);
    expect(html).toContain('5 000 ₸');
  });
  it('/today без сводки руководителя остаётся «Главной» без вкладок', async () => {
    const html = renderToStaticMarkup(await BeautyToday());
    expect(html).toContain('>Главная</h1>');
    expect(html).not.toContain('>Обзор</a>');
  });
});
