import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEMBERSHIP_ROLES } from '@pms/domain';
import { currentPlace, helpSteps, menuSectionsFor } from '../lib/navigation';
import { WHATS_NEW } from '../lib/whats-new';
import { verticalCopy } from '../lib/vertical-copy';
import { deskLocale, translator } from './index';
import { kk } from './kk';

const VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
const EVERYTHING = { aiSeller: true, platform: true, role: 'OWNER' } as const;

/** Файлы каркаса, переведённые в KK1: каждая фраза `t('…')` в них обязана иметь перевод */
const SHELL_FILES = [
  'components/top-nav.tsx',
  'components/shell/account-menu.tsx',
  'components/shell/locale-switch.tsx',
  'components/shell/side-nav.tsx',
  'components/shell/tab-nav.tsx',
  'components/shell/sidebar.tsx',
  'components/shell/search.tsx',
  'components/shell/branch-switcher.tsx',
  'components/shell/property-block.tsx',
  'components/shell/whats-new-link.tsx',
  'app/layout.tsx',
  'app/help/page.tsx',
  'app/help/support-block.tsx',
  'app/whats-new/page.tsx',
  'lib/desk-person.ts',
];

/** Всё, что каркас переводит не литералом, а данными: меню, «Помощь», «Что нового», роли */
function dataPhrases(): string[] {
  const out = new Set<string>();
  for (const vertical of VERTICALS) {
    const sections = menuSectionsFor(EVERYTHING, vertical);
    for (const section of sections) {
      out.add(section.label);
      for (const item of section.items) {
        out.add(item.label);
        if (item.description) out.add(item.description);
      }
    }
    for (const step of helpSteps(sections, vertical)) out.add(step.text);
    out.add(verticalCopy(vertical).staffHelp);
    out.add(verticalCopy(vertical).menu.team);
  }
  for (const path of ['/profile', '/help', '/whats-new', '/branches', '/onboarding', '/platform/support', '/journal', '/x'])
    out.add(currentPlace([], path).label);
  for (const entry of WHATS_NEW) out.add(entry.title).add(entry.text);
  for (const role of Object.values(MEMBERSHIP_ROLES)) out.add(role.charAt(0).toLocaleUpperCase('ru') + role.slice(1));
  return [...out];
}

function literalPhrases(): string[] {
  const out = new Set<string>();
  for (const file of SHELL_FILES) {
    const source = readFileSync(join(__dirname, '..', file), 'utf8');
    for (const match of source.matchAll(/\bt\(\s*(['"])((?:(?!\1).)+)\1/g)) out.add(match[2]!);
  }
  return [...out];
}

describe('язык стойки (ADR-163, KK1)', () => {
  it('русский отдаёт фразу как есть, казахский переводит, неизвестная фраза остаётся русской', () => {
    expect(translator('ru')('Помощь')).toBe('Помощь');
    expect(translator('kk')('Помощь')).toBe('Көмек');
    expect(translator('kk')('Фразы нет в словаре')).toBe('Фразы нет в словаре');
    expect(translator('kk')('Пробный период: ещё {n} дн.', { n: 3 })).toBe('Сынақ мерзімі: тағы 3 күн');
    expect(translator('ru')('Пробный период: ещё {n} дн.', { n: 3 })).toBe('Пробный период: ещё 3 дн.');
  });

  it('язык из ответа API: только kk переводится, en и мусор показываются русским', () => {
    expect(deskLocale('kk')).toBe('kk');
    for (const raw of ['ru', 'en', 'xx', undefined, null, 7]) expect(deskLocale(raw)).toBe('ru');
  });

  it('каждая фраза меню трёх направлений, «Помощи», «Что нового» и ролей переведена', () => {
    const missing = dataPhrases().filter((phrase) => !kk[phrase]);
    // Новый пункт меню или запись «Что нового»: допишите перевод в apps/web/src/i18n/kk.ts (ключ: русская фраза)
    expect(missing).toEqual([]);
  });

  it('каждая фраза t(…) в файлах каркаса переведена', () => {
    const phrases = literalPhrases();
    expect(phrases.length).toBeGreaterThan(80);
    expect(phrases.filter((phrase) => !kk[phrase])).toEqual([]);
  });

  it('перевод не пустой, без длинного тире, с теми же подстановками', () => {
    const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [ru, value] of Object.entries(kk)) {
      expect(value.trim(), ru).not.toBe('');
      expect(value, ru).not.toContain('\u2014');
      expect(vars(value), ru).toEqual(vars(ru));
    }
  });
});
