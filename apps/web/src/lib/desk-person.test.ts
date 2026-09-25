import { describe, expect, it } from 'vitest';
import { CLOSED_SHELL, deskPerson, deskShellOf } from './desk-person';
import { sidebarSectionsFor } from './navigation';

const hrefs = (access: { aiSeller: boolean; platform: boolean }) =>
  sidebarSectionsFor(access).flatMap((s) => s.items.map((i) => i.href));

describe('меню и подпись по тому, кто вошёл (ADR-083)', () => {
  const me = (over: Record<string, unknown> = {}, seller?: string) => ({
    user: {
      email: 'dana@example.invalid',
      name: 'Дана Тестова',
      role: 'OWNER',
      platformAdmin: false,
      ...over,
    },
    ...(seller ? { access: { aiSeller: { access: seller } } } : {}),
  });

  it('«ИИ-продавец» — при действующем расширении и после срока; «Платформа» — главному администратору', () => {
    expect(deskShellOf(me({}, 'active')).access).toEqual({ aiSeller: true, platform: false });
    expect(deskShellOf(me({}, 'expired')).access.aiSeller).toBe(true);
    expect(deskShellOf(me({}, 'off')).access.aiSeller).toBe(false);
    // старый API расширений не присылает — пункта нет, а не «открыто на всякий случай»
    expect(deskShellOf(me()).access.aiSeller).toBe(false);
    expect(deskShellOf(me({ platformAdmin: true }, 'off')).access).toEqual({
      aiSeller: false,
      platform: true,
    });
    expect(deskShellOf({ user: null })).toBe(CLOSED_SHELL);
    expect(deskShellOf(null)).toBe(CLOSED_SHELL);
  });

  it('закрытых пунктов в меню нет, а раздел «Платформа» без прав не показывается вовсе', () => {
    expect(hrefs({ aiSeller: false, platform: false })).not.toContain('/ai-seller');
    expect(hrefs({ aiSeller: false, platform: false })).not.toContain('/platform');
    expect(sidebarSectionsFor({ aiSeller: false, platform: false }).map((s) => s.id)).not.toContain(
      'platform',
    );
    expect(hrefs({ aiSeller: true, platform: false })).toContain('/ai-seller');
    expect(hrefs({ aiSeller: false, platform: true })).toContain('/platform');
    // «Техподдержка» — там же, в «Платформе», и тоже только главному администратору (Э3)
    expect(hrefs({ aiSeller: false, platform: true })).toContain('/platform/support');
    expect(hrefs({ aiSeller: true, platform: false })).not.toContain('/platform/support');
  });

  it('подпись: имя и роль; без имени — почта; главный администратор — отдельно', () => {
    expect(deskPerson(me().user)).toEqual({
      name: 'Дана Тестова',
      caption: 'Владелец',
      initials: 'ДТ',
    });
    expect(deskPerson(me({ role: 'STAFF', name: null }).user)).toEqual({
      name: 'dana@example.invalid',
      caption: 'Сотрудник',
      initials: 'D',
    });
    expect(deskPerson(me({ platformAdmin: true }).user).caption).toBe(
      'Владелец · главный администратор',
    );
    // роли в ответе нет (старый API) — подпись не обещает прав владельца
    expect(deskPerson(me({ role: undefined }).user).caption).toBe('Сотрудник');
  });
});
