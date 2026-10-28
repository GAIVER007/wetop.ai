import { describe, expect, it } from 'vitest';
import { masterNavItems } from './master-nav';

// кабинет мастера на телефоне (владелец 28.10.2026): нижнее меню Сегодня, Записи, График, Деньги, Я
describe('нижнее меню кабинета мастера', () => {
  const all = { showWork: true, showSchedule: true, showPay: true };
  it('пять пунктов по порядку, каждый ведёт на свою вкладку', () => {
    expect(masterNavItems(all).map((i) => [i.id, i.label, i.href])).toEqual([
      ['today', 'Сегодня', '#today'],
      ['work', 'Записи', '#work'],
      ['week', 'График', '#week'],
      ['pay', 'Деньги', '#pay'],
      ['professional', 'Я', '#professional'],
    ]);
  });
  it('без доступа к записям, графику или деньгам пункт не показывается', () => {
    expect(masterNavItems({ showWork: false, showSchedule: true, showPay: false }).map((i) => i.id)).toEqual(['today', 'week', 'professional']);
  });
});
