import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { saveStateText } from './settings-save';
import { StayNote } from './settings-form';

describe('«Настройки объекта» (аудит 22.10.2026 P1-9)', () => {
  it('выключенная «Сохранить изменения» объясняет причину: «Нет изменений»', () => {
    expect(saveStateText({ dirty: false, pending: false, saved: false })).toBe('Нет изменений');
    expect(saveStateText({ dirty: true, pending: false, saved: false })).toBe('• Есть несохранённые изменения');
    expect(saveStateText({ dirty: false, pending: false, saved: true })).toBe('✓ Изменения сохранены');
    expect(saveStateText({ dirty: true, pending: true, saved: false })).toBe('• Есть несохранённые изменения');
  });
  it('пояс объекта словами «Алматы, UTC+5», без «Asia/Almaty»', () => {
    const html = renderToStaticMarkup(createElement(StayNote, { timezone: 'Asia/Almaty' }));
    expect(html).toContain('По времени объекта (Алматы, UTC+5)');
    expect(html).not.toContain('Asia/');
  });
});
