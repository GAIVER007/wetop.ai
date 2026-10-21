import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyReminderItem } from '../../lib/api';

vi.mock('./reminder-actions', () => ({ markReminderDone: vi.fn() }));
const { RemindersToday } = await import('./reminders-today');

const item = (over: Partial<BeautyReminderItem>): BeautyReminderItem => ({
  id: 'n-1',
  kind: 'REMINDER',
  kindLabel: 'Напомнить о записи',
  state: 'MANUAL',
  stateLabel: 'Вручную',
  channel: 'MANUAL',
  dueAt: '2026-10-23T05:00:00.000Z',
  sentAt: null,
  attempts: 0,
  lastError: null,
  appointmentId: 'a-1',
  appointmentStartsAt: '2026-10-23T05:00:00.000Z',
  customerName: 'Айгуль',
  customerPhone: '+7 701 000 00 00',
  text: 'Здравствуйте',
  whatsappUrl: 'https://wa.me/77010000000?text=x',
  ...over,
});

describe('«Напомнить сегодня»: напоминания и просьбы отзыва', () => {
  it('просьба отзыва подписана «Попросить отзыв», та же кнопка WhatsApp и отметка «Попросил»', () => {
    const html = renderToStaticMarkup(
      createElement(RemindersToday, {
        timezone: 'Asia/Almaty',
        canUpdate: true,
        items: [
          item({}),
          item({ id: 'n-2', kind: 'REVIEW_REQUEST', kindLabel: 'Попросить отзыв', customerName: 'Жанар' }),
        ],
      }),
    );
    expect(html).toContain('data-kind="REVIEW_REQUEST"');
    expect(html).toContain('Попросить отзыв');
    expect(html).toContain('Жанар, визит в 10:00');
    expect(html).toContain('Айгуль, запись в 10:00');
    expect(html.match(/Написать в WhatsApp/g)).toHaveLength(2);
    expect(html).toContain('Попросил');
    expect(html).toContain('Напомнил');
    expect(html).not.toContain('\u2014');
  });

  it('просьба отзыва без ссылки: причина вместо кнопки', () => {
    const html = renderToStaticMarkup(
      createElement(RemindersToday, {
        timezone: 'Asia/Almaty',
        canUpdate: false,
        items: [item({ kind: 'REVIEW_REQUEST', kindLabel: 'Попросить отзыв', whatsappUrl: null, text: null })],
      }),
    );
    expect(html).toContain('Ссылка на отзыв не действует');
    expect(html).not.toContain('Попросил');
  });
});
