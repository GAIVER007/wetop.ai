import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: <T,>(initial: T | (() => T)) => [typeof initial === 'function' ? (initial as () => T)() : initial, vi.fn()],
  useTransition: () => [false, vi.fn()],
}));
vi.mock('./actions', () => ({ submitBeautyReview: vi.fn() }));

import { BeautyReviewForm } from './review-form';

describe('публичная форма отзыва о мастерах', () => {
  it('показывает каждого мастера как необязательный выбор и доступную оценку', () => {
    const html = renderToStaticMarkup(createElement(BeautyReviewForm, {
      token: 'synthetic-token',
      masters: [
        { key: 'master-a', name: 'Анна Тестовая' },
        { key: 'master-b', name: 'Борис Тестовый' },
      ],
    }));

    expect(html).toContain('Анна Тестовая');
    expect(html).toContain('Борис Тестовый');
    expect(html).toContain('Оценить Анна Тестовая');
    expect(html).toContain('Оценка для Анна Тестовая');
    expect(html).toContain('Отправить отзыв');
  });
});
