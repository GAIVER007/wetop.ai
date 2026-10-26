import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

// Source-level merge regression, complementing the unchanged React read-only render tests.
const source = readFileSync('apps/web/src/app/beauty/schedule/board.tsx', 'utf8');
describe('schedule reconciliation retains published read-only boundaries', () => {
  it('gates the master editor entry and keeps a plain name for readers', () => {
    // вариант B (25.10.2026): имя кнопкой только с правом, читатель видит простой текст
    assert.match(source, /\{canEdit \? \(\s*<button[^>]*schedule-person__name[^>]*onClick=\{\(\) => setEditing\(\{ master: m \}\)\}[\s\S]*?<span className="schedule-person__name">\{m.name\}<\/span>/);
  });
  it('gates both the overlay and its editable contents', () => {
    assert.match(source, /open=\{canEdit && editing !== null\}/);
    assert.match(source, /\{canEdit && editing && \(/);
  });
  it('gates both date switches and weekly-template editor links', () => {
    assert.match(source, /canEdit && !templateOff && \(!absent \|\| dayOff\)/);
    // правка недели из окошка дня только с правом; без права плашка выключена и окошко не открывается
    assert.match(source, /\{canEdit && \(\s*<Button[\s\S]*?setEditing\(\{ master: m, weekday: d\.weekday \}\)/);
    assert.match(source, /disabled=\{!canEdit && !absent\?\.reason\}/);
  });
});
