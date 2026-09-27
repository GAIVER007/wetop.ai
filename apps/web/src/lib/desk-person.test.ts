import { describe, expect, it } from 'vitest';
import { CLOSED_SHELL, deskPerson, deskShellOf, trialLine } from './desk-person';
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

  it('продавец виден для знакомства, а раздел «Платформа» без прав скрыт', () => {
    expect(hrefs({ aiSeller: false, platform: false })).toContain('/ai-seller');
    expect(hrefs({ aiSeller: false, platform: false })).not.toContain('/platform');
    expect(sidebarSectionsFor({ aiSeller: false, platform: false }).map((s) => s.id)).not.toContain(
      'platform',
    );
    expect(hrefs({ aiSeller: true, platform: false })).toContain('/ai-seller');
    expect(hrefs({ aiSeller: false, platform: true })).toContain('/platform');
    // «Техподдержка» переехала под «ИИ-продавец» (переключатель агентов на странице раздела) — своего
    // пункта меню у неё больше нет, маршрут /platform/support остаётся, но не в sidebarSections
    expect(hrefs({ aiSeller: false, platform: true })).not.toContain('/platform/support');
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

/**
 * Пробный период виден на каждом экране, а не только на `/login` (ТЗ `plans/ux-retention-2026-09-26.md` п. 2.7,
 * ADR-098): человек узнаёт о сроке заранее, а не в день, когда он кончился. Что будет после — не обещаем:
 * автоматического перехода в «только чтение» пока нет (Q-144).
 */
describe('строка пробного периода в меню', () => {
  const NOW = new Date('2026-09-26T09:00:00Z');
  const org = (status: string, trialEndsAt: string | null) => ({ name: 'Хостел', status, trialEndsAt });

  it('пробный — сколько дней осталось; кончился — так и сказано', () => {
    expect(trialLine(org('TRIAL', '2026-10-03T09:00:00Z'), NOW)).toBe('Пробный период: ещё 7 дн.');
    expect(trialLine(org('TRIAL', '2026-09-26T10:00:00Z'), NOW)).toBe('Пробный период: ещё 1 дн.');
    expect(trialLine(org('TRIAL', '2026-09-25T09:00:00Z'), NOW)).toBe('Пробный период закончился');
  });

  it('у оплаченной организации, без срока и без организации строки нет', () => {
    expect(trialLine(org('ACTIVE', '2026-10-03T09:00:00Z'), NOW)).toBeNull();
    expect(trialLine(org('TRIAL', null), NOW)).toBeNull();
    expect(trialLine(null, NOW)).toBeNull();
    expect(trialLine(undefined, NOW)).toBeNull();
  });

  it('оболочка несёт строку вошедшего; без вошедшего — пусто', () => {
    const shell = deskShellOf({
      user: { email: 'dana@example.invalid', name: null, organization: org('TRIAL', '2099-01-01T00:00:00Z') },
    });
    expect(shell.trial).toMatch(/^Пробный период: ещё \d+ дн\.$/);
    expect(CLOSED_SHELL.trial).toBeNull();
  });

  it('обучение (ADR-100): ключ отметки — у вошедшего, без почты в ключе; без вошедшего — нет', () => {
    const shell = deskShellOf({ user: { email: 'dana@example.invalid', name: null } });
    expect(shell.tourKey).toMatch(/^wetop\.tour\.v1:/);
    expect(shell.tourKey).not.toContain('dana');
    expect(CLOSED_SHELL.tourKey).toBeNull();
  });
});
