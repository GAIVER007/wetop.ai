import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StaffAccessPicker, staffAccessDraft } from './staff-access-picker';

// Доступ при добавлении сотрудника (решение владельца 20.10.2026, docs/decisions/2026-10-20-staff-access-levels.md)
const render = (props: Partial<Parameters<typeof StaffAccessPicker>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(StaffAccessPicker, {
      vertical: 'BEAUTY',
      levels: ['NONE', 'PORTAL', 'STAFF', 'MANAGER'],
      value: { level: 'PORTAL', allBranches: false },
      onChange: () => {},
      branchName: 'Центр',
      canAllBranches: true,
      email: '',
      ...props,
    }),
  );

describe('StaffAccessPicker: блок «Доступ в WETOP»', () => {
  it('четыре уровня радиокнопками, выбранный отмечен, у каждого «что увидит»', () => {
    const html = render();
    expect(html).toContain('Доступ в WETOP');
    expect(html.match(/data-level="/g)).toHaveLength(4);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="PORTAL"|<input[^>]*value="PORTAL"[^>]*checked=""/);
    for (const label of ['Без входа', 'Личный кабинет', 'Администратор', 'Управляющий']) expect(html).toContain(label);
    expect(html).toContain('Свои записи');
    expect(html).toContain('Не увидит');
  });

  it('уровень с входом без почты: подсказка, что нужна почта', () => {
    expect(render()).toContain('Укажите почту выше: на неё придёт приглашение');
    expect(render({ email: 'a@b.kz' })).toContain('Приглашение придёт на a@b.kz');
    expect(render({ value: { level: 'NONE', allBranches: false } })).not.toContain('Приглашение');
  });

  it('«Где работает»: текущий филиал или все, переключатель только у того, кто может', () => {
    expect(render()).toContain('Только филиал «Центр»');
    expect(render()).toContain('Все филиалы');
    expect(render({ canAllBranches: false })).not.toContain('Все филиалы');
    expect(render({ value: { level: 'NONE', allBranches: false } })).not.toContain('Только филиал');
  });

  it('управляющему недоступный уровень не показывается', () => {
    const html = render({ levels: ['NONE', 'PORTAL', 'STAFF'] });
    expect(html.match(/data-level="/g)).toHaveLength(3);
    expect(html).not.toContain('Управляющий');
  });

  it('по умолчанию от назначения: специалист в кабинет, другой сотрудник без входа', () => {
    expect(staffAccessDraft('SPECIALIST')).toEqual({ level: 'PORTAL', allBranches: false });
    expect(staffAccessDraft('OTHER_EMPLOYEE')).toEqual({ level: 'NONE', allBranches: false });
    // без почты войти нельзя: мастер создаётся сразу «Без входа», кабинет включается вместе с почтой
    expect(staffAccessDraft('SPECIALIST', '')).toEqual({ level: 'NONE', allBranches: false });
    expect(staffAccessDraft('SPECIALIST', 'a@b.kz')).toEqual({ level: 'PORTAL', allBranches: false });
  });
});
